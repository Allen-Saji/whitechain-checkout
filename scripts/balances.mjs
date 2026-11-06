import {
  createPublicClient,
  http,
  erc20Abi,
  formatEther,
  formatUnits,
} from 'viem';
import { readFileSync } from 'node:fs';
const address = JSON.parse(readFileSync('.local/testnet-address.json')).address;
const client = createPublicClient({
  transport: http('https://rpc.testnet.whitechain.io', {
    timeout: 20000,
    retryCount: 0,
  }),
});
if ((await client.getChainId()) !== 1874) throw Error('Wrong chain');
const token = '0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7';
const [native, balance, decimals] = await Promise.all([
  client.getBalance({ address }),
  client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  }),
  client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'decimals',
  }),
]);
console.log(
  JSON.stringify({
    address,
    chainId: 1874,
    WBT: formatEther(native),
    USDT: formatUnits(balance, decimals),
  }),
);
