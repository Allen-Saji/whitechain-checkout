import { readFileSync } from 'node:fs';
const d = JSON.parse(
  readFileSync('deployments/whitechain-sepolia/deployment.json'),
);
const form = new FormData();
form.set('compiler_version', d.compilerVersion);
form.set('contract_name', 'RelayCheckout.sol:RelayCheckout');
form.set('constructor_args', d.constructorArgs.slice(2));
form.set(
  'files[0]',
  new Blob(
    [readFileSync('deployments/whitechain-sepolia/compiler-input.json')],
    {
      type: 'application/json',
    },
  ),
  'standard-input.json',
);
const response = await fetch(
  'https://explorer.testnet.whitechain.io/api/v2/smart-contracts/' +
    d.address +
    '/verification/via/standard-input',
  { method: 'POST', body: form },
);
console.log(
  JSON.stringify({
    status: response.status,
    body: (await response.text()).slice(0, 1500),
  }),
);
if (!response.ok) process.exitCode = 1;
