export type PayhookErrorCode =
  | 'PAYHOOK_MISSING_HEADER'
  | 'PAYHOOK_INVALID_SIGNATURE'
  | 'PAYHOOK_INVALID_JSON'
  | 'PAYHOOK_REPLAY_ATTACK'
  | 'PAYHOOK_STALE_EVENT';

export class PayhookError extends Error {
  readonly code: PayhookErrorCode;
  override readonly cause?: unknown;

  constructor(message: string, opts: { code: PayhookErrorCode; cause?: unknown }) {
    super(message);
    this.name = this.constructor.name;
    this.code = opts.code;
    this.cause = opts.cause;
  }
}

export class MissingHeaderError extends PayhookError {
  readonly headerName: string;

  constructor(headerName: string) {
    super(`Missing required header: ${headerName}`, { code: 'PAYHOOK_MISSING_HEADER' });
    this.headerName = headerName;
  }
}

export class InvalidSignatureError extends PayhookError {
  constructor(message = 'Invalid webhook signature', cause?: unknown) {
    super(message, { code: 'PAYHOOK_INVALID_SIGNATURE', cause });
  }
}

export class InvalidJsonError extends PayhookError {
  constructor(message = 'Invalid JSON payload', cause?: unknown) {
    super(message, { code: 'PAYHOOK_INVALID_JSON', cause });
  }
}

export class ReplayAttackError extends PayhookError {
  constructor(message = 'Replay attack detected: This event has already been processed.') {
    super(message, { code: 'PAYHOOK_REPLAY_ATTACK' });
  }
}
