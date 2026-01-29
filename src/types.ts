export type WebhookProvider = 'paystack' | 'flutterwave';

/**
 * Generic header map.
 *
 * Note: some frameworks expose headers as string[]; keep this flexible.
 */
export type HttpHeaders = Record<string, string | string[] | undefined>;

export type WebhookVerificationSuccess<TPayload, TProvider extends WebhookProvider = WebhookProvider> = {
  ok: true;
  provider: TProvider;
  payload: TPayload;
};

export type WebhookVerificationFailure<TProvider extends WebhookProvider = WebhookProvider> = {
  ok: false;
  provider?: TProvider;
  code: string;
  message: string;
};

export type WebhookVerificationResult<TPayload, TProvider extends WebhookProvider = WebhookProvider> =
  | WebhookVerificationSuccess<TPayload, TProvider>
  | WebhookVerificationFailure<TProvider>;
