import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  encodeDeployData,
  encodeAbiParameters,
  parseAbiParameters,
  parseEther,
  formatEther,
  keccak256,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
if (existsSync('.local/testnet-deployment.json'))
  throw Error('Deployment already recorded; inspect it before deploying again');
if (existsSync('.local/deployment-pending.json'))
  throw Error(
    'Pending deployment recorded; reconcile its hash before deploying again',
  );
const chain = defineChain({
  id: 1874,
  name: 'Whitechain Sepolia',
  nativeCurrency: { name: 'WBT', symbol: 'WBT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.whitechain.io'] } },
});
const transport = http(undefined, { timeout: 20000, retryCount: 0 });
const pub = createPublicClient({ chain, transport });
if ((await pub.getChainId()) !== 1874) throw Error('Wrong chain');
const key = JSON.parse(readFileSync('.local/testnet-wallet.json'));
const account = privateKeyToAccount(key.privateKey);
if (account.address !== key.address) throw Error('Wallet mismatch');
const wallet = createWalletClient({ chain, transport, account });
const artifact = JSON.parse(readFileSync('artifacts/RelayCheckout.json'));
const token = '0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7';
const args = [token, account.address];
const data = encodeDeployData({ ...artifact, args });
const gas = await pub.estimateGas({ account: account.address, data });
const fee = await pub.getGasPrice();
if (gas * fee > parseEther('0.02'))
  throw Error('Deployment gas estimate exceeds 0.02 WBT cap');
console.log(
  JSON.stringify({
    action: 'deploy testnet only',
    estimatedExecutionGas: gas.toString(),
    estimatedExecutionFeeWbt: formatEther(gas * fee),
  }),
);
const request = await wallet.prepareTransactionRequest({
  data,
  gas: (gas * 125n) / 100n,
});
const raw = await wallet.signTransaction(request);
const hash = keccak256(raw);
writeFileSync(
  '.local/deployment-compiler-input.json',
  readFileSync('artifacts/standard-input.json'),
  { flag: 'wx', mode: 0o600 },
);
writeFileSync(
  '.local/deployment-pending.json',
  JSON.stringify({ hash, raw, chainId: 1874 }),
  { flag: 'wx', mode: 0o600 },
);
await pub.sendRawTransaction({ serializedTransaction: raw });
const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 120000 });
if (receipt.status !== 'success') throw Error('Deployment reverted');
const result = {
  chainId: 1874,
  address: receipt.contractAddress,
  token,
  relay: account.address,
  admin: account.address,
  blockNumber: receipt.blockNumber.toString(),
  transactionHash: hash,
  constructorArgs: encodeAbiParameters(
    parseAbiParameters('address,address'),
    args,
  ),
  compilerVersion: 'v0.8.28+commit.7893614a',
  explorer:
    'https://explorer.testnet.whitechain.io/address/' + receipt.contractAddress,
};
writeFileSync(
  '.local/testnet-deployment.json',
  JSON.stringify(result, null, 2),
);
mkdirSync('deployments/whitechain-sepolia', { recursive: true });
writeFileSync(
  'deployments/whitechain-sepolia/deployment.json',
  JSON.stringify(result, null, 2),
);
writeFileSync(
  'deployments/whitechain-sepolia/compiler-input.json',
  readFileSync('.local/deployment-compiler-input.json'),
);
console.log(JSON.stringify(result, null, 2));
