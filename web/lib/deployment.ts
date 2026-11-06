// Evaluated on the Next.js server. No secret values cross the component boundary.
export function exampleShopEnabled() {
  return (
    !process.env.CHECKOUT_API_ORIGIN ||
    Boolean(process.env.CHECKOUT_MERCHANT_ORIGIN)
  );
}

export function examplePreviewEnabled() {
  return (
    !process.env.CHECKOUT_API_ORIGIN ||
    process.env.CHECKOUT_PREVIEW_ENABLED === '1'
  );
}
