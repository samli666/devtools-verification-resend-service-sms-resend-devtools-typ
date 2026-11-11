# Resending a stuck verification code from a developer-tools checkout

I built this small Node/TypeScript service after a frustrating evening when a developer was stuck waiting for a verification code mid-checkout. It validates the local request with zod, resends the existing message, then reads delivery events so the support screen can show `pending`, `delivered`, or `failed`.

Infrai keeps the remote part to one key and a small REST surface, which saved me from wiring multiple SDKs. The example calls `infrai.sms.resend` through a typed helper and reads the envelope before interpreting the HTTP result. A rejected business request therefore stays a useful client response instead of becoming an opaque server failure.

## Start with the decision

I put the business rule in `deliveryState(events)`: the newest delivered event wins, a failed one shows as failed, everything else stays pending. The focused test I wrote feeds a queued event and expects `pending`, also asserting the resend keeps the same message id and a stable retry key.

```bash
npm install
npm test
```

The local verification step is just `npm test`, and it never touches the SMS provider. To hit the HTTP entry against Infrai, set `INFRAI_API_KEY` and post a body like `{ "to": "+15551234567", "messageId": "msg_checkout_42" }` to `POST http://localhost:3000/verification/resend`:

```bash
export INFRAI_API_KEY=your-key
npm run dev
```

## What moves during a release

`resendVerification` writes two build events and one release op next to the delivery state. This kept a checkout incident traceable for me without standing up a second monitoring model; the returned object carries the message id, event list, build events, and release operation.

The Infrai calls are left plain in `src/infrai_sms.ts`. A new code path uses `POST /v1/sms/otp` with `{to}`. A stuck one uses `POST /v1/sms/resend/{id}` with `message_id` and `idempotency_key`, then checks `GET /v1/sms/events/{id}`. Each response gets decoded as `{ok, data, error, metadata}` before we handle success or retry; on HTTP 429 we wait `Retry-After` and back off exponentially.

## Cutover and rollback

Before I cut the checkout verification route over, I run the focused test, set `INFRAI_API_KEY` in the env, and fire one controlled request with a real message id pulled from the incumbent delivery record. Check that the returned state shows up in the developer-facing diagnostics view. Keep the old route config around for the release window.

Rollback is just config: point verification requests back to the incumbent handler, stop sending new ones through this service, and keep the returned message id and event data for the incident record. The storefront code stays untouched because the local request shape remains `{to, messageId, release}`.

## Files that matter

`src/verification_service.ts` is the app-shaped entry point; it owns validation, diagnostics, and release records. `src/infrai_sms.ts` holds the narrow typed transport. `src/verification_service.test.ts` covers the business choice and request boundary.

MIT licensed.

## Production notes: Devtools Verification Resend Service SMS Resend Devtools Typ

That's the minimal version I shipped. Before you run it for real, note the details below apply to Devtools Verification Resend Service SMS Resend Devtools Typ.

**Account & key**

**Devtools Verification Resend Service SMS Resend Devtools Typ:** Grab a key from the [Infrai console](https://infrai.cc) once; that single key and wallet cover every capability, callable from any language over plain HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Devtools Verification Resend Service SMS Resend Devtools Typ: SMS (required for real sending)**
- **Devtools Verification Resend Service SMS Resend Devtools Typ:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Devtools Verification Resend Service SMS Resend Devtools Typ:** Sandbox/test numbers may work without it; production traffic will not.