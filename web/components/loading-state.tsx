export function LoadingState({
  label = 'Loading...',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={'loading-state' + (compact ? ' compact' : '')}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="loading-caption">
        <span className="loading-spinner" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="skeleton-layout" aria-hidden="true">
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
        <div className="skeleton-card" />
      </div>
      <span className="sr-only">
        Please wait. This page updates automatically.
      </span>
    </section>
  );
}
