# PayHook.ng -- Complete Codebase Deep-Dive

A line-by-line walkthrough of every file, every design decision, and every
concept behind this library.  Written so you can read it once and confidently
explain the entire project to an audience.

---

## Table of Contents

1. [What is PayHook.ng?](#1-what-is-payhookng)
2. [The Problem it Solves](#2-the-problem-it-solves)
3. [Project Structure -- Bird's Eye View](#3-project-structure----birds-eye-view)
4. [How the Package is Configured](#4-how-the-package-is-configured)
   - 4.1 [package.json -- Exports, Scripts, and Keywords](#41-packagejson)
   - 4.2 [tsconfig.json -- TypeScript Settings](#42-tsconfigjson)
   - 4.3 [vitest.config.ts -- Test Runner](#43-vitestconfigts)
5. [Core Types -- The Foundation](#5-core-types----the-foundation)
   - 5.1 [src/types.ts](#51-srctypests)
6. [Error System](#6-error-system)
   - 6.1 [src/errors.ts](#61-srcerrorsts)
7. [Paystack Module -- Line by Line](#7-paystack-module----line-by-line)
   - 7.1 [src/paystack/types.ts -- Webhook Payload Types](#71-srcpaystacktypests)
   - 7.2 [src/paystack/verify.ts -- Signature Verification](#72-srcpaystackverifysts)
   - 7.3 [src/paystack/request.ts -- Next.js Helper](#73-srcpaystackrequestts)
   - 7.4 [src/paystack/index.ts -- Barrel Export](#74-srcpaystackindexts)
8. [Flutterwave Module -- Line by Line](#8-flutterwave-module----line-by-line)
   - 8.1 [src/flutterwave/types.ts -- Webhook Payload Types](#81-srcflutterwavetypests)
   - 8.2 [src/flutterwave/verify.ts -- Hash Verification](#82-srcflutterwaveverifysts)
   - 8.3 [src/flutterwave/request.ts -- Next.js Helper](#83-srcflutterwaverequestts)
   - 8.4 [src/flutterwave/index.ts -- Barrel Export](#84-srcflutterwaveindexts)
9. [Security Module -- Replay Prevention](#9-security-module----replay-prevention)
   - 9.1 [src/security/types.ts -- IdempotencyStore Interface](#91-srcsecuritytypests)
   - 9.2 [src/security/memory-store.ts -- In-Memory Store](#92-srcsecuritymemory-storets)
   - 9.3 [src/security/redis-store.ts -- Redis Store](#93-srcsecurityredis-storets)
10. [The Unified API -- src/index.ts](#10-the-unified-api----srcindexts)
    - 10.1 [Re-exports](#101-re-exports)
    - 10.2 [PayhookConfig Type](#102-payhookconfig-type)
    - 10.3 [verify() -- Auto-Detection, Idempotency, Timestamps](#103-verify----auto-detection-idempotency-timestamps)
    - 10.4 [createPayhook() -- Factory Pattern](#104-createpayhook----factory-pattern)
    - 10.5 [Helper Functions](#105-helper-functions)
11. [Framework Integrations](#11-framework-integrations)
    - 11.1 [src/integrations/nextjs.ts -- withPayhook()](#111-srcintegrationsnextjsts)
    - 11.2 [src/integrations/express.ts -- payhookMiddleware()](#112-srcintegrationsexpressts)
12. [The Test Suite -- Every Test Explained](#12-the-test-suite----every-test-explained)
    - 12.1 [Paystack Verification Tests](#121-paystack-verification-tests)
    - 12.2 [Flutterwave Verification Tests](#122-flutterwave-verification-tests)
    - 12.3 [Unified API Tests](#123-unified-api-tests)
    - 12.4 [Memory Store Tests](#124-memory-store-tests)
    - 12.5 [Next.js Integration Tests](#125-nextjs-integration-tests)
    - 12.6 [Express Integration Tests](#126-express-integration-tests)
13. [Key Design Patterns Used](#13-key-design-patterns-used)
14. [Security Concepts Explained](#14-security-concepts-explained)
15. [Data Flow Diagrams](#15-data-flow-diagrams)
16. [Glossary](#16-glossary)

---

## 1. What is PayHook.ng?

PayHook.ng is a **TypeScript library** that verifies incoming webhook requests
from African payment providers -- specifically **Paystack** and **Flutterwave**.

When a customer pays on your website, the payment provider sends an HTTP POST
request to a URL you configure (called a "webhook endpoint"). This POST
contains JSON data about the payment.  **The critical question is: how do you
know that POST actually came from Paystack/Flutterwave and not from an
attacker?**

That is what PayHook.ng does.  It verifies the cryptographic signature (or
secret hash) attached to the webhook, parses the JSON, and optionally prevents
replay attacks.

---

## 2. The Problem it Solves

Without this library, every developer handling webhooks must:

1. Read the raw request body (not the parsed JSON -- parsing changes bytes)
2. Extract the signature from HTTP headers
3. Compute an HMAC-SHA512 hash (Paystack) or compare a secret hash (Flutterwave)
4. Handle timing-safe comparison to prevent timing attacks
5. Parse the JSON body
6. Handle all the error cases (missing headers, bad JSON, wrong signature)
7. Optionally track event IDs to prevent replay attacks

That is a lot of boilerplate, and getting any step wrong is a security
vulnerability.  PayHook.ng wraps all of this into a single function call.

---

## 3. Project Structure -- Bird's Eye View

```
payhook-ng/
├── package.json              # NPM package config, subpath exports, scripts
├── tsconfig.json             # TypeScript compiler settings
├── vitest.config.ts          # Test runner configuration
├── CHANGELOG.md              # Release history
├── README.md                 # User-facing documentation
│
├── src/
│   ├── index.ts              # Main entry: verify(), createPayhook(), re-exports
│   ├── types.ts              # Core types: HttpHeaders, WebhookVerificationResult
│   ├── errors.ts             # Error classes: PayhookError, MissingHeaderError, etc.
│   │
│   ├── paystack/
│   │   ├── index.ts          # Barrel: re-exports everything from this module
│   │   ├── types.ts          # Paystack webhook payload types
│   │   ├── verify.ts         # HMAC SHA-512 signature verification
│   │   └── request.ts        # Next.js App Router helper
│   │
│   ├── flutterwave/
│   │   ├── index.ts          # Barrel: re-exports everything from this module
│   │   ├── types.ts          # Flutterwave webhook payload types
│   │   ├── verify.ts         # Secret hash comparison verification
│   │   └── request.ts        # Next.js App Router helper
│   │
│   ├── security/
│   │   ├── types.ts          # IdempotencyStore interface
│   │   ├── memory-store.ts   # In-memory implementation (Map-based)
│   │   └── redis-store.ts    # Redis adapter (bring-your-own-client)
│   │
│   ├── integrations/
│   │   ├── nextjs.ts         # withPayhook() wrapper
│   │   └── express.ts        # payhookMiddleware()
│   │
│   └── __tests__/            # All test files (excluded from build output)
│       ├── paystack/verify.test.ts
│       ├── flutterwave/verify.test.ts
│       ├── index.test.ts
│       ├── security/memory-store.test.ts
│       └── integration/
│           ├── nextjs.test.ts
│           └── express.test.ts
│
├── dist/                     # Compiled JavaScript + type declarations (git-ignored)
└── examples/                 # Usage examples for documentation
```

**Key insight:** The source code is organized into **modules by provider**
(paystack/, flutterwave/) and **modules by concern** (security/, integrations/).
The top-level `src/index.ts` ties everything together.

---

## 4. How the Package is Configured

### 4.1 package.json

```json
{
  "name": "payhook-ng",
  "version": "0.1.0",
  "description": "TypeScript-first webhook verification building blocks for Paystack and Flutterwave.",
  "license": "ISC",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".":            { "types": "./dist/index.d.ts",               "default": "./dist/index.js" },
    "./paystack":   { "types": "./dist/paystack/index.d.ts",      "default": "./dist/paystack/index.js" },
    "./flutterwave":{ "types": "./dist/flutterwave/index.d.ts",   "default": "./dist/flutterwave/index.js" },
    "./nextjs":     { "types": "./dist/integrations/nextjs.d.ts",  "default": "./dist/integrations/nextjs.js" },
    "./express":    { "types": "./dist/integrations/express.d.ts", "default": "./dist/integrations/express.js" },
    "./package.json": "./package.json"
  },
  "files": [ "dist", "README.md" ],
  "scripts": {
    "clean": "rm -rf dist",
    "build": "npm run clean && tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": ["paystack","flutterwave","webhooks","webhook","signature","hmac","security","typescript","node","nextjs"],
  "author": "PayHook Contributors",
  "devDependencies": {
    "@types/node": "^25.0.10",
    "typescript": "^5.9.3",
    "vitest": "^4.0.18"
  }
}
```

**Key things to explain in your video:**

| Field | What It Does |
|-------|-------------|
| `"type": "module"` | Tells Node.js this package uses ES Modules (`import/export`) not CommonJS (`require/module.exports`). Every `.js` file is treated as ESM. |
| `"main"` | Fallback entry point for older tools that don't support `"exports"`. |
| `"types"` | Tells TypeScript where to find the root type declarations. |
| `"exports"` | **Subpath exports** -- the modern way to control what import paths consumers can use. Each key is a path consumers write (`'payhook-ng/paystack'`), each value maps to the actual file. The `"types"` condition must come first because TypeScript stops at the first match. |
| `"files"` | Only `dist/` and `README.md` are included when you `npm publish`. Source code, tests, config files are excluded. |
| `"prepublishOnly"` | Runs automatically before `npm publish`. Builds the project AND runs tests -- if tests fail, publishing is blocked. |

**Why no runtime dependencies?** The library only uses Node.js built-in modules
(`node:crypto`).  Redis is bring-your-own-client.  This keeps the package tiny
(16 kB compressed).

### 4.2 tsconfig.json

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "module": "nodenext",
    "target": "es2022",
    "lib": ["es2022"],
    "types": ["node"],
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/__tests__"]
}
```

**Key settings explained:**

| Setting | Why |
|---------|-----|
| `"module": "nodenext"` | Matches Node.js ESM resolution. Requires `.js` extensions in imports even for `.ts` files (e.g., `'./verify.js'`). |
| `"target": "es2022"` | Output modern JS. No need to polyfill for old browsers -- this is a Node.js server library. |
| `"declaration": true` | Generates `.d.ts` type declaration files so consumers get autocomplete and type checking. |
| `"declarationMap": true` | Generates `.d.ts.map` files so "Go to Definition" in IDEs jumps to the `.ts` source, not the `.d.ts`. |
| `"strict": true` | Enables all strict type-checking options. Catches bugs at compile time. |
| `"verbatimModuleSyntax"` | Enforces explicit `import type` for type-only imports. Helps bundlers tree-shake. |
| `"noUncheckedIndexedAccess"` | `obj[key]` returns `T \| undefined` instead of just `T`. Prevents forgetting undefined checks. |
| `"exactOptionalPropertyTypes"` | `{ x?: string }` means `x` can be `string` or `undefined` but NOT explicitly set to `undefined`. Stricter optional handling. |
| `"exclude"` | Test files are excluded from the build. They're only processed by Vitest (which has its own TypeScript transform). |

### 4.3 vitest.config.ts

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

**Why Vitest?** Vitest natively supports ESM and TypeScript without extra
config (no Babel, no ts-jest).  It uses the same configuration format as Vite.
`vitest run` executes tests once (for CI); `vitest` runs in watch mode
(for development).

---

## 5. Core Types -- The Foundation

### 5.1 src/types.ts

```ts
export type WebhookProvider = 'paystack' | 'flutterwave';
```

A **string literal union type**.  Every result object carries a `provider` field
set to one of these values.  If you add a third provider later, you add it
here.

```ts
export type HttpHeaders = Record<string, string | string[] | undefined>;
```

Headers come in different shapes depending on the framework:
- Express: `string | string[] | undefined`
- Next.js: `string`
- Node.js `http` module: `string | string[] | undefined`

This type accommodates all of them.  The verify functions use a `getHeader()`
helper that handles the differences.

```ts
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
```

**This is the most important type in the entire codebase.**  It's a
**discriminated union** -- the `ok` field acts as the discriminator:

```ts
const result = verifyPaystackWebhook(...);

if (result.ok) {
  // TypeScript KNOWS this is WebhookVerificationSuccess
  // result.payload exists, result.provider is guaranteed
  console.log(result.payload.event);
} else {
  // TypeScript KNOWS this is WebhookVerificationFailure
  // result.code and result.message exist
  console.log(result.code);
}
```

**Why `ok: true` / `ok: false` instead of exceptions?** This is the
**Result pattern** (sometimes called "Either" in functional programming).
Benefits:
- No try/catch needed in route handlers
- TypeScript enforces you handle both cases
- The failure case carries structured data (code + message), not just an error string

Note: `provider?` is optional on failures because some failures happen before
we can determine the provider (e.g., `PAYHOOK_UNKNOWN_PROVIDER`).

**Generic parameters:**
- `TPayload`: The type of the parsed webhook body.  Defaults to the provider's
  webhook type but users can narrow it (e.g., `verifyPaystackWebhook<MyCustomType>(...)`).
- `TProvider`: Locks the provider string literal.  When you call the Paystack
  verify, this is `'paystack'`, so `result.provider` is literally the string
  `'paystack'` (not the union).

---

## 6. Error System

### 6.1 src/errors.ts

```ts
export type PayhookErrorCode =
  | 'PAYHOOK_MISSING_HEADER'
  | 'PAYHOOK_INVALID_SIGNATURE'
  | 'PAYHOOK_INVALID_JSON'
  | 'PAYHOOK_REPLAY_ATTACK'
  | 'PAYHOOK_STALE_EVENT';
```

Every error has a **machine-readable code**.  These same codes appear in the
result object's `code` field (for the non-throwing API) and on the error
object's `code` property (for the throwing API).  This lets consumers write
`switch` statements on the error code rather than parsing error messages.

```ts
export class PayhookError extends Error {
  readonly code: PayhookErrorCode;
  override readonly cause?: unknown;

  constructor(message: string, opts: { code: PayhookErrorCode; cause?: unknown }) {
    super(message);
    this.name = this.constructor.name;  // "MissingHeaderError" not "Error"
    this.code = opts.code;
    this.cause = opts.cause;            // ES2022 error cause chaining
  }
}
```

**`PayhookError`** is the base class.  Key details:
- `this.name = this.constructor.name` -- when logged, the error shows as
  `MissingHeaderError: Missing required header: x-paystack-signature` rather
  than just `Error: ...`.
- `override readonly cause` -- uses the ES2022 error cause pattern for
  chaining (e.g., wrapping a JSON.parse SyntaxError).

The subclasses each specialize with a preset `code`:

```ts
export class MissingHeaderError extends PayhookError {
  readonly headerName: string;
  constructor(headerName: string) {
    super(`Missing required header: ${headerName}`, { code: 'PAYHOOK_MISSING_HEADER' });
    this.headerName = headerName;  // extra context for programmatic use
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
```

**Why both result objects AND error classes?** The library offers two API
styles:
- `verifyPaystackWebhook()` returns a result object (uses codes internally)
- `verifyPaystackWebhookOrThrow()` throws these error classes

Consumers choose their preferred style.  The result pattern is better for
route handlers; the throw pattern is better for middleware chains.

---

## 7. Paystack Module -- Line by Line

### 7.1 src/paystack/types.ts

```ts
export type PaystackWebhook =
  | PaystackChargeSuccessWebhook
  | { event: 'transfer.success'; data: unknown }
  | { event: string & {}; data: unknown };
```

This is a **union type** representing all possible Paystack webhook payloads.
The `string & {}` trick is important -- it means "any string" but still
provides autocomplete for the known literal values.  Without `& {}`,
TypeScript would widen the union to just `string` and lose the autocomplete.

**PaystackChargeSuccessWebhook** is fully typed because it's the most common
event:

```ts
export type PaystackChargeSuccessWebhook = {
  event: 'charge.success';
  data: PaystackChargeData;
};

export type PaystackChargeData = {
  id: number;
  domain?: 'test' | 'live' | (string & {});
  status?: string;
  reference: string;
  amount: number;           // In kobo (1 NGN = 100 kobo)
  currency?: string;
  channel?: string;
  gateway_response?: string;
  paid_at?: string;         // ISO 8601 timestamp
  created_at?: string;      // ISO 8601 timestamp
  fees?: number;
  requested_amount?: number;
  metadata?: unknown;
  customer?: PaystackCustomer;
  authorization?: PaystackAuthorization;
};
```

Most fields are optional (`?`) because Paystack doesn't guarantee every field
on every event type.  `id`, `reference`, and `amount` are required because
they're always present on charge events.

`PaystackCustomer` and `PaystackAuthorization` model the nested objects:

```ts
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
  bin?: string;              // First 6 digits of card
  last4?: string;            // Last 4 digits of card
  exp_month?: string;
  exp_year?: string;
  channel?: string;
  card_type?: string;
  bank?: string;
  country_code?: string;
  brand?: string;            // e.g. "visa", "mastercard"
  reusable?: boolean;
  signature?: string;        // Card signature for recurring charges
  account_name?: string | null;
};
```

### 7.2 src/paystack/verify.ts -- The Core Security Logic

This is the most security-critical file in the entire codebase.  Let's walk
through every function.

#### Constants and Input Types

```ts
export const PAYSTACK_SIGNATURE_HEADER = 'x-paystack-signature' as const;
```

Paystack sends the HMAC signature in this header.  `as const` makes the type
literally `'x-paystack-signature'` (not `string`).

```ts
export type VerifyPaystackWebhookInput = {
  rawBody: string | Buffer | Uint8Array;  // The exact bytes of the request body
  secret: string;                          // Your Paystack secret key (sk_...)
  signature?: string;                      // Pre-extracted signature (optional)
  headers?: HttpHeaders;                   // Full headers map (optional)
};
```

You provide EITHER `signature` (if you already extracted it) OR `headers`
(and the function extracts it).  This flexibility supports different
frameworks.

```ts
export type VerifyPaystackWebhookOptions = {
  parseJson?: boolean;          // Default: true.  Set false to get raw string.
  signatureHeader?: string;     // Default: 'x-paystack-signature'
};
```

#### Helper: toBuffer()

```ts
function toBuffer(rawBody: VerifyPaystackWebhookInput['rawBody']): Buffer {
  if (typeof rawBody === 'string') return Buffer.from(rawBody, 'utf8');
  if (Buffer.isBuffer(rawBody)) return rawBody;
  return Buffer.from(rawBody);  // Uint8Array -> Buffer
}
```

The HMAC function needs a Buffer.  This normalizes the three possible input
types.  **Why accept three types?**
- `string`: When you used `await req.text()`
- `Buffer`: When Express gives you `req.body` via `express.raw()`
- `Uint8Array`: When you used `new Uint8Array(await req.arrayBuffer())`

#### Helper: getHeader()

```ts
function getHeader(headers: HttpHeaders, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() !== target) continue;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v[0];
    return undefined;
  }
  return undefined;
}
```

HTTP headers are **case-insensitive** per the HTTP spec.  A server might
send `X-Paystack-Signature`, `x-paystack-signature`, or `X-PAYSTACK-SIGNATURE`.
This function handles all cases by comparing lowercased names.

If the header value is an array (some frameworks do this for repeated
headers), it takes the first element.

#### Helper: timingSafeEqualHex()

```ts
function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
```

**This is a critical security function.**

A naive comparison like `expected === signature` is vulnerable to
**timing attacks**.  String comparison in JavaScript stops at the first
different character.  An attacker can measure how long the comparison takes
and figure out the correct signature one character at a time.

`crypto.timingSafeEqual()` always takes the same amount of time regardless
of where the difference is.  The function:
1. Converts both hex strings to byte Buffers
2. Checks lengths match (if not, they can't be equal)
3. Uses constant-time comparison

The `try/catch` handles malformed hex strings (e.g., the attacker sends
non-hex characters).

#### computePaystackSignature()

```ts
export function computePaystackSignature(
  rawBody: VerifyPaystackWebhookInput['rawBody'],
  secret: string
): string {
  const buf = toBuffer(rawBody);
  return crypto.createHmac('sha512', secret).update(buf).digest('hex');
}
```

This computes what the signature **should** be.  The algorithm:
1. Create an HMAC using SHA-512 with your secret key
2. Feed in the raw request body bytes
3. Get the result as a hex string (128 characters for SHA-512)

**How HMAC works (simplified):**
```
HMAC(key, message) = Hash((key XOR opad) || Hash((key XOR ipad) || message))
```

Only someone with the secret key can produce the correct HMAC.  Paystack
computes this on their end and sends it in the header.  We compute it on
our end and compare.  If they match, the request came from Paystack.

#### verifyPaystackWebhook() -- The Main Function

```ts
export function verifyPaystackWebhook<TPayload = PaystackWebhook>(
  input: VerifyPaystackWebhookInput,
  options: VerifyPaystackWebhookOptions = {}
): WebhookVerificationResult<TPayload, 'paystack'> {
```

Generic `<TPayload>` defaults to `PaystackWebhook` but can be narrowed by
the caller.

**Step 1: Get the signature**

```ts
  const signatureHeader = options.signatureHeader ?? PAYSTACK_SIGNATURE_HEADER;
  const signature =
    input.signature ?? (input.headers ? getHeader(input.headers, signatureHeader) : undefined);

  if (!signature) {
    return {
      ok: false,
      provider: 'paystack',
      code: 'PAYHOOK_MISSING_HEADER',
      message: `Missing required header: ${signatureHeader}`
    };
  }
```

First checks if a pre-extracted signature was provided.  If not, looks it up
from the headers map.  If neither exists, returns a failure result.

**Step 2: Compute and compare**

```ts
  const expected = computePaystackSignature(input.rawBody, input.secret);
  const ok = timingSafeEqualHex(expected, signature);

  if (!ok) {
    return {
      ok: false,
      provider: 'paystack',
      code: 'PAYHOOK_INVALID_SIGNATURE',
      message: 'Invalid Paystack webhook signature'
    };
  }
```

Computes what the signature should be, compares it timing-safely.

**Step 3: Parse JSON**

```ts
  const rawString = Buffer.isBuffer(input.rawBody)
    ? input.rawBody.toString('utf8')
    : toBuffer(input.rawBody).toString('utf8');

  if (options.parseJson === false) {
    return { ok: true, provider: 'paystack', payload: rawString as unknown as TPayload };
  }

  try {
    const parsed = JSON.parse(rawString) as TPayload;
    return { ok: true, provider: 'paystack', payload: parsed };
  } catch (cause) {
    return {
      ok: false,
      provider: 'paystack',
      code: 'PAYHOOK_INVALID_JSON',
      message: 'Invalid JSON payload'
    };
  }
}
```

After verification passes, the body is parsed.  The `parseJson: false` option
lets advanced users skip parsing (e.g., if they want to store the raw string).

**Important order:** Signature verification happens BEFORE JSON parsing.
This is intentional -- if the body has been tampered with, we don't want to
parse it at all.

#### verifyPaystackWebhookOrThrow()

Same logic but throws errors instead of returning result objects.  Useful in
middleware where you want errors to propagate up:

```ts
export function verifyPaystackWebhookOrThrow<TPayload = PaystackWebhook>(
  input: VerifyPaystackWebhookInput,
  options: VerifyPaystackWebhookOptions = {}
): TPayload {
  // ... same steps but throws MissingHeaderError, InvalidSignatureError, InvalidJsonError
}
```

### 7.3 src/paystack/request.ts -- Next.js Helper

```ts
export async function verifyPaystackRequest<TPayload = PaystackWebhook>(
  request: Request,
  secret: string,
  options: VerifyPaystackWebhookOptions = {}
): Promise<WebhookVerificationResult<TPayload, 'paystack'>> {
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const headers = Object.fromEntries(request.headers);
  return verifyPaystackWebhook<TPayload>({ rawBody, secret, headers }, options);
}
```

**Why does this exist?** Next.js App Router gives you a Web API `Request`
object.  Reading its body is async (`request.arrayBuffer()`) and the headers
come as a `Headers` object (not a plain object).  This helper does the
conversion so users don't have to.

**`request.arrayBuffer()`** returns a Promise<ArrayBuffer>.  We wrap it in
`Uint8Array` because that's one of the accepted input types for verification.

**`Object.fromEntries(request.headers)`** converts the `Headers` class
(which is iterable as `[key, value]` pairs) into a plain `Record<string, string>`.

### 7.4 src/paystack/index.ts -- Barrel Export

```ts
export * from './types.js';
export * from './verify.js';
export * from './request.js';
```

A **barrel file** re-exports everything from the module's files through a
single entry point.  This is what the `"./paystack"` export in package.json
points to.  Users can do:

```ts
import { verifyPaystackWebhook, PaystackWebhook } from 'payhook-ng/paystack';
```

---

## 8. Flutterwave Module -- Line by Line

The Flutterwave module mirrors the Paystack module in structure but differs
in verification logic.

### 8.1 src/flutterwave/types.ts

Same pattern as Paystack types.  Key difference: Flutterwave's charge event
is `'charge.completed'` (not `'charge.success'`), and the data structure
differs:

```ts
export type FlutterwaveChargeData = {
  id: number;
  tx_ref: string;          // Flutterwave's transaction reference
  flw_ref: string;         // Flutterwave's internal reference
  amount: number;
  currency: string;
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  status: string;
  payment_type: string;
  created_at: string;      // ISO 8601 timestamp
  customer: FlutterwaveCustomer;
  card?: FlutterwaveCard;
  // ... more fields
};
```

### 8.2 src/flutterwave/verify.ts -- Hash Verification

The critical difference from Paystack:

```ts
// Paystack: HMAC(secret, body) === header
// Flutterwave: secretHash === header
```

**Flutterwave does NOT use HMAC.**  Instead, you configure a "secret hash"
string in your Flutterwave dashboard.  When Flutterwave sends a webhook, it
includes that exact string in the `verif-hash` header.  You verify by checking
if the header matches the hash you configured.

```ts
// The core verification (inside verifyFlutterwaveWebhook):
if (signature !== input.secretHash) {
  return {
    ok: false,
    provider: 'flutterwave',
    code: 'PAYHOOK_INVALID_SIGNATURE',
    message: 'Invalid Flutterwave webhook signature'
  };
}
```

This is a **direct string equality** check.  No HMAC computation, no
timing-safe comparison needed (the secret hash is not derived from the body,
so timing attacks don't reveal anything useful).

**Security implication:** Flutterwave's approach is simpler but provides
weaker guarantees.  The secret hash doesn't bind to the request body -- it's
the same for every webhook.  An attacker who discovers the hash could forge
arbitrary payloads.  Paystack's HMAC approach is stronger because the
signature changes with every request body.

### 8.3 src/flutterwave/request.ts -- Next.js Helper

Identical pattern to the Paystack request helper, but calls
`verifyFlutterwaveWebhook` and takes `secretHash` instead of `secret`.

### 8.4 src/flutterwave/index.ts -- Barrel Export

```ts
export * from './types.js';
export * from './verify.js';
export * from './request.js';
```

---

## 9. Security Module -- Replay Prevention

### 9.1 src/security/types.ts -- IdempotencyStore Interface

```ts
export interface IdempotencyStore {
  exists(key: string): Promise<boolean> | boolean;
  record(key: string, ttlSeconds: number): Promise<void> | void;
}
```

This is an **interface** -- a contract that any implementation must follow.
Two methods:
- `exists(key)`: Has this event been processed before?
- `record(key, ttl)`: Mark this event as processed, auto-expire after `ttl` seconds.

The return types allow both sync (`boolean`) and async (`Promise<boolean>`).
The in-memory store is sync; the Redis store is async.  The unified `verify()`
function uses `await` on both, which works for sync values too (`await true`
is just `true`).

**What is idempotency?** An operation is idempotent if performing it
multiple times has the same effect as performing it once.  For webhooks, this
means: if Paystack sends the same webhook twice (which they sometimes do),
you should only process it once.

### 9.2 src/security/memory-store.ts -- In-Memory Store

```ts
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, number>();  // key -> expiresAt timestamp
```

Uses a `Map` where keys are event IDs and values are expiration timestamps
(milliseconds since epoch).

```ts
  constructor(private gcIntervalSeconds = 60) {
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), gcIntervalSeconds * 1000).unref();
    }
  }
```

Starts a **garbage collection** timer that runs every 60 seconds by default.
`.unref()` tells Node.js this timer should NOT keep the process alive -- if
this is the only thing left, the process can exit.

`typeof setInterval !== 'undefined'` is a safety check for environments where
timers might not exist (e.g., some edge runtimes).

```ts
  exists(key: string): boolean {
    const expiresAt = this.store.get(key);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.store.delete(key);  // Lazy cleanup
      return false;
    }
    return true;
  }
```

**Lazy expiration:** When checking if a key exists, it also checks if the
key has expired.  This means even without the GC timer, expired keys are
cleaned up on access.  The GC timer handles keys that are never checked again.

```ts
  record(key: string, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, expiresAt);
  }
```

Records the key with an expiration timestamp.  `Date.now()` returns
milliseconds, `ttlSeconds` is in seconds, so we multiply by 1000.

**Limitation:** This store is per-process.  If you have 3 server instances
behind a load balancer, each has its own Map.  Server A processes an event;
servers B and C have no idea.  That's why the Redis store exists.

### 9.3 src/security/redis-store.ts -- Redis Store

```ts
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
}
```

**Dependency inversion in action.**  Instead of importing `ioredis` or
`redis`, we define the minimal interface we need.  Both popular Redis
libraries satisfy this interface, so the user passes their own client:

```ts
import Redis from 'ioredis';
const redis = new Redis();
const store = new RedisIdempotencyStore(redis);  // Works!

// OR

import { createClient } from 'redis';
const redis = createClient();
const store = new RedisIdempotencyStore(redis);  // Also works!
```

**Why `...args: any[]`?** The `set` command in Redis has many optional
parameters (`EX`, `PX`, `NX`, etc.).  Different Redis libraries pass them
differently.  `...args: any[]` accepts whatever the library uses.

```ts
export class RedisIdempotencyStore implements IdempotencyStore {
  private prefix: string;

  constructor(
    private client: RedisLike,
    options: { prefix?: string } = {}
  ) {
    this.prefix = options.prefix ?? 'payhook:idempotency:';
  }
```

**Key prefixing:** Redis is often a shared database.  The prefix
`payhook:idempotency:` ensures our keys don't collide with other data.
Users can customize it.

```ts
  async exists(key: string): Promise<boolean> {
    const result = await this.client.get(this.prefix + key);
    return result !== null;
  }

  async record(key: string, ttlSeconds: number): Promise<void> {
    await this.client.set(this.prefix + key, '1', 'EX', ttlSeconds);
  }
}
```

`SET key '1' EX 300` sets the key with a value of '1' and auto-expires after
300 seconds.  Redis handles the cleanup automatically -- no GC needed on our
side.  The value '1' is arbitrary; we only care about key existence.

---

## 10. The Unified API -- src/index.ts

This is the glue that ties everything together.

### 10.1 Re-exports

```ts
export * from './types.js';
export * from './errors.js';
export * from './security/types.js';
export * from './security/memory-store.js';
export * from './security/redis-store.js';

export * as paystack from './paystack/index.js';
export * as flutterwave from './flutterwave/index.js';
```

Two different re-export styles:
- `export *` -- flat re-export.  `import { HttpHeaders } from 'payhook-ng'`
- `export * as paystack` -- namespace re-export.  `import { paystack } from 'payhook-ng'` then `paystack.verifyPaystackWebhook(...)`

### 10.2 PayhookConfig Type

```ts
export type PayhookConfig = {
  paystackSecret?: string;
  flutterwaveSecretHash?: string;
  idempotencyStore?: IdempotencyStore;
  idempotencyTTL?: number;      // Default: 600 (10 minutes)
  maxAgeSeconds?: number;        // Reject events older than this
};
```

Everything is optional.  You only configure what you need:
- Paystack only? Just set `paystackSecret`.
- Both providers with replay prevention? Set all fields.

### 10.3 verify() -- Auto-Detection, Idempotency, Timestamps

This function is `async` because the idempotency store might be async (Redis).

**Phase 1: Provider Detection**

```ts
const paystackHeader = getHeader(headers, PAYSTACK_SIGNATURE_HEADER);
if (paystackHeader && config.paystackSecret) {
  result = verifyPaystackWebhook({ rawBody, headers, secret: config.paystackSecret });
}
else if (getHeader(headers, FLUTTERWAVE_SIGNATURE_HEADER) && config.flutterwaveSecretHash) {
  result = verifyFlutterwaveWebhook({ rawBody, headers, secretHash: config.flutterwaveSecretHash });
}
else {
  return { ok: false, code: 'PAYHOOK_UNKNOWN_PROVIDER', message: '...' };
}
```

Auto-detection works by checking which signature header is present:
- `x-paystack-signature` present --> Paystack
- `verif-hash` present --> Flutterwave
- Neither --> unknown provider

**Phase 2: Idempotency Check**

```ts
if (config.idempotencyStore) {
  const eventId = extractEventId(result.provider, result.payload);
  if (eventId) {
    const isReplay = await config.idempotencyStore.exists(eventId);
    if (isReplay) {
      return { ok: false, provider: result.provider, code: 'PAYHOOK_REPLAY_ATTACK', message: '...' };
    }
    await config.idempotencyStore.record(eventId, config.idempotencyTTL ?? 600);
  }
}
```

This only runs if an idempotency store is configured AND the verification
succeeded.  The event ID is extracted from the payload (e.g.,
`paystack:123` or `flutterwave:456`).  The ID is checked, and if new,
recorded.

**Phase 3: Timestamp Validation**

```ts
if (config.maxAgeSeconds && result.ok) {
  const createdAt = extractTimestamp(result.provider, result.payload);
  if (createdAt) {
    const ageSeconds = (Date.now() - createdAt.getTime()) / 1000;
    if (ageSeconds > config.maxAgeSeconds) {
      return {
        ok: false,
        provider: result.provider,
        code: 'PAYHOOK_STALE_EVENT',
        message: `Event is ${Math.round(ageSeconds)}s old, exceeds max age of ${config.maxAgeSeconds}s`
      };
    }
  }
}
```

If `maxAgeSeconds` is set, the function checks if the event's `created_at`
timestamp is too old.  This catches **replay attacks** where an attacker
replays an old (but valid) webhook.  Even if the event ID is new (because the
idempotency store expired it), the timestamp check catches it.

**Defense in depth:** Idempotency catches exact duplicates.  Timestamps catch
stale events.  Together they provide two layers of replay protection.

### 10.4 createPayhook() -- Factory Pattern

```ts
export function createPayhook(config: PayhookConfig) {
  return {
    verify: (rawBody: string | Buffer | Uint8Array, headers: HttpHeaders) =>
      verify(rawBody, headers, config),
  };
}
```

This is a **factory function** that creates a pre-configured verify function.
It uses **closures** -- the returned `verify` method "remembers" the `config`
that was passed when `createPayhook` was called.

```ts
// Without factory: pass config every time
await verify(body, headers, { paystackSecret: '...', idempotencyStore: store });
await verify(body2, headers2, { paystackSecret: '...', idempotencyStore: store });

// With factory: configure once, reuse
const payhook = createPayhook({ paystackSecret: '...', idempotencyStore: store });
await payhook.verify(body, headers);
await payhook.verify(body2, headers2);
```

### 10.5 Helper Functions

#### extractEventId()

```ts
function extractEventId(provider: string, payload: any): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;

  if (provider === 'paystack') {
    return payload.data?.id ? `paystack:${payload.data.id}` : undefined;
  }
  if (provider === 'flutterwave') {
    return payload.data?.id ? `flutterwave:${payload.data.id}` : undefined;
  }
  return undefined;
}
```

Extracts a unique event identifier from the webhook payload.  The format
`provider:id` ensures Paystack event #123 and Flutterwave event #123 are
treated as different events.

Uses **optional chaining** (`payload.data?.id`) to safely access nested
properties without throwing if `data` is undefined.

#### extractTimestamp()

```ts
function extractTimestamp(provider: string, payload: any): Date | undefined {
  if (provider === 'paystack') {
    const ts = payload?.data?.created_at || payload?.data?.paid_at;
    return ts ? new Date(ts) : undefined;
  }
  if (provider === 'flutterwave') {
    const ts = payload?.data?.created_at;
    return ts ? new Date(ts) : undefined;
  }
  return undefined;
}
```

For Paystack, tries `created_at` first, falls back to `paid_at`.  For
Flutterwave, uses `created_at`.  Returns a `Date` object or `undefined`
if no timestamp is found.

#### getHeader()

The same case-insensitive header lookup used in the provider modules.
Duplicated here because this function is module-private (not exported).

---

## 11. Framework Integrations

### 11.1 src/integrations/nextjs.ts -- withPayhook()

```ts
type NextRouteHandler = (request: Request) => Promise<Response> | Response;
type PayhookHandler = (payload: any, request: Request) => Promise<Response> | Response;

export function withPayhook(config: PayhookConfig, handler: PayhookHandler): NextRouteHandler {
  return async (request: Request) => {
    const rawBody = new Uint8Array(await request.arrayBuffer());
    const headers = Object.fromEntries(request.headers) as HttpHeaders;
    const result = await verify(rawBody, headers, config);

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.code, message: result.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return handler(result.payload, request);
  };
}
```

This is a **higher-order function** -- a function that returns a function.

**What it eliminates (boilerplate):**

```ts
// WITHOUT withPayhook -- you write this in every route:
export async function POST(req: Request) {
  const rawBody = new Uint8Array(await req.arrayBuffer());
  const headers = Object.fromEntries(req.headers);
  const result = await verify(rawBody, headers, config);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.code }), { status: 400 });
  }
  // Your actual logic here
}

// WITH withPayhook -- one line:
export const POST = withPayhook(config, async (payload, request) => {
  // payload is already verified!
  return new Response('ok');
});
```

The pattern: `withPayhook` takes your config and your handler.  It returns a
new function that:
1. Reads the raw body
2. Converts headers
3. Runs verification
4. If failed, returns a 400 JSON response automatically
5. If passed, calls YOUR handler with the verified payload

### 11.2 src/integrations/express.ts -- payhookMiddleware()

```ts
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
```

**Why define our own Express types?**  We don't want `@types/express` as a
dependency.  Users who use Express already have it installed.  We define the
minimal subset we need.

```ts
export function payhookMiddleware(config: PayhookConfig) {
  return async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    try {
      const rawBody = req.body;
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
```

**Express middleware pattern:** Functions with signature `(req, res, next)`:
- Call `next()` to pass control to the next middleware/handler
- Call `res.status(400).json(...)` to send a response and stop the chain
- Call `next(err)` to trigger Express's error handler

**`req.webhook = result.payload`** decorates the request object with the
verified payload.  The next handler can access it as `req.webhook`.

**Important:** This middleware requires `express.raw({ type: 'application/json' })`
to be used before it.  By default, Express parses JSON bodies into objects
(`req.body = { event: 'charge.success', ... }`).  But we need the raw bytes
for signature verification.  `express.raw()` gives us a `Buffer` instead.

---

## 12. The Test Suite -- Every Test Explained

The project has **54 tests** across 6 test files.  All use Vitest.

### 12.1 Paystack Verification Tests

**File:** `src/__tests__/paystack/verify.test.ts`

**Test helper:**
```ts
function sign(body: string, secret: string): string {
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}
```

This mimics what Paystack does server-side.  We use it to generate valid
signatures for testing.

| Test | What It Verifies |
|------|-----------------|
| "should verify a valid signature" | Happy path: correct HMAC = success, payload parsed |
| "should reject an invalid signature" | Wrong signature = `PAYHOOK_INVALID_SIGNATURE` |
| "should fail when signature header is missing" | Empty headers = `PAYHOOK_MISSING_HEADER` |
| "should handle malformed JSON body" | Valid signature but body isn't JSON = `PAYHOOK_INVALID_JSON` |
| "should extract signature from headers map (case-insensitive)" | `X-Paystack-Signature` (capitals) still works |
| "should return raw string when parseJson is false" | `parseJson: false` returns string, not object |
| "should work with Buffer input" | `Buffer` body type works |
| "should work with Uint8Array input" | `Uint8Array` body type works |
| "should return payload on valid signature" (OrThrow) | Throwing variant returns payload directly |
| "should throw MissingHeaderError" | Throwing variant throws correct error class |
| "should throw InvalidSignatureError" | Throwing variant throws correct error class |
| "should throw InvalidJsonError" | Throwing variant throws correct error class |
| "should produce a valid HMAC SHA-512 hex string" | Output is 128 hex characters |
| "should match crypto.createHmac output" | Our function matches Node.js crypto directly |

### 12.2 Flutterwave Verification Tests

**File:** `src/__tests__/flutterwave/verify.test.ts`

Same structure as Paystack tests but with Flutterwave-specific behavior:

| Test | What It Verifies |
|------|-----------------|
| "should verify when hash matches" | Happy path: header === secretHash |
| "should reject when hash does not match" | Different hash = failure |
| "should fail when verif-hash header is missing" | No header = `PAYHOOK_MISSING_HEADER` |
| "should handle malformed JSON body" | Valid hash but bad JSON = `PAYHOOK_INVALID_JSON` |
| **"should be case-sensitive for hash comparison"** | `hash.toUpperCase() !== hash` = failure (this is intentional -- Flutterwave hashes are case-sensitive) |
| "should extract signature from headers map (case-insensitive header name)" | `Verif-Hash` (capitals in header name) still works |
| All the same variant tests as Paystack... | Buffer, Uint8Array, parseJson:false, OrThrow variants |

### 12.3 Unified API Tests

**File:** `src/__tests__/index.test.ts`

| Test | What It Verifies |
|------|-----------------|
| "should auto-detect Paystack from x-paystack-signature header" | Provider detection works for Paystack |
| "should auto-detect Flutterwave from verif-hash header" | Provider detection works for Flutterwave |
| "should return PAYHOOK_UNKNOWN_PROVIDER when neither header is present" | No signature headers = unknown provider error |
| "should detect replay with idempotency store" | First call succeeds, second call with same event returns `PAYHOOK_REPLAY_ATTACK` |
| "should reject stale events when maxAgeSeconds is configured" | Event from 2 hours ago rejected when max is 1 hour |
| "should allow recent events when maxAgeSeconds is configured" | Event from 30 seconds ago passes when max is 1 hour |
| "should return an object with a verify method" | Factory returns correct shape |
| "should verify Paystack webhooks via the factory" | Factory's verify works for Paystack |
| "should verify Flutterwave webhooks via the factory" | Factory's verify works for Flutterwave |

### 12.4 Memory Store Tests

**File:** `src/__tests__/security/memory-store.test.ts`

Uses **fake timers** (`vi.useFakeTimers()`) to control `Date.now()` and
`setInterval` without actually waiting:

| Test | What It Verifies |
|------|-----------------|
| "should return false for unknown key" | Empty store returns false |
| "should return true after recording a key" | Recorded key exists |
| "should return false after TTL expires" | Key disappears after TTL |
| "should return true before TTL expires" | Key exists within TTL |
| "should handle multiple keys independently" | Different TTLs work correctly |
| "should cleanup expired entries via garbage collection" | GC timer removes expired keys |

### 12.5 Next.js Integration Tests

**File:** `src/__tests__/integration/nextjs.test.ts`

Uses the Web API `Request` constructor to create mock requests:

```ts
function createRequest(body: string, headers: Record<string, string>): Request {
  return new Request('https://example.com/webhooks', {
    method: 'POST',
    headers,
    body,
  });
}
```

Tests cover `verifyPaystackRequest`, `verifyFlutterwaveRequest`, and
`withPayhook` with both success and failure scenarios.

### 12.6 Express Integration Tests

**File:** `src/__tests__/integration/express.test.ts`

Creates mock Express objects:

```ts
function createMockReqResNext(body, headers) {
  const req = { body: Buffer.from(body), headers };
  const res = {
    statusCode: 200,
    status(code) { res.statusCode = code; return res; },
    json: vi.fn(),
  };
  const next = vi.fn();
  return { req, res, next };
}
```

`vi.fn()` creates **mock functions** that track calls.  Tests assert:
- `expect(next).toHaveBeenCalledWith()` -- next was called (success)
- `expect(next).not.toHaveBeenCalled()` -- next was NOT called (error response sent)
- `expect(res.json).toHaveBeenCalledWith(expect.objectContaining({...}))` -- correct error body

---

## 13. Key Design Patterns Used

### Discriminated Union (Result Pattern)

**Where:** `WebhookVerificationResult`

```ts
type Result = { ok: true; payload: T } | { ok: false; code: string };
```

The `ok` field is the **discriminant**.  TypeScript narrows the type after
checking it.  This is the alternative to throwing exceptions.  Benefits:
forced error handling, no try/catch, structured error data.

### Factory Pattern

**Where:** `createPayhook()`

A function that returns an object with pre-configured methods.  Uses closures
to "bake in" the config.  Alternative to a class constructor.

### Higher-Order Function

**Where:** `withPayhook()`, `payhookMiddleware()`

Functions that take functions as arguments and/or return functions.
`withPayhook(config, handler)` returns a new handler with verification
built in.

### Adapter Pattern

**Where:** `RedisIdempotencyStore`

Wraps any Redis client behind the `IdempotencyStore` interface.  The
library doesn't care which Redis client you use -- it only depends on
the interface.

### Dependency Inversion

**Where:** `IdempotencyStore` interface

High-level code (`verify()`) depends on an abstraction (the interface),
not a concrete implementation.  This allows swapping stores without
changing the verify logic.

### Barrel Export Pattern

**Where:** `paystack/index.ts`, `flutterwave/index.ts`

A single file re-exports everything from a module, providing a clean
public API surface.

### Middleware Pattern

**Where:** `payhookMiddleware()` (Express)

The `(req, res, next)` signature is Express's way of composing request
processing pipelines.  Each middleware does one thing and passes control
forward.

---

## 14. Security Concepts Explained

### HMAC (Hash-based Message Authentication Code)

Used by Paystack.  It's a way to verify both the **integrity** (the message
wasn't modified) and the **authenticity** (the message came from someone who
knows the secret) of a message.

```
HMAC-SHA512(secret_key, message) = signature
```

Only Paystack and you know the secret key.  If someone modifies the message
body, the HMAC changes.  If someone doesn't know the key, they can't compute
the correct HMAC.

### Timing-Safe Comparison

When comparing signatures, a naive `===` stops at the first different byte.
An attacker can measure response times to figure out how many bytes match,
eventually reconstructing the correct signature.

`crypto.timingSafeEqual()` always compares ALL bytes in constant time,
regardless of where differences are.

### Replay Attacks

An attacker intercepts a valid webhook (maybe via network sniffing or server
logs) and re-sends it later.  The signature is still valid because the message
hasn't changed.

**Defenses:**
1. **Idempotency store:** Track processed event IDs.  Reject duplicates.
2. **Timestamp validation:** Reject events older than a threshold.
3. **Both together:** Defense in depth.

### Raw Body vs. Parsed Body

**Critical for signature verification:** You MUST hash the exact bytes
that Paystack hashed.  If you parse the JSON first and re-serialize it,
whitespace or key ordering might change, producing a different hash.

That's why the library accepts `string | Buffer | Uint8Array` -- it works
with the raw bytes, not a parsed object.

---

## 15. Data Flow Diagrams

### Flow 1: Direct Paystack Verification

```
Customer pays on website
        │
        v
Paystack processes payment
        │
        v
Paystack sends POST to your webhook URL
  Body: {"event":"charge.success","data":{...}}
  Header: x-paystack-signature: <HMAC-SHA512 of body using your secret key>
        │
        v
Your server receives the request
        │
        v
verifyPaystackWebhook({ rawBody, secret, headers })
        │
        ├── Step 1: Extract signature from headers
        │   └── Missing? Return { ok: false, code: 'PAYHOOK_MISSING_HEADER' }
        │
        ├── Step 2: Compute expected = HMAC-SHA512(secret, rawBody)
        │   └── Compare with timing-safe equality
        │   └── Mismatch? Return { ok: false, code: 'PAYHOOK_INVALID_SIGNATURE' }
        │
        ├── Step 3: JSON.parse(rawBody)
        │   └── Parse error? Return { ok: false, code: 'PAYHOOK_INVALID_JSON' }
        │
        └── Return { ok: true, provider: 'paystack', payload: parsedJSON }
```

### Flow 2: Unified verify() with all security layers

```
Incoming webhook request
        │
        v
verify(rawBody, headers, config)
        │
        ├── Phase 1: PROVIDER DETECTION
        │   ├── x-paystack-signature present? → Paystack verify
        │   ├── verif-hash present? → Flutterwave verify
        │   └── Neither? → Return PAYHOOK_UNKNOWN_PROVIDER
        │
        ├── Verification failed? → Return failure immediately
        │
        ├── Phase 2: IDEMPOTENCY CHECK (if store configured)
        │   ├── Extract event ID from payload
        │   ├── ID already in store? → Return PAYHOOK_REPLAY_ATTACK
        │   └── Record ID with TTL
        │
        ├── Phase 3: TIMESTAMP CHECK (if maxAgeSeconds configured)
        │   ├── Extract created_at from payload
        │   ├── Age > maxAgeSeconds? → Return PAYHOOK_STALE_EVENT
        │   └── Within range? → Continue
        │
        └── Return { ok: true, provider, payload }
```

### Flow 3: withPayhook() Next.js Wrapper

```
Next.js receives POST request
        │
        v
withPayhook(config, yourHandler)
        │
  Returns an async function:
        │
        v
async (request: Request) => {
        │
        ├── Read raw body: new Uint8Array(await request.arrayBuffer())
        ├── Convert headers: Object.fromEntries(request.headers)
        ├── Run verify(rawBody, headers, config)
        │
        ├── Not ok? → Return new Response({ error, message }, { status: 400 })
        │
        └── Ok? → Call yourHandler(payload, request)
                    └── You return Response from here
}
```

### Flow 4: Express Middleware Chain

```
app.post('/webhooks',
  express.raw({ type: 'application/json' }),  // Step 1: Raw body parsing
  payhookMiddleware(config),                   // Step 2: Verification
  (req, res) => { ... }                        // Step 3: Your handler
)

Step 1: express.raw()
  req.body = Buffer<raw bytes>    (NOT a parsed object)
        │
        v
Step 2: payhookMiddleware()
  verify(req.body, req.headers, config)
        │
        ├── Failed? → res.status(400).json({ error, message })
        │             (chain stops here, next() NOT called)
        │
        └── Passed? → req.webhook = payload
                       next()  → passes to Step 3
        │
        v
Step 3: Your handler
  const payload = req.webhook;  // Already verified!
  res.sendStatus(200);
```

---

## 16. Glossary

| Term | Definition |
|------|-----------|
| **Webhook** | An HTTP POST request sent by an external service (Paystack/Flutterwave) to your server when an event occurs (e.g., payment completed). |
| **HMAC** | Hash-based Message Authentication Code. A cryptographic function that combines a secret key with a message to produce a signature. |
| **SHA-512** | A hash function that produces a 512-bit (64-byte, 128-hex-character) output. Used as the hash algorithm inside the HMAC. |
| **Timing Attack** | A side-channel attack where an attacker measures how long a comparison takes to determine how many bytes of a secret value they've guessed correctly. |
| **Timing-Safe Comparison** | A comparison that always takes the same amount of time regardless of input, preventing timing attacks. |
| **Idempotency** | The property that performing an operation multiple times has the same effect as performing it once. |
| **TTL (Time-To-Live)** | The duration after which a stored value automatically expires and is deleted. |
| **Replay Attack** | Re-sending a previously valid request to trick a system into processing it again. |
| **Discriminated Union** | A TypeScript union type where one field (the discriminant, like `ok`) determines which variant is active. |
| **Barrel File** | An `index.ts` that re-exports from other files, providing a single import point for a module. |
| **Factory Pattern** | A function that creates and returns a pre-configured object (alternative to `new Class()`). |
| **Higher-Order Function** | A function that takes a function as input and/or returns a function as output. |
| **Closure** | When an inner function "remembers" variables from its outer function's scope, even after the outer function returns. |
| **Subpath Exports** | The `"exports"` field in `package.json` that controls which import paths consumers can use (e.g., `'payhook-ng/paystack'`). |
| **ESM (ES Modules)** | The modern JavaScript module system using `import`/`export` syntax (as opposed to CommonJS's `require`/`module.exports`). |
| **Dependency Inversion** | Depending on abstractions (interfaces) rather than concrete implementations, making code swappable and testable. |
| **Defense in Depth** | Using multiple layers of security so that if one fails, others still protect the system. |
| **Kobo** | The smallest unit of Nigerian Naira (NGN). 1 NGN = 100 kobo. Paystack amounts are in kobo. |
