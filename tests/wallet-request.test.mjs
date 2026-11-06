import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(
  new URL('../web/lib/wallet-request.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
const { walletRequest } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('wallet response passes through', async () => {
  assert.deepEqual(await walletRequest(async () => ['0x123'], 100), ['0x123']);
});

test('unresponsive wallet releases the flow and ignores late approval', async () => {
  let approve;
  let continued = false;
  const pending = walletRequest(
    () =>
      new Promise((resolve) => {
        approve = resolve;
      }),
    10,
  ).then(() => {
    continued = true;
  });
  await assert.rejects(pending, /wallet has not responded/);
  approve(['0x123']);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(continued, false);
});

test('pending wallet request has actionable recovery instructions', async () => {
  await assert.rejects(
    walletRequest(async () => {
      throw { code: -32002 };
    }),
    /already open in your wallet/,
  );
});

test('wallet rejection is preserved and synchronous provider errors are caught', async () => {
  const rejection = Object.assign(new Error('Rejected'), { code: 4001 });
  await assert.rejects(
    walletRequest(() => {
      throw rejection;
    }),
    (error) => error === rejection,
  );
});
