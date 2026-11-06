'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import type {
  Config,
  MerchantCredentials,
  MerchantSettings,
} from '@/lib/types';
import { registerMerchant } from '@/lib/wallet';
import { ErrorNotice } from './ui';
import { Credential } from './credentials';
export function Registration() {
  const [name, setName] = useState(''),
    [enabled, setEnabled] = useState<boolean | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState('');
  const [result, setResult] = useState<{
      merchant: MerchantSettings;
      credentials: MerchantCredentials;
    } | null>(null),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    let alive = true;
    api<Config>('/v1/config')
      .then((c) => {
        if (alive) setEnabled(c.registrationEnabled);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !enabled) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await registerMerchant(name.trim(), setProgress));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ErrorNotice message={error} />
      <div className="access-grid">
        <section>
          <p className="app-kicker">CREATE YOUR MERCHANT ACCOUNT</p>
          <h1>
            Create your
            <br />
            <em>merchant account.</em>
          </h1>
          <p className="app-lede">
            Accept USDT in your app and manage payments from your workspace.
          </p>
          <ol className="access-features">
            <li>
              <span>01</span> Create your account with a wallet signature.
            </li>
            <li>
              <span>02</span> Save your API key and webhook secret.
            </li>
            <li>
              <span>03</span> Connect your app to receive payment updates.
            </li>
          </ol>
          <Link className="text-link" href="/docs/quickstart">
            Read the integration guide &#8599;
          </Link>
        </section>
        <aside className="purchase-card settings-form">
          {result ? (
            <>
              <p className="app-kicker">ACCOUNT CREATED</p>
              <h2>{result.merchant.businessName}</h2>
              <p>
                Save these credentials in your server&apos;s secret store. They
                are shown once and are not saved in browser storage.
              </p>
              <Credential
                label="Merchant API key"
                value={result.credentials.apiKey}
              />
              <Credential
                label="Webhook signing secret"
                value={result.credentials.webhookSecret}
              />
              <label className="confirm-check">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                />
                I have saved both credentials.
              </label>
              {saved ? (
                <Link
                  className="button button-primary full-width"
                  href="/merchant/settings"
                >
                  Set up your integration &#8594;
                </Link>
              ) : (
                <button disabled className="button button-primary full-width">
                  Save credentials to continue
                </button>
              )}
            </>
          ) : (
            <form onSubmit={submit}>
              <p className="app-kicker">BUSINESS DETAILS</p>
              <h2>Business details</h2>
              <label htmlFor="business-name">Business name</label>
              <input
                id="business-name"
                disabled={busy}
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={80}
                autoComplete="organization"
                required
                placeholder="Your business"
              />
              <p className="fine-print">
                Connect the wallet that should receive payments. You&apos;ll
                sign a registration message, not a transaction.
              </p>
              <button
                className="button button-primary full-width"
                disabled={busy || !enabled}
              >
                {busy
                  ? 'Check your wallet...'
                  : enabled === null
                    ? error
                      ? 'Service unavailable'
                      : 'Checking availability...'
                    : 'Connect wallet and create account'}
              </button>
              {busy ? (
                <p className="fine-print" role="status" aria-live="polite">
                  {progress}
                </p>
              ) : null}
              {enabled === false ? (
                <p className="fine-print" role="status">
                  New account registration is currently unavailable. Existing
                  merchants can still sign in.
                </p>
              ) : null}
              <p className="access-preview">
                Already registered?{' '}
                <Link className="text-link" href="/merchant">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
