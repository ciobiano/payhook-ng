


Based on the PRD analysis and current project state (basic TypeScript setup with empty source file), here's a comprehensive task breakdown for **PayHook.ng**:

---

## **Phase 1: Core Infrastructure**

### 1.1 Project Setup
- [ ] Configure `package.json` with proper metadata (name, description, keywords, author, repository, license)
- [ ] Set up proper entry points (`main`, `module`, `types`, `exports`)
- [ ] Configure `tsconfig.json` with `outDir: "./dist"`, `rootDir: "./src"`
- [ ] Add build script (`tsc`)
- [ ] Add `.npmignore` or `files` field to include only dist files
- [ ] Create `README.md` with badges, installation, quick start

### 1.2 Type Definitions
- [ ] Define `PaystackWebhookEvent` types (all event types: `charge.success`, `transfer.success`, etc.)
- [ ] Define `FlutterwaveWebhookEvent` types
- [ ] Define unified `WebhookVerificationResult<T>` type
- [ ] Define `PayhookConfig` options interface
- [ ] Define `VerificationError` custom error types

---

## **Phase 2: Signature Verification**

### 2.1 Paystack Verification
- [ ] Implement HMAC SHA512 signature verification (using `x-paystack-signature` header)
- [ ] Parse raw body (handle both string and Buffer)
- [ ] Compare computed hash vs received signature (timing-safe comparison)
- [ ] Return typed webhook payload on success

### 2.2 Flutterwave Verification
- [ ] Implement `verif-hash` header comparison
- [ ] Handle secret hash from Flutterwave dashboard
- [ ] Return typed webhook payload on success

### 2.3 Unified API
- [ ] Create `createPayhook()` factory function
- [ ] Auto-detect provider from headers (Paystack vs Flutterwave)
- [ ] Provide `verifyPaystack()` and `verifyFlutterwave()` standalone exports
- [ ] Implement `verify()` unified method

---

## **Phase 3: Security Features**

### 3.1 Replay Attack Prevention
- [ ] Design idempotency key extraction (event ID from payload)
- [ ] Define `IdempotencyStore` interface (pluggable storage)
- [ ] Implement in-memory store (default, with TTL)
- [ ] Implement Redis store adapter (optional)
- [ ] Add timestamp validation (reject old events beyond threshold)

### 3.2 Error Handling
- [ ] Create `PayhookError` base class
- [ ] Create `SignatureVerificationError`
- [ ] Create `ReplayAttackError`
- [ ] Create `InvalidPayloadError`
- [ ] Include actionable error messages

---

## **Phase 4: Framework Integrations**

### 4.1 Next.js App Router Support
- [ ] Create `withPayhook()` wrapper for Route Handlers
- [ ] Handle `request.text()` for raw body access
- [ ] Return proper `NextResponse` on errors
- [ ] Document App Router usage pattern

### 4.2 Express/Node.js Support
- [ ] Create Express middleware (`payhookMiddleware()`)
- [ ] Handle `req.rawBody` pattern (document body-parser config)
- [ ] Attach verified payload to `req.webhook`

### 4.3 Generic Handler
- [ ] Export low-level `verify(rawBody, signature, secret)` for custom use

---

## **Phase 5: Testing**

### 5.1 Test Setup
- [ ] Install Vitest or Jest
- [ ] Configure test scripts

### 5.2 Unit Tests
- [ ] Test Paystack signature verification (valid/invalid)
- [ ] Test Flutterwave hash verification (valid/invalid)
- [ ] Test timing-safe comparison
- [ ] Test replay attack detection
- [ ] Test payload parsing
- [ ] Test error classes

### 5.3 Integration Tests
- [ ] Test Next.js handler wrapper
- [ ] Test Express middleware
- [ ] Test with real webhook payload samples (from docs)

---

## **Phase 6: Documentation & Publishing**

### 6.1 Documentation
- [ ] Write comprehensive `README.md` (problem, solution, installation, usage)
- [ ] Add Paystack quick start example
- [ ] Add Flutterwave quick start example
- [ ] Add Next.js App Router example
- [ ] Add Express example
- [ ] Document idempotency/replay prevention setup
- [ ] Add security best practices section
- [ ] Add TypeScript usage notes

### 6.2 npm Publishing
- [ ] Create `.npmrc` for publishing config
- [ ] Add `prepublishOnly` script (build + test)
- [ ] Add `CHANGELOG.md`
- [ ] Set up semantic versioning
- [ ] Publish initial version to npm

---

## **Task Priority Order**

| Priority | Tasks                                                                  |
| -------- | ---------------------------------------------------------------------- |
| **P0**   | Paystack signature verification, Type definitions, Basic project setup |
| **P1**   | Flutterwave verification, Unified API, Error handling                  |
| **P2**   | Next.js integration, Replay prevention                                 |
| **P3**   | Express middleware, Testing                                            |
| **P4**   | Documentation, npm publishing                                          |
---

Would you like me to start implementing these tasks? I can begin with the P0 items (core Paystack verification with proper types).