import type { Address, Hex, TypedData } from 'viem';
export interface Config {
  relayEnabled: boolean;
  registrationEnabled: boolean;
  chainId: number;
  token: Address;
  router: Address;
  decimals: number;
  local: boolean;
}
export interface Receipt {
  title: string;
  description: string;
  merchantName: string;
  id: string;
  orderId: string;
  amount: string;
  merchant: Address;
  buyer: Address | null;
  state: string;
  refunded: string;
  fulfillment: string;
  expiresAt: number;
  paymentJob?: {
    status: string;
    error: string | null;
    transactionHash: Hex | null;
  } | null;
  timeline: { type: string; transactionHash: Hex; blockNumber: number }[];
}
export interface Merchant {
  id: string;
  payout: Address;
}
export interface Session {
  merchant: Merchant;
}
export interface Order {
  title?: string;
  merchant_name?: string;
  recovery?: { retryable: boolean; reason: string | null };
  paymentError?: string | null;
  id: string;
  external_id: string;
  amount: string;
  refunded: string;
  state: string;
  fulfillment: string;
  buyer: Address | null;
  created_at: number;
}
export interface Delivery {
  id: string;
  checkout_id: string;
  status: string;
  attempts: number;
  last_http: number | null;
}
export interface Workspace {
  merchant: Merchant;
  orders: Order[];
  deliveries: Delivery[];
  readOnly: boolean;
}
export interface Authorization {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  types: TypedData;
  primaryType: string;
  message: {
    from: Address;
    to: Address;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: Hex;
  };
}

export interface MerchantSettings {
  id: string;
  payout: Address;
  businessName: string;
  webhookUrl: string;
  webhookVerifiedAt: number | null;
  webhookCheckedAt: number | null;
  webhookLastHttp: number | null;
  webhookLastError: string | null;
  dailyGasBudget: string;
}
export interface MerchantCredentials {
  apiKey: string;
  webhookSecret: string;
}

export interface RefundSummary {
  reserved: string;
  available: string;
  refunds: {
    id: string;
    external_id: string;
    amount: string;
    deadline: number;
    status: string;
  }[];
}
