'use client';
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="wrap app-main">
      <h1>We could not load this page.</h1>
      <p>Try again to check the latest status.</p>
      <button className="button button-outline" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
