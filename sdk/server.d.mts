export interface CheckoutOrder {
  id: string;
  orderId: string;
  amount: string;
  title: string;
  description: string;
  merchantName: string;
  merchant: `0x${string}`;
  buyer: `0x${string}` | null;
  checkoutUrl: string | null;
  state: string;
  refunded: string;
  fulfillment: string;
  expiresAt: number;
  chainId: number;
  token: `0x${string}`;
}
export interface RefundSummary {
  available: string;
  reserved: string;
  refunds: Array<{
    id: string;
    external_id: string;
    amount: string;
    deadline: number;
    status: string;
  }>;
}
export interface TokenAuthorization {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  primaryType: string;
  types: Record<string, Array<{ name: string; type: string }>>;
  message: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: `0x${string}`;
  };
}
export function checkoutClient(options: { baseUrl: string; apiKey: string }): {
  create(input: {
    orderId: string;
    amount: string;
    title?: string;
    description?: string;
    expiresIn?: number;
  }): Promise<CheckoutOrder>;
  get(id: string): Promise<CheckoutOrder>;
  fulfill(
    id: string,
    state?: 'fulfilled' | 'unavailable',
  ): Promise<{ id: string; fulfillment: string }>;
  refund(input: {
    checkoutId: string;
    refundId: string;
    amount: string;
  }): Promise<{ id: string; authorization: TokenAuthorization }>;
  submitRefund(
    id: string,
    signature: `0x${string}`,
  ): Promise<{ id?: string; status: string }>;
  cancelRefund(id: string): Promise<{ id: string; status: string }>;
  refunds(id: string): Promise<RefundSummary>;
  retryPayment(id: string): Promise<{ jobId: string; status: string }>;
};
export function verifyWebhook(
  secret: string,
  timestamp: string | undefined,
  body: string,
  signature: string | undefined,
  now?: number,
): boolean;
