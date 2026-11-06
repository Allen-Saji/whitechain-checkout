import { walletRequest } from './wallet-request';
import type { Address, EIP1193Provider } from 'viem';
import type { Authorization, Session } from './types';
import { api } from './api';
import {
  createWalletClient,
  custom,
  getAddress,
  erc20Abi,
  encodeFunctionData,
  decodeFunctionResult,
} from 'viem';
interface ProviderDetail {
  info: { uuid: string; name: string };
  provider: EIP1193Provider;
}
const discovered = new Map<string, ProviderDetail>();
let selected: EIP1193Provider | undefined;
let discovering = false;
function discover() {
  if (discovering) return;
  discovering = true;
  window.addEventListener('eip6963:announceProvider', (raw) => {
    const event = raw as CustomEvent<ProviderDetail>;
    if (
      event.detail?.info?.uuid &&
      typeof event.detail?.provider?.request === 'function'
    )
      discovered.set(event.detail.info.uuid, event.detail);
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}
async function chooseProvider(): Promise<EIP1193Provider> {
  discover();
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  await new Promise((resolve) => setTimeout(resolve, 150));
  const providers = [...discovered.values()];
  const injected = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  if (!providers.length && injected) return injected;
  if (!providers.length)
    throw Error(
      'No wallet was found. Open this page in a browser with MetaMask or another compatible EVM wallet.',
    );
  if (providers.length === 1) return providers[0].provider;
  return new Promise<EIP1193Provider>((resolve, reject) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'wallet-dialog';
    const title = document.createElement('h2');
    title.textContent = 'Choose your wallet';
    title.id = 'wallet-picker-title';
    dialog.setAttribute('aria-labelledby', title.id);
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
function codeOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : undefined;
}
function friendly(error: unknown) {
  if (
    codeOf(error) === 4001 ||
    codeOf(error) === 'ACTION_REJECTED' ||
    codeOf(
      typeof error === 'object' && error !== null && 'cause' in error
        ? error.cause
        : null,
    ) === 4001
  )
    return Error(
      'Request cancelled in your wallet. Nothing new was submitted.',
    );
  return error;
}
export async function connectWallet(onProgress?: (message: string) => void) {
  try {
    onProgress?.('Choose your wallet to continue.');
    selected ??= await chooseProvider();
    const provider = selected;
    const bounded = {
      request: ((args) =>
        walletRequest(() =>
          provider.request(args as Parameters<EIP1193Provider['request']>[0]),
        )) as EIP1193Provider['request'],
    };
    onProgress?.('Open your wallet extension and approve the connection.');
    const accounts = await bounded.request({ method: 'eth_requestAccounts' });
    if (!accounts[0]) throw Error('Select an account in your wallet.');
    if (Number(await bounded.request({ method: 'eth_chainId' })) !== 1874) {
      onProgress?.('Approve the switch to Whitechain Sepolia in your wallet.');
      try {
        await bounded.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x752' }],
        });
      } catch (error) {
        if (codeOf(error) !== 4902) throw error;
        await bounded.request({
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
    if (Number(await bounded.request({ method: 'eth_chainId' })) !== 1874)
      throw Error('Switch your wallet to Whitechain Sepolia to continue.');
    const current = await bounded.request({ method: 'eth_accounts' });
    return {
      address: getAddress(current[0]),
      client: createWalletClient({
        transport: custom(bounded, { retryCount: 0 }),
      }),
    };
  } catch (error) {
    throw friendly(error);
  }
}
export async function tokenBalance(address: Address, token: Address) {
  if (!selected) throw Error('Connect your wallet first.');
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
export async function signAuthorization(
  auth: Authorization,
  expected: { from: Address; token: Address; router: Address; amount: string },
) {
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
export async function signIn() {
  const wallet = await connectWallet();
  const challenge = await api<{ id: string; message: string }>(
    '/v1/session/challenge',
    {
      address: wallet.address,
    },
  );
  let signature;
  try {
    signature = await wallet.client.signMessage({
      account: wallet.address,
      message: challenge.message,
    });
  } catch (error) {
    throw friendly(error);
  }
  return api<Session>('/v1/session/verify', { id: challenge.id, signature });
}

export async function registerMerchant(
  businessName: string,
  onProgress?: (message: string) => void,
) {
  const wallet = await connectWallet(onProgress);
  onProgress?.('Preparing your registration message...');
  const challenge = await api<{ id: string; message: string }>(
    '/v1/registration/challenge',
    { address: wallet.address, businessName },
  );
  onProgress?.(
    'Sign the registration message in your wallet. This does not move funds.',
  );
  let signature;
  try {
    signature = await wallet.client.signMessage({
      account: wallet.address,
      message: challenge.message,
    });
  } catch (error) {
    throw friendly(error);
  }
  onProgress?.('Creating your merchant account...');
  return api<{
    merchant: import('./types').MerchantSettings;
    credentials: import('./types').MerchantCredentials;
  }>('/v1/registration/verify', { id: challenge.id, signature });
}
