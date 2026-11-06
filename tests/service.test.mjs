import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import Fastify from 'fastify';
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseAbi,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { openDatabase } from '../src/db.mjs';
import { buildApi } from '../src/api.mjs';
import { loadConfig } from '../src/config.mjs';
import { hash, verifyWebhook } from '../src/crypto.mjs';
import { REQUIRED_TOKEN, onchainId } from '../src/protocol.mjs';

// Explicit opt-in: this test only writes to the isolated Anvil fork on port 8550.
test(
  'fork: durable relay, process restart, webhook recovery, refund and budget',
  { skip: process.env.RUN_FORK_TESTS !== '1' },
  async () => {
    mkdirSync('.local', { recursive: true, mode: 0o700 });
    const rpc = 'http://127.0.0.1:8550',
      chain = defineChain({
        id: 1874,
        name: 'Local fork',
        nativeCurrency: { name: 'WBT', symbol: 'WBT', decimals: 18 },
        rpcUrls: { default: { http: [rpc] } },
      });
    const client = createPublicClient({
      chain,
      transport: http(rpc),
      cacheTime: 0,
    });
    const raw = (method, params = []) => client.request({ method, params });
    assert.match(await raw('web3_clientVersion'), /anvil/i);
    assert.equal(await client.getChainId(), 1874);
    const privateKey = generatePrivateKey(),
      relay = privateKeyToAccount(privateKey),
      buyer = privateKeyToAccount(generatePrivateKey()),
      merchant = privateKeyToAccount(generatePrivateKey());
    await raw('anvil_setBalance', [relay.address, '0x56bc75e2d63100000']);
    const wallet = createWalletClient({
        chain,
        account: relay,
        transport: http(rpc),
      }),
      artifact = JSON.parse(readFileSync('artifacts/RelayCheckout.json'));
    const mined = async (hash) => {
      const r = await client.waitForTransactionReceipt({ hash });
      assert.equal(r.status, 'success');
      return r;
    };
    const deployed = await mined(
      await wallet.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: [REQUIRED_TOKEN, relay.address],
      }),
    );
    const tokenAbi = parseAbi([
      'function owner() view returns(address)',
      'function mint(address,uint256)',
      'function balanceOf(address) view returns(uint256)',
    ]);
    const issuer = await client.readContract({
      address: REQUIRED_TOKEN,
      abi: tokenAbi,
      functionName: 'owner',
    });
    await raw('anvil_impersonateAccount', [issuer]);
    await raw('anvil_setBalance', [issuer, '0x56bc75e2d63100000']);
    try {
      await mined(
        await createWalletClient({
          chain,
          account: issuer,
          transport: http(rpc),
        }).writeContract({
          address: REQUIRED_TOKEN,
          abi: tokenAbi,
          functionName: 'mint',
          args: [buyer.address, 10000000n],
        }),
      );
    } finally {
      await raw('anvil_stopImpersonatingAccount', [issuer]);
    }
    writeFileSync(
      '.local/fork-wallet.json',
      JSON.stringify({ privateKey, address: relay.address }),
      { mode: 0o600 },
    );
    writeFileSync(
      '.local/fork-deployment.json',
      JSON.stringify({
        address: deployed.contractAddress,
        blockNumber: Number(deployed.blockNumber),
      }),
      { mode: 0o600 },
    );
    const directory = mkdtempSync('.local/test-');
    process.env.LOCAL_FORK = '1';
    process.env.DB_PATH = directory + '/service.sqlite';
    const config = await loadConfig();
    let db = openDatabase(config.dbPath);
    const apiKey = randomBytes(32).toString('hex'),
      secret = randomBytes(32).toString('hex');
    let down = true,
      deliveries = 0;
    const bookings = new Set();
    const merchantApp = Fastify();
    merchantApp.removeContentTypeParser('application/json');
    merchantApp.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (_, body, done) => done(null, body),
    );
    merchantApp.post('/webhook', async (req, reply) => {
      if (
        !verifyWebhook(
          secret,
          req.headers['x-checkout-timestamp'],
          req.body,
          req.headers['x-checkout-signature'],
        )
      )
        return reply.code(401).send();
      if (down) return reply.code(503).send();
      const event = JSON.parse(req.body);
      deliveries++;
      if (event.type === 'payment.confirmed') bookings.add(event.orderId);
      return { ok: true };
    });
    const url = await merchantApp.listen({ host: '127.0.0.1', port: 0 });
    db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
      'workshops',
      merchant.address,
      hash(apiKey),
      url + '/webhook',
      secret,
      '1000000000000000000',
    );
    let app = buildApi(config, db);
    const headers = { authorization: 'Bearer ' + apiKey };
    const request = async (method, url, payload, auth = false) => {
      const response = await app.inject({
        method,
        url,
        payload,
        headers: auth ? headers : {},
      });
      assert(response.statusCode < 300, `${url}: ${response.body}`);
      return response.json();
    };
    const cycle = () =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['src/worker.mjs', '--once'], {
          env: process.env,
          stdio: ['ignore', 'ignore', 'pipe'],
        });
        let errors = '';
        child.stderr.on('data', (chunk) => {
          errors += chunk;
        });
        child.on('error', reject);
        child.on('exit', (code) =>
          code === 0 ? resolve() : reject(Error(errors)),
        );
      });
    try {
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/v1/checkouts',
            payload: { orderId: 'bad', amount: '1' },
          })
        ).statusCode,
        401,
      );
      const order = await request(
        'POST',
        '/v1/checkouts',
        { orderId: 'workshop-001', amount: '2000000' },
        true,
      );
      assert.equal(
        (
          await request(
            'POST',
            '/v1/checkouts',
            { orderId: 'workshop-001', amount: '2000000' },
            true,
          )
        ).id,
        order.id,
      );
      const auth = await request(
        'POST',
        `/v1/checkouts/${order.id}/authorization`,
        { payer: buyer.address },
      );
      const signature = await buyer.signTypedData(auth);
      const job = await request('POST', `/v1/checkouts/${order.id}/pay`, {
        payer: buyer.address,
        signature,
      });
      assert.equal(
        (
          await request('POST', `/v1/checkouts/${order.id}/pay`, {
            payer: buyer.address,
            signature,
          })
        ).jobId,
        job.jobId,
      );
      await cycle();
      assert.equal(
        db.prepare('SELECT status FROM jobs WHERE id=?').get(job.jobId).status,
        'signed',
      );
      // The process exits with signed bytes durable and no broadcast. A new process resumes them.
      await app.close();
      db.close();
      db = openDatabase(config.dbPath);
      app = buildApi(config, db);
      await cycle();
      await cycle();
      let receipt = await request('GET', `/v1/checkouts/${order.id}`);
      assert.equal(receipt.state, 'paid');
      assert.equal(receipt.fulfillment, 'pending');
      assert.equal(
        db.prepare('SELECT last_http FROM outbox').get().last_http,
        503,
      );
      assert.equal(bookings.size, 0);
      down = false;
      const delivery = db.prepare('SELECT id FROM outbox').get();
      await request(
        'POST',
        `/v1/merchant/deliveries/${encodeURIComponent(delivery.id)}/retry`,
        {},
        true,
      );
      await cycle();
      await request(
        'POST',
        `/v1/merchant/deliveries/${encodeURIComponent(delivery.id)}/retry`,
        {},
        true,
      );
      await cycle();
      assert.equal(bookings.size, 1);
      assert.equal(deliveries, 2);
      await request(
        'POST',
        `/v1/merchant/orders/${order.id}/fulfillment`,
        { state: 'fulfilled' },
        true,
      );
      await mined(
        await wallet.writeContract({
          address: config.router,
          abi: config.abi,
          functionName: 'setPaused',
          args: [true],
        }),
      );
      await assert.rejects(
        client.simulateContract({
          address: config.router,
          abi: config.abi,
          functionName: 'setRelay',
          args: [buyer.address],
          account: buyer.address,
        }),
      );
      await assert.rejects(
        client.simulateContract({
          address: config.router,
          abi: config.abi,
          functionName: 'pay',
          args: [
            onchainId('paused'),
            buyer.address,
            merchant.address,
            2000000n,
            BigInt(auth.message.validBefore),
            signature,
          ],
          account: relay.address,
        }),
      );
      const refund = await request(
        'POST',
        `/v1/merchant/orders/${order.id}/refunds`,
        { refundId: 'partial-1', amount: '500000' },
        true,
      );
      await request(
        'POST',
        `/v1/merchant/refunds/${refund.id}/submit`,
        { signature: await merchant.signTypedData(refund.authorization) },
        true,
      );
      await cycle();
      await cycle();
      await cycle();
      receipt = await request('GET', `/v1/checkouts/${order.id}`);
      assert.equal(receipt.state, 'partially_refunded');
      assert.equal(receipt.refunded, '500000');
      assert.equal(receipt.fulfillment, 'fulfilled');
      assert.equal(await client.getBalance({ address: buyer.address }), 0n);
      assert.equal(await client.getBalance({ address: merchant.address }), 0n);
      assert.equal(
        await client.readContract({
          address: REQUIRED_TOKEN,
          abi: tokenAbi,
          functionName: 'balanceOf',
          args: [merchant.address],
        }),
        1500000n,
      );
      assert.equal(
        await client.readContract({
          address: REQUIRED_TOKEN,
          abi: tokenAbi,
          functionName: 'balanceOf',
          args: [config.router],
        }),
        0n,
      );
      await mined(
        await wallet.writeContract({
          address: config.router,
          abi: config.abi,
          functionName: 'setPaused',
          args: [false],
        }),
      );
      db.prepare(
        "UPDATE merchants SET daily_gas_budget='0' WHERE id='workshops'",
      ).run();
      const limited = await request(
        'POST',
        '/v1/checkouts',
        { orderId: 'budget-limited', amount: '1000000' },
        true,
      );
      const limitedAuth = await request(
        'POST',
        `/v1/checkouts/${limited.id}/authorization`,
        { payer: buyer.address },
      );
      const limitedJob = await request(
        'POST',
        `/v1/checkouts/${limited.id}/pay`,
        {
          payer: buyer.address,
          signature: await buyer.signTypedData(limitedAuth),
        },
      );
      await cycle();
      assert.equal(
        db.prepare('SELECT error FROM jobs WHERE id=?').get(limitedJob.jobId)
          .error,
        'MERCHANT_GAS_BUDGET',
      );
      writeFileSync(
        directory + '/result.json',
        JSON.stringify(
          {
            scope: 'local Anvil fork; owner-minted test fixture',
            router: config.router,
            paymentAndRefund: receipt.timeline,
            restartedProcesses: true,
            duplicateDeliveries: deliveries,
            bookings: bookings.size,
            buyerWbt: '0',
            merchantWbt: '0',
            refundWhilePaused: true,
            gasBudgetEnforced: true,
          },
          null,
          2,
        ),
      );
      console.log('Evidence: ' + directory + '/result.json');
    } finally {
      await app.close();
      await merchantApp.close();
      db.close();
    }
  },
);
