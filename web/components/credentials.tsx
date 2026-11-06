'use client';
import { useState } from 'react';
export function Credential({ label, value }: { label: string; value: string }) {
  const [visible, setVisible] = useState(false),
    [copied, setCopied] = useState(false),
    [error, setError] = useState(false);
  return (
    <div className="credential-field">
      <label>
        {label}
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          readOnly
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="credential-actions">
        <button
          type="button"
          className="text-link"
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
        <button
          type="button"
          className="text-link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setError(false);
            } catch {
              setError(true);
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {error ? (
        <p role="status">
          Copy is unavailable. Show and select the credential to copy it
          manually.
        </p>
      ) : null}
    </div>
  );
}
