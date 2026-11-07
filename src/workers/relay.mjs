import { exceedsGasBudget } from '../gas-policy.mjs';
import { relayScopeAllows } from '../relay-scope.mjs';
import { createWalletClient, http, encodeFunctionData, keccak256 } from 'viem';
import { transaction, reserveGas } from '../db.mjs';
import { onchainId } from '../protocol.mjs';
export function createRelay(config, db, owns) {
  const client = config.client;
  const wallet = createWalletClient({
    account: config.account,
    chain: config.chain,
    transport: http(config.rpc, { timeout: 12000, retryCount: 0 }),
  });
  const fail = (job, code) =>
    transaction(db, () => {
      if (!owns()) throw Error('WORKER_LEASE_LOST');
      db.prepare("UPDATE jobs SET status='failed',error=? WHERE id=?").run(
        code,
        job.id,
      );
      if (job.kind === 'refund')
        db.prepare("UPDATE refunds SET status='failed' WHERE id=?").run(
          job.refund_id,
        );
      else
        db.prepare(
          "UPDATE checkouts SET state='failed' WHERE id=? AND state='queued'",
        ).run(job.checkout_id);
    });
  async function relay() {
    // A persisted transaction always owns the next relay nonce until mined.
    let job = db
      .prepare(
        "SELECT * FROM jobs WHERE status IN ('signed','broadcast') ORDER BY created_at LIMIT 1",
      )
      .get();
    if (job) {
      if (
        !relayScopeAllows(config, {
          checkoutId: job.checkout_id,
          kind: job.kind,
          amount: job.amount,
        })
      )
        throw Error('RELAY_SCOPE_RESTRICTED');
      let receipt;
      try {
        receipt = await client.getTransactionReceipt({ hash: job.tx_hash });
      } catch (e) {
        if (e.name !== 'TransactionReceiptNotFoundError') throw e;
      }
      if (!owns()) throw Error('WORKER_LEASE_LOST');
      if (receipt) {
        if (receipt.status === 'reverted') fail(job, 'TRANSACTION_REVERTED');
        else
          db.prepare("UPDATE jobs SET status='mined' WHERE id=?").run(job.id);
      } else {
        // Rebroadcast the exact bytes, including nonce, after any uncertain response.
        try {
          await client.sendRawTransaction({
            serializedTransaction: job.raw_tx,
          });
          if (!owns()) throw Error('WORKER_LEASE_LOST');
          db.prepare(
            "UPDATE jobs SET status='broadcast',error=NULL WHERE id=?",
          ).run(job.id);
        } catch {
          if (!owns()) throw Error('WORKER_LEASE_LOST');
          db.prepare(
            "UPDATE jobs SET error='BROADCAST_UNCERTAIN' WHERE id=?",
          ).run(job.id);
        }
      }
      return;
    }
    job = db
      .prepare(
        "SELECT * FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1",
      )
      .get();
    if (!job) return;
    if (
      !relayScopeAllows(config, {
        checkoutId: job.checkout_id,
        kind: job.kind,
        amount: job.amount,
      })
    )
      throw Error('RELAY_SCOPE_RESTRICTED');
    if (job.deadline <= Math.floor(Date.now() / 1000)) {
      fail(job, 'AUTHORIZATION_EXPIRED');
      return;
    }
    const checkout = db
      .prepare('SELECT * FROM checkouts WHERE id=?')
      .get(job.checkout_id);
    const merchant = db
      .prepare('SELECT * FROM merchants WHERE id=?')
      .get(checkout.merchant_id);
    const args =
      job.kind === 'pay'
        ? [
            onchainId(checkout.id),
            job.signer,
            merchant.payout,
            BigInt(job.amount),
            BigInt(job.deadline),
            job.signature,
          ]
        : [
            onchainId(checkout.id),
            onchainId(job.refund_id),
            BigInt(job.amount),
            BigInt(job.deadline),
            job.signature,
          ];
    const call = {
      address: config.router,
      abi: config.abi,
      functionName: job.kind,
      args,
      account: config.account,
    };
    try {
      await client.simulateContract(call);
    } catch (e) {
      if (e.walk?.((cause) => cause.name === 'ContractFunctionRevertedError'))
        fail(job, 'SIMULATION_REVERTED');
      else throw e;
      return;
    }
    const gas = ((await client.estimateContractGas(call)) * 125n) / 100n;
    const fees = await client.estimateFeesPerGas();
    const cap = gas * (fees.maxFeePerGas ?? fees.gasPrice);
    if (exceedsGasBudget(cap, config.maxGasPerJob)) {
      fail(job, 'TRANSACTION_GAS_CAP');
      return;
    }
    try {
      reserveGas(
        db,
        job,
        merchant,
        cap,
        Date.now(),
        config.globalDailyGasBudget ?? null,
      );
    } catch (e) {
      if (['MERCHANT_GAS_BUDGET', 'GLOBAL_GAS_BUDGET'].includes(e.message)) {
        fail(job, e.message);
        return;
      }
      throw e;
    }
    const request = await wallet.prepareTransactionRequest({
      to: config.router,
      data: encodeFunctionData(call),
      gas,
      ...fees,
      nonce: await client.getTransactionCount({
        address: config.account.address,
        blockTag: 'pending',
      }),
    });
    const raw = await wallet.signTransaction(request),
      txHash = keccak256(raw);
    transaction(db, () => {
      if (!owns()) throw Error('WORKER_LEASE_LOST');
      db.prepare(
        "UPDATE jobs SET raw_tx=?,tx_hash=?,status='signed' WHERE id=? AND status='queued'",
      ).run(raw, txHash, job.id);
    });
  }
  return relay;
}
