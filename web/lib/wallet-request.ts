/** Bound extension requests without allowing a late response to resume the flow. */
export function walletRequest<T>(
  request: () => Promise<T>,
  timeoutMs = 60_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            'Your wallet has not responded. Open your wallet extension and approve or dismiss its pending request, then try again.',
          ),
        ),
      timeoutMs,
    );
    Promise.resolve()
      .then(request)
      .then(resolve, (error: unknown) => {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? error.code
            : undefined;
        reject(
          code === -32002
            ? new Error(
                'A request is already open in your wallet. Open the extension and approve or dismiss it before trying again.',
              )
            : error,
        );
      })
      .finally(() => clearTimeout(timer));
  });
}
