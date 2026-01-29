import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { payhookMiddleware } from '../../integrations/express.js';

const PAYSTACK_SECRET = 'sk_test_express';
const FLUTTERWAVE_SECRET_HASH = 'flw_express_hash';

function signPaystack(body: string, secret: string): string {
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}

const PAYSTACK_BODY = JSON.stringify({
  event: 'charge.success',
  data: { id: 10, reference: 'ref_10', amount: 50000 }
});

const FLUTTERWAVE_BODY = JSON.stringify({
  event: 'charge.completed',
  data: { id: 20, tx_ref: 'tx_10', amount: 5000 }
});

function createMockReqResNext(body: string | Buffer, headers: Record<string, string>) {
  const req: any = {
    body: typeof body === 'string' ? Buffer.from(body) : body,
    headers,
  };

  const res: any = {
    statusCode: 200,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json: vi.fn(),
  };

  const next = vi.fn();

  return { req, res, next };
}

describe('payhookMiddleware (Express integration)', () => {
  it('should attach webhook payload to req.webhook on success', async () => {
    const sig = signPaystack(PAYSTACK_BODY, PAYSTACK_SECRET);
    const { req, res, next } = createMockReqResNext(PAYSTACK_BODY, {
      'x-paystack-signature': sig,
    });

    const middleware = payhookMiddleware({ paystackSecret: PAYSTACK_SECRET });
    await middleware(req, res, next);

    expect(req.webhook).toBeDefined();
    expect(req.webhook.event).toBe('charge.success');
    expect(next).toHaveBeenCalledWith();
  });

  it('should respond with 400 on invalid signature', async () => {
    const { req, res, next } = createMockReqResNext(PAYSTACK_BODY, {
      'x-paystack-signature': 'bad_sig',
    });

    const middleware = payhookMiddleware({ paystackSecret: PAYSTACK_SECRET });
    await middleware(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'PAYHOOK_INVALID_SIGNATURE' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should respond with 400 when provider is unknown', async () => {
    const { req, res, next } = createMockReqResNext(PAYSTACK_BODY, {});

    const middleware = payhookMiddleware({ paystackSecret: PAYSTACK_SECRET });
    await middleware(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'PAYHOOK_UNKNOWN_PROVIDER' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should work with Flutterwave webhooks', async () => {
    const { req, res, next } = createMockReqResNext(FLUTTERWAVE_BODY, {
      'verif-hash': FLUTTERWAVE_SECRET_HASH,
    });

    const middleware = payhookMiddleware({ flutterwaveSecretHash: FLUTTERWAVE_SECRET_HASH });
    await middleware(req, res, next);

    expect(req.webhook).toBeDefined();
    expect(req.webhook.event).toBe('charge.completed');
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next(err) on unexpected errors', async () => {
    const { req, res, next } = createMockReqResNext(PAYSTACK_BODY, {
      'x-paystack-signature': 'sig',
    });
    // Make body throw when accessed to simulate an unexpected error
    Object.defineProperty(req, 'body', {
      get() { throw new Error('body read error'); }
    });

    const middleware = payhookMiddleware({ paystackSecret: PAYSTACK_SECRET });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
