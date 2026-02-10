export type FlutterwaveWebhook =
  | FlutterwaveChargeCompletedWebhook
  | { event: 'transfer.completed'; data: unknown }
  | { event: string & {}; data: unknown };

/**
 * Common Flutterwave event names.
 *
 * This is not exhaustive; keep it extensible.
 */
export type FlutterwaveEventType =
  | 'charge.completed'
  | 'transfer.completed'
  | (string & {});

export type FlutterwaveChargeCompletedWebhook = {
  event: 'charge.completed';
  data: FlutterwaveChargeData;
  'event.type'?: string; // Flutterwave sometimes sends this
};

export type FlutterwaveChargeData = {
  id: number;
  tx_ref: string;
  flw_ref: string;
  device_fingerprint: string;
  amount: number;
  currency: string;
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  processor_response: string;
  auth_model: string;
  ip: string;
  status: string;
  payment_type: string;
  created_at: string;
  account_id: number;
  customer: FlutterwaveCustomer;
  card?: FlutterwaveCard;
};

export type FlutterwaveCustomer = {
  id: number;
  name: string;
  phone_number: string | null;
  email: string;
  created_at: string;
};

export type FlutterwaveCard = {
  first_6digits: string;
  last_4digits: string;
  issuer: string;
  country: string;
  type: string;
  expiry: string;
};
