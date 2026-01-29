export type PaystackWebhook =
  | PaystackChargeSuccessWebhook
  | { event: 'transfer.success'; data: unknown }
  | { event: string & {}; data: unknown };

/**
 * Common Paystack event names.
 *
 * This is not exhaustive; keep it extensible.
 */
export type PaystackEventType =
  | 'charge.success'
  | 'charge.failed'
  | 'subscription.create'
  | 'subscription.disable'
  | 'subscription.enable'
  | 'transfer.success'
  | 'transfer.failed'
  | 'transfer.reversed'
  | (string & {});

export type PaystackChargeSuccessWebhook = {
  event: 'charge.success';
  data: PaystackChargeData;
};

export type PaystackChargeData = {
  id: number;
  domain?: 'test' | 'live' | (string & {});
  status?: string;
  reference: string;
  amount: number;
  currency?: string;

  channel?: string;
  gateway_response?: string;
  paid_at?: string;
  created_at?: string;

  fees?: number;
  requested_amount?: number;

  metadata?: unknown;

  customer?: PaystackCustomer;
  authorization?: PaystackAuthorization;
};

export type PaystackCustomer = {
  id?: number;
  customer_code?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

export type PaystackAuthorization = {
  authorization_code?: string;
  bin?: string;
  last4?: string;
  exp_month?: string;
  exp_year?: string;
  channel?: string;
  card_type?: string;
  bank?: string;
  country_code?: string;
  brand?: string;
  reusable?: boolean;
  signature?: string;
  account_name?: string | null;
};
