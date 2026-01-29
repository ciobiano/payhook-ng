import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyPaystackRequest } from '../../paystack/request.js';
import { verifyFlutterwaveRequest } from '../../flutterwave/request.js';
import { withPayhook } from '../../integrations/nextjs.js';

const PAYSTACK_SECRET = 'sk_test_integration';
const FLUTTERWAVE_SECRET_HASH = 'flw_integration_hash';

function signPaystack(body: string, secret: string): string {
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}

function createRequest(body: string, headers: Record<string, string>): Request {
  return new Request('https://example.com/webhooks', {
    method: 'POST',
    headers,
    body,
  });
}

const PAYSTACK_BODY = JSON.stringify({
  event: 'charge.success',
  data: { id: 1, reference: 'ref_1', amount: 50000 }
});

const FLUTTERWAVE_BODY = JSON.stringify({
  event: 'charge.completed',
  data: { id: 2, tx_ref: 'tx_1', amount: 5000 }
});

describe('verifyPaystackRequest (Next.js integration)', () => {
  it('should verify a valid Paystack request', async () => {
    const sig = signPaystack(PAYSTACK_BODY, PAYSTACK_SECRET);
    const req = createRequest(PAYSTACK_BODY, { 'x-paystack-signature': sig });

    const result = await verifyPaystackRequest(req, PAYSTACK_SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('paystack');
      expect(result.payload.event).toBe('charge.success');
    }
  });

  it('should reject an invalid Paystack request', async () => {
    const req = createRequest(PAYSTACK_BODY, { 'x-paystack-signature': 'bad' });

    const result = await verifyPaystackRequest(req, PAYSTACK_SECRET);
    expect(result.ok).toBe(false);
  });
});

describe('verifyFlutterwaveRequest (Next.js integration)', () => {
  it('should verify a valid Flutterwave request', async () => {
    const req = createRequest(FLUTTERWAVE_BODY, { 'verif-hash': FLUTTERWAVE_SECRET_HASH });

    const result = await verifyFlutterwaveRequest(req, FLUTTERWAVE_SECRET_HASH);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('flutterwave');
      expect(result.payload.event).toBe('charge.completed');
    }
  });

  it('should reject an invalid Flutterwave request', async () => {
    const req = createRequest(FLUTTERWAVE_BODY, { 'verif-hash': 'wrong' });

    const result = await verifyFlutterwaveRequest(req, FLUTTERWAVE_SECRET_HASH);
    expect(result.ok).toBe(false);
  });
});

describe('withPayhook (Next.js wrapper)', () => {
  it('should pass verified payload to handler on success', async () => {
    const sig = signPaystack(PAYSTACK_BODY, PAYSTACK_SECRET);
    const req = createRequest(PAYSTACK_BODY, { 'x-paystack-signature': sig });

    const handler = withPayhook(
      { paystackSecret: PAYSTACK_SECRET },
      async (payload) => {
        expect(payload.event).toBe('charge.success');
        return new Response('ok');
      }
    );

    const res = await handler(req);
    expect(res.status).toBe(200);
  });

  it('should return 400 on verification failure', async () => {
    const req = createRequest(PAYSTACK_BODY, { 'x-paystack-signature': 'invalid' });

    const handler = withPayhook(
      { paystackSecret: PAYSTACK_SECRET },
      async () => new Response('ok')
    );

    const res = await handler(req);
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('PAYHOOK_INVALID_SIGNATURE');
  });

  it('should return 400 when provider cannot be detected', async () => {
    const req = createRequest(PAYSTACK_BODY, {});

    const handler = withPayhook(
      { paystackSecret: PAYSTACK_SECRET },
      async () => new Response('ok')
    );

    const res = await handler(req);
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('PAYHOOK_UNKNOWN_PROVIDER');
  });
});
