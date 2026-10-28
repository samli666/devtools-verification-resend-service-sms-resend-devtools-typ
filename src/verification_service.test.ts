import { test } from "node:test";
import assert from "node:assert/strict";
import { deliveryState, resendVerification } from "./verification_service.js";

test("a resend with no delivered event remains pending", async () => {
  const calls: Array<[string, unknown]> = [];
  const client = {
    resend: async (id: string, key: string) => { calls.push(["resend", { id, key }]); return { message_id: id }; },
    events: async () => [{ status: "queued" }]
  } as never;
  const result = await resendVerification({ to: "+15551234567", messageId: "msg_checkout_42" }, client);
  assert.equal(result.state, "pending");
  assert.deepEqual(calls, [["resend", { id: "msg_checkout_42", key: "verification:msg_checkout_42" }]]);
  assert.equal(deliveryState([{ status: "delivered" }]), "delivered");
});
