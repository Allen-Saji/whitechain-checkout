import { readFileSync } from 'node:fs';
import solc from 'solc';
import { createPublicClient, http } from 'viem';
const manifest = JSON.parse(
  readFileSync('deployments/whitechain-sepolia/deployment.json'),
);
const compilerInput = readFileSync(
  'deployments/whitechain-sepolia/compiler-input.json',
  'utf8',
);
const compiled = JSON.parse(solc.compile(compilerInput));
if (compiled.errors?.some((error) => error.severity === 'error'))
  throw Error('COMPILATION_FAILED');
const bytecode =
  compiled.contracts['RelayCheckout.sol'].RelayCheckout.evm.bytecode.object;
const client = createPublicClient({
  transport: http('https://rpc.testnet.whitechain.io', {
    timeout: 20000,
    retryCount: 0,
  }),
});
if ((await client.getChainId()) !== 1874) throw Error('CHAIN_MISMATCH');
const [transaction, receipt] = await Promise.all([
  client.getTransaction({ hash: manifest.transactionHash }),
  client.getTransactionReceipt({ hash: manifest.transactionHash }),
]);
if (
  transaction.input.toLowerCase() !==
  ('0x' + bytecode + manifest.constructorArgs.slice(2)).toLowerCase()
)
  throw Error('DEPLOYMENT_INPUT_MISMATCH');
if (
  receipt.status !== 'success' ||
  receipt.contractAddress.toLowerCase() !== manifest.address.toLowerCase()
)
  throw Error('DEPLOYMENT_RECEIPT_MISMATCH');
console.log(
  'Recorded compiler input and constructor arguments exactly match the successful deployment transaction.',
);
