# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-29

### Added

- Paystack HMAC SHA-512 webhook signature verification
- Flutterwave secret hash webhook verification
- Unified `verify()` function with auto-detection of provider from headers
- `createPayhook()` factory function for centralized configuration
- Next.js App Router helpers for both Paystack and Flutterwave
- `withPayhook()` Next.js route handler wrapper (`payhook-ng/nextjs`)
- Express middleware (`payhook-ng/express`)
- Replay prevention with `InMemoryIdempotencyStore`
- `RedisIdempotencyStore` adapter (works with `ioredis` and `redis`)
- Timestamp-based stale event rejection (`maxAgeSeconds`)
- Full TypeScript type definitions for Paystack and Flutterwave webhook payloads
- Typed error classes (`MissingHeaderError`, `InvalidSignatureError`, `InvalidJsonError`, `ReplayAttackError`)
- Subpath exports: `payhook-ng/paystack`, `payhook-ng/flutterwave`, `payhook-ng/nextjs`, `payhook-ng/express`
- Comprehensive test suite with Vitest
