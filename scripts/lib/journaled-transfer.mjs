import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { encodeFunctionData, erc20Abi, keccak256, parseEther } from 'viem';

/** Persist exact signed bytes before broadcasting so an interrupted run is resumable. */
export async function transferTestTokens({
  client,
  wallet,
  token,
  to,
  amount,
  path,
}) {
  if ((await client.getChainId()) !== 1874) throw Error('TESTNET_REQUIRED');
  let journal;
  if (existsSync(path)) {
    journal = JSON.parse(readFileSync(path));
    if (
      journal.to !== to ||
      journal.token !== token ||
      journal.amount !== amount.toString()
    )
      throw Error('FUNDING_JOURNAL_CONFLICT');
  } else {
    const request = await wallet.prepareTransactionRequest({
      to: token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, amount],
      }),
    });
    if (
      request.gas * (request.maxFeePerGas ?? request.gasPrice) >
      parseEther('0.01')
    )
      throw Error('FUNDING_GAS_CAP');
    const raw = await wallet.signTransaction(request);
    journal = {
      to,
      token,
      amount: amount.toString(),
      raw,
      hash: keccak256(raw),
    };
    writeFileSync(path, JSON.stringify(journal), { flag: 'wx', mode: 0o600 });
  }
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: journal.hash });
  } catch (error) {
    if (error.name !== 'TransactionReceiptNotFoundError') throw error;
  }
  if (!receipt) {
    try {
      await client.sendRawTransaction({ serializedTransaction: journal.raw });
    } catch {
      /* An uncertain response must be resolved by this hash, never a second transfer. */
    }
    receipt = await client.waitForTransactionReceipt({
      hash: journal.hash,
      confirmations: 3,
      timeout: 90000,
    });
  }
  if (receipt.status !== 'success') throw Error('FUNDING_REVERTED');
  return receipt;
}
