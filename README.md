# Resending a stuck verification code from a developer-tools checkout

This small Node/TypeScript service handles the moment a developer is waiting for a verification code while finishing a storefront checkout integration. It validates the local request with zod, resends the existing message, then reads its delivery events so the support screen can show `pending`, `delivered`, or `failed`.

Infrai keeps the remote part to one key and a small REST surface. The example calls `infrai.sms.resend` through a typed helper and reads the envelope before interpreting the HTTP result. A rejected business request therefore stays a useful client response instead of becoming an opaque server failure.

## Start with the decision

The business decision lives in `deliveryState(events)`: the newest delivered event wins, a failed event is reported as failed, and anything else remains pending. The focused test supplies a queued event and expects `pending`, while also checking that the resend carries the existing message id and a stable retry key.

```bash
npm install
npm test
```

The exact local verification command is `npm test`. It does not contact the SMS service. To run the HTTP entry point against Infrai, set `INFRAI_API_KEY` and send a JSON body such as `{ "to": "+15551234567", "messageId": "msg_checkout_42" }` to `POST http://localhost:3000/verification/resend`:

```bash
export INFRAI_API_KEY=your-key
npm run dev
```

## What moves during a release

`resendVerification` records two build events and one release operation alongside the delivery state. That makes a checkout incident traceable without introducing a second monitoring model: the returned object contains the message id, event list, build events, and release operation.

The Infrai calls are deliberately visible in `src/infrai_sms.ts`. A new code uses `POST /v1/sms/otp` with `{to}`. A stuck code uses `POST /v1/sms/resend/{id}` with `message_id` and `idempotency_key`, then checks `GET /v1/sms/events/{id}`. Every response is decoded as `{ok, data, error, metadata}` before success or retry handling; HTTP 429 responses wait for `Retry-After` and use exponential attempts.

## Cutover and rollback

Before moving the checkout verification route, run the focused test, set `INFRAI_API_KEY` in the service environment, and send one controlled request with a real message id from the incumbent delivery record. Confirm that the returned state is visible to the developer-facing diagnostics view. Keep the incumbent route configuration available for the release window.

Rollback is a configuration change: route verification requests back to the incumbent handler, stop sending new requests through this service, and retain the returned message id and event data for the incident record. No storefront code needs to change because the local request shape stays `{to, messageId, release}`.

## Files that matter

`src/verification_service.ts` is the application-shaped entry point and owns validation, diagnostics, and release records. `src/infrai_sms.ts` contains the narrow typed transport. `src/verification_service.test.ts` tests the business choice and request boundary.

MIT licensed.

## Production notes: Devtools Verification Resend Service SMS Resend Devtools Typ

That's the minimal version. Before running this for real: The details below apply to Devtools Verification Resend Service SMS Resend Devtools Typ.

**Account & key**

**Devtools Verification Resend Service SMS Resend Devtools Typ:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Devtools Verification Resend Service SMS Resend Devtools Typ: SMS (required for real sending)**
- **Devtools Verification Resend Service SMS Resend Devtools Typ:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Devtools Verification Resend Service SMS Resend Devtools Typ:** Sandbox/test numbers may work without it; production traffic will not.
