import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
mkdirSync('.local', { recursive: true, mode: 0o700 });
if (existsSync('.local/testnet-wallet.json')) throw Error('WALLET_EXISTS');
const privateKey = generatePrivateKey(),
  account = privateKeyToAccount(privateKey);
writeFileSync(
  '.local/testnet-wallet.json',
  JSON.stringify({ chainId: 1874, address: account.address, privateKey }),
  { flag: 'wx', mode: 0o600 },
);
writeFileSync(
  '.local/testnet-address.json',
  JSON.stringify({ chainId: 1874, address: account.address }),
  { flag: 'wx', mode: 0o600 },
);
console.log(JSON.stringify({ chainId: 1874, address: account.address }));
