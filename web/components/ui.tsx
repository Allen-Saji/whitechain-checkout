'use client';
export function ErrorNotice({ message }: { message: string | null }) {
  return message ? (
    <div className="app-message" role="alert">
      {message}
    </div>
  ) : null;
}
export function PrintButton({
  className = 'button button-outline',
  children = 'Print receipt',
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button className={className} onClick={() => window.print()}>
      {children}
    </button>
  );
}
export function CopyButton({
  text,
  label = 'Copy',
}: {
  text: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async (event) => {
        const button = event.currentTarget;
        try {
          await navigator.clipboard.writeText(text);
          button.textContent = 'Copied';
        } catch {
          button.textContent = 'Select code to copy';
        }
      }}
    >
      {label}
    </button>
  );
}
