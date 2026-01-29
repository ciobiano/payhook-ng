import { verify } from '../index.js';
import type { PayhookConfig } from '../index.js';
import type { HttpHeaders } from '../types.js';

// Minimal Express types (no dependency on @types/express)
interface ExpressRequest {
  body: Buffer | string;
  headers: Record<string, string | string[] | undefined>;
  webhook?: any;
}
interface ExpressResponse {
  status(code: number): ExpressResponse;
  json(body: any): void;
}
type NextFunction = (err?: any) => void;

export function payhookMiddleware(config: PayhookConfig) {
  return async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    try {
      const rawBody = req.body; // Must be Buffer (use express.raw())
      const headers = req.headers as HttpHeaders;
      const result = await verify(rawBody, headers, config);

      if (!result.ok) {
        res.status(400).json({ error: result.code, message: result.message });
        return;
      }

      req.webhook = result.payload;
      next();
    } catch (err) {
      next(err);
    }
  };
}
