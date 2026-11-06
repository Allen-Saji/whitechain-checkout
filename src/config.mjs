import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createPublicClient,
  http,
  defineChain,
  parseAbi,
  hashDomain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { REQUIRED_TOKEN } from './protocol.mjs';
export async function loadConfig() {
  const local = process.env.LOCAL_FORK === '1';
  const deployment = JSON.parse(
    readFileSync(
      local ? '.local/fork-deployment.json' : '.local/testnet-deployment.json',
    ),
  );
  const key = JSON.parse(
    readFileSync(
      local ? '.local/fork-wallet.json' : '.local/testnet-wallet.json',
    ),
  );
  const rpc = local
    ? 'http://127.0.0.1:8550'
    : 'https://rpc.testnet.whitechain.io';
  const chain = defineChain({
    id: 1874,
    name: local ? 'Whitechain local fork' : 'Whitechain Sepolia',
    nativeCurrency: { name: 'WBT', symbol: 'WBT', decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });
  const client = createPublicClient({
    chain,
    transport: http(rpc, { timeout: 12000, retryCount: 0 }),
    cacheTime: 0,
  });
  if ((await client.getChainId()) !== 1874) throw Error('CHAIN_MISMATCH');
  const abi = JSON.parse(readFileSync('artifacts/RelayCheckout.json')).abi;
  const tokenAbi = parseAbi([
    'function name() view returns(string)',
    'function decimals() view returns(uint8)',
    'function DOMAIN_SEPARATOR() view returns(bytes32)',
  ]);
  const [tokenName, decimals, separator, configuredRelay, configuredToken] =
    await Promise.all([
      client.readContract({
        address: REQUIRED_TOKEN,
        abi: tokenAbi,
        functionName: 'name',
      }),
      client.readContract({
        address: REQUIRED_TOKEN,
        abi: tokenAbi,
        functionName: 'decimals',
      }),
      client.readContract({
        address: REQUIRED_TOKEN,
        abi: tokenAbi,
        functionName: 'DOMAIN_SEPARATOR',
      }),
      client.readContract({
        address: deployment.address,
        abi,
        functionName: 'relay',
      }),
      client.readContract({
        address: deployment.address,
        abi,
        functionName: 'token',
      }),
    ]);
  const account = privateKeyToAccount(key.privateKey);
  if (
    configuredRelay.toLowerCase() !== account.address.toLowerCase() ||
    configuredToken.toLowerCase() !== REQUIRED_TOKEN.toLowerCase()
  )
    throw Error('DEPLOYMENT_MISMATCH');
  const domain = {
    name: tokenName,
    version: '1',
    chainId: 1874,
    verifyingContract: REQUIRED_TOKEN,
  };
  const domainTypes = {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
  };
  if (hashDomain({ domain, types: domainTypes }) !== separator)
    throw Error('TOKEN_DOMAIN_MISMATCH');
  const confirmations = Number(process.env.CONFIRMATIONS ?? (local ? 1 : 3));
  if (
    !Number.isInteger(confirmations) ||
    confirmations < 1 ||
    confirmations > 100
  )
    throw Error('INVALID_CONFIRMATIONS');
  return {
    local,
    relayEnabled: process.env.DEMO_WORKER !== '0',
    appOrigin: new URL(process.env.APP_ORIGIN ?? 'http://127.0.0.1:4210')
      .origin,
    demoMerchantId: process.env.DEMO_MERCHANT_ID,
    rpc,
    chain,
    client,
    account,
    abi,
    tokenName,
    decimals,
    router: deployment.address,
    deploymentBlock: Number(deployment.blockNumber),
    confirmations,
    dbPath: resolve(
      process.env.DB_PATH ??
        (local ? '.local/fork.sqlite' : '.local/service.sqlite'),
    ),
    port: Number(process.env.PORT ?? 4200),
    checkoutBaseUrl: process.env.CHECKOUT_BASE_URL,
    maxGasPerJob: 10000000000000000n,
  };
}
