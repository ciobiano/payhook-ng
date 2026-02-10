import type { PayhookErrorCode } from './errors.js';

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

/**
 * `code` is now the PayhookErrorCode union, not a bare `string`.
 *
 * This means consumers can exhaustively switch on error codes and TypeScript
 * will catch typos at compile time. If you add a new error code to the union,
 * every switch statement that doesn't handle it will get a type error.
 */
export type WebhookVerificationFailure<TProvider extends WebhookProvider = WebhookProvider> = {
  ok: false;
  provider?: TProvider;
  code: PayhookErrorCode;
  message: string;
};

export type WebhookVerificationResult<TPayload, TProvider extends WebhookProvider = WebhookProvider> =
  | WebhookVerificationSuccess<TPayload, TProvider>
  | WebhookVerificationFailure<TProvider>;
