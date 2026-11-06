import {
  createWalletClient,
  custom,
  getAddress,
  erc20Abi,
  encodeFunctionData,
  decodeFunctionResult,
} from 'viem';
const discovered = new Map();
let selected;
window.addEventListener('eip6963:announceProvider', (event) => {
  if (event.detail?.info?.uuid && event.detail?.provider?.request)
    discovered.set(event.detail.info.uuid, event.detail);
});
window.dispatchEvent(new Event('eip6963:requestProvider'));
async function chooseProvider() {
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  await new Promise((resolve) => setTimeout(resolve, 150));
  const providers = [...discovered.values()];
  if (!providers.length && window.ethereum?.request) return window.ethereum;
  if (!providers.length)
    throw Error(
      'No wallet was found. Open this page in a browser with MetaMask or another compatible EVM wallet.',
    );
  if (providers.length === 1) return providers[0].provider;
  return new Promise((resolve, reject) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'wallet-dialog';
    const title = document.createElement('h2');
    title.textContent = 'Choose your wallet';
    dialog.append(title);
    const description = document.createElement('p');
    description.textContent = 'Connect an account on Whitechain Sepolia.';
    dialog.append(description);
    providers.forEach((entry) => {
      const button = document.createElement('button');
      button.className = 'wallet-option';
      button.textContent = entry.info.name;
      button.addEventListener('click', () => {
        resolve(entry.provider);
        dialog.close();
        dialog.remove();
      });
      dialog.append(button);
    });
    const cancel = document.createElement('button');
    cancel.className = 'text-link';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => dialog.close());
    dialog.append(cancel);
    dialog.addEventListener(
      'cancel',
      () => reject(Error('Wallet connection cancelled.')),
      { once: true },
    );
    dialog.addEventListener(
      'close',
      () => {
        reject(Error('Wallet connection cancelled.'));
        dialog.remove();
      },
      { once: true },
    );
    document.body.append(dialog);
    dialog.showModal();
  });
}
function friendly(error) {
  if (
    error.code === 4001 ||
    error.code === 'ACTION_REJECTED' ||
    error.cause?.code === 4001
  )
    return Error(
      'Request cancelled in your wallet. Nothing new was submitted.',
    );
  return error;
}
export async function connectWallet() {
  try {
    selected ??= await chooseProvider();
    const accounts = await selected.request({ method: 'eth_requestAccounts' });
    if (!accounts[0]) throw Error('Select an account in your wallet.');
    if (Number(await selected.request({ method: 'eth_chainId' })) !== 1874) {
      try {
        await selected.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x752' }],
        });
      } catch (error) {
        if (error.code !== 4902) throw error;
        await selected.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0x752',
              chainName: 'Whitechain Sepolia',
              nativeCurrency: { name: 'WBT', symbol: 'WBT', decimals: 18 },
              rpcUrls: ['https://rpc.testnet.whitechain.io'],
              blockExplorerUrls: ['https://explorer.testnet.whitechain.io'],
            },
          ],
        });
      }
    }
    if (Number(await selected.request({ method: 'eth_chainId' })) !== 1874)
      throw Error('Switch your wallet to Whitechain Sepolia to continue.');
    const current = await selected.request({ method: 'eth_accounts' });
    return {
      address: getAddress(current[0]),
      client: createWalletClient({ transport: custom(selected) }),
    };
  } catch (error) {
    throw friendly(error);
  }
}
export async function tokenBalance(address, token) {
  const raw = await selected.request({
    method: 'eth_call',
    params: [
      {
        to: token,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        }),
      },
      'latest',
    ],
  });
  return decodeFunctionResult({
    abi: erc20Abi,
    functionName: 'balanceOf',
    data: raw,
  });
}
export async function signAuthorization(auth, expected) {
  const wallet = await connectWallet();
  if (wallet.address.toLowerCase() !== expected.from.toLowerCase())
    throw Error(
      'Your selected wallet changed. Switch back to the account shown on this order.',
    );
  if (
    Number(auth.domain.chainId) !== 1874 ||
    auth.domain.verifyingContract.toLowerCase() !==
      expected.token.toLowerCase() ||
    auth.message.to.toLowerCase() !== expected.router.toLowerCase() ||
    auth.message.from.toLowerCase() !== expected.from.toLowerCase() ||
    BigInt(auth.message.value) !== BigInt(expected.amount)
  )
    throw Error(
      'The payment details changed. Reload and review the order before signing.',
    );
  try {
    return await wallet.client.signTypedData({
      ...auth,
      account: wallet.address,
    });
  } catch (error) {
    throw friendly(error);
  }
}
export async function signIn(api) {
  const wallet = await connectWallet();
  const challenge = await api('/v1/session/challenge', {
    address: wallet.address,
  });
  let signature;
  try {
    signature = await wallet.client.signMessage({
      account: wallet.address,
      message: challenge.message,
    });
  } catch (error) {
    throw friendly(error);
  }
  return api('/v1/session/verify', { id: challenge.id, signature });
}
