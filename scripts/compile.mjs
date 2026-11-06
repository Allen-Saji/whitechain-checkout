import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import solc from 'solc';
const input = {
  language: 'Solidity',
  sources: {
    'RelayCheckout.sol': {
      content: readFileSync('contracts/RelayCheckout.sol', 'utf8'),
    },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'paris',
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
      },
    },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
if (errors.length)
  throw Error(errors.map((e) => e.formattedMessage).join('\n'));
mkdirSync('artifacts', { recursive: true });
const c = output.contracts['RelayCheckout.sol'].RelayCheckout;
writeFileSync(
  'artifacts/RelayCheckout.json',
  JSON.stringify(
    { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object },
    null,
    2,
  ),
);
writeFileSync('artifacts/standard-input.json', JSON.stringify(input));
console.log('Compiled RelayCheckout with solc ' + solc.version());
