'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage, errorStatus } from '@/lib/api';
import type { MerchantSettings } from '@/lib/types';
import { ErrorNotice } from './ui';
import { LoadingState } from './loading-state';
import { Credential } from './credentials';
export function Settings() {
  const [data, setData] = useState<MerchantSettings | null>(null),
    [name, setName] = useState(''),
    [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [unauthorized, setUnauthorized] = useState(false);
  const [credential, setCredential] = useState<{
    credential: 'apiKey' | 'webhookSecret';
    value: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    api<MerchantSettings>('/v1/merchant/settings')
      .then((p) => {
        if (alive) {
          setData(p);
          setName(p.businessName);
          setUrl(p.webhookUrl);
        }
      })
      .catch((e) => {
        if (alive) {
          if (errorStatus(e) === 401) setUnauthorized(true);
          else setError(errorMessage(e));
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const p = await api<MerchantSettings>('/v1/merchant/settings', {
        businessName: name.trim(),
        webhookUrl: url.trim(),
      });
      setData(p);
      setName(p.businessName);
      setUrl(p.webhookUrl);
      setNotice(
        'Settings saved. Check the connection to activate your integration.',
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function check() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const p = await api<MerchantSettings>('/v1/merchant/webhook/check', {});
      setData(p);
      setNotice(
        p.webhookVerifiedAt
          ? 'Your endpoint accepted the signed connection check.'
          : 'The connection check failed. Review the delivery result below.',
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function rotate(kind: 'apiKey' | 'webhookSecret') {
    if (
      !window.confirm(
        kind === 'apiKey'
          ? 'Replace the API key? The current key will stop working immediately.'
          : 'Replace the webhook signing secret? Update your receiver before checking the connection again.',
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      setCredential(
        await api('/v1/merchant/credentials/rotate', { credential: kind }),
      );
      setData(await api<MerchantSettings>('/v1/merchant/settings'));
      setNotice(
        'Credential replaced. Save the new value in your server configuration.',
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (unauthorized)
    return (
      <section className="empty-state">
        <h1>
          Your integration
          <br />
          <em>starts here.</em>
        </h1>
        <p>
          Sign in with your merchant payout wallet to manage your connection and
          credentials.
        </p>
        <Link className="button button-primary" href="/merchant">
          Sign in
        </Link>
        <Link className="text-link access-preview" href="/register">
          Create an account
        </Link>
      </section>
    );
  if (!data)
    return (
      <>
        <ErrorNotice message={error} />
        <LoadingState label="Loading integration settings" />
        {error ? (
          <button
            className="button button-outline"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        ) : null}
      </>
    );
  const dirty =
    name.trim() !== data.businessName || url.trim() !== data.webhookUrl;
  return (
    <>
      <ErrorNotice message={error} />
      <Link href="/merchant" className="back-link">
        &#8592; Workspace
      </Link>
      <div className="workspace-title">
        <div>
          <p className="app-kicker">INTEGRATION SETTINGS</p>
          <h1>
            Your business.
            <br />
            <em>Connected.</em>
          </h1>
          <p className="app-lede">
            Manage where payments arrive and how your server hears about them.
          </p>
        </div>
        <span
          className={'status-pill ' + (data.webhookVerifiedAt ? 'success' : '')}
        >
          {data.webhookVerifiedAt ? 'Connected' : 'Setup required'}
        </span>
      </div>
      {notice ? (
        <p className="workspace-mode" role="status">
          {notice}
        </p>
      ) : null}
      <div className="setup-grid">
        <section className="settings-form">
          <form onSubmit={save}>
            <label htmlFor="settings-name">Business name</label>
            <input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={80}
              required
            />
            <label htmlFor="payout-wallet">Payout wallet</label>
            <input id="payout-wallet" readOnly value={data.payout} />
            <p className="fine-print">
              This wallet owns your account and receives payments. Changing
              payout wallets is not supported yet.
            </p>
            <label htmlFor="webhook-url">Notification endpoint</label>
            <input
              id="webhook-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-business.com/webhook"
              required
              maxLength={2000}
            />
            <p className="fine-print">
              Use a public HTTPS endpoint. Verify signed events and return a
              successful response after durable acceptance.
            </p>
            <button className="button button-primary" disabled={busy || !dirty}>
              {busy ? 'Please wait...' : 'Save settings'}
            </button>
          </form>
          <section className="settings-section">
            <h2>Connection check</h2>
            <p>
              Send an <code>integration.check</code> event to your saved
              endpoint. This does not create an order or move funds.
            </p>
            <button
              className="button button-outline"
              disabled={busy || dirty || !data.webhookUrl}
              onClick={check}
            >
              Send connection check
            </button>
            {data.webhookCheckedAt ? (
              <dl className="simple-facts">
                <div>
                  <dt>Last check</dt>
                  <dd>{new Date(data.webhookCheckedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>HTTP response</dt>
                  <dd>{data.webhookLastHttp ?? 'No response'}</dd>
                </div>
                <div>
                  <dt>Result</dt>
                  <dd>
                    {data.webhookLastError
                      ? data.webhookLastError === 'WEBHOOK_HTTP_ERROR'
                        ? 'Endpoint returned an unsuccessful response'
                        : 'Could not reach a permitted endpoint'
                      : data.webhookVerifiedAt
                        ? 'Accepted'
                        : 'Not verified'}
                  </dd>
                </div>
              </dl>
            ) : null}
          </section>
        </section>
        <aside className="purchase-card settings-form">
          <p className="app-kicker">SERVER CREDENTIALS</p>
          <h2>
            Keep the keys
            <br />
            on your server.
          </h2>
          <p>
            The API key creates checkouts. The webhook secret verifies incoming
            events. Existing values are never returned by the settings API.
          </p>
          <div className="settings-section">
            <h3>API key</h3>
            <button
              className="button button-outline full-width"
              disabled={busy}
              onClick={() => rotate('apiKey')}
            >
              Replace API key
            </button>
          </div>
          <div className="settings-section">
            <h3>Webhook signing secret</h3>
            <button
              className="button button-outline full-width"
              disabled={busy}
              onClick={() => rotate('webhookSecret')}
            >
              Replace signing secret
            </button>
          </div>
          {credential ? (
            <>
              <Credential
                label={
                  credential.credential === 'apiKey'
                    ? 'New API key'
                    : 'New webhook secret'
                }
                value={credential.value}
              />
              <button className="text-link" onClick={() => setCredential(null)}>
                I have saved this credential
              </button>
            </>
          ) : null}
          <Link className="text-link access-preview" href="/docs/webhooks">
            Notification integration guide &#8599;
          </Link>
        </aside>
      </div>
    </>
  );
}
