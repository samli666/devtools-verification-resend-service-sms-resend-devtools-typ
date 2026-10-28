import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { InfraiError, InfraiSms, type SmsEvent } from "./infrai_sms.js";

export const resendRequest = z.object({
  to: z.string().min(7),
  messageId: z.string().min(1),
  release: z.string().min(1).default("verification-resend")
});

export type BuildEvent = { name: "verification_resend_requested" | "delivery_state_read"; at: string };
export type ReleaseOperation = { release: string; action: "resend" | "rollback"; at: string };
export type Diagnostics = { messageId: string; state: string; events: SmsEvent[]; build: BuildEvent[]; release: ReleaseOperation[] };

export function deliveryState(events: SmsEvent[]): string {
  const latest = events.at(-1)?.status;
  return latest === "delivered" ? "delivered" : latest === "failed" ? "failed" : "pending";
}

export async function resendVerification(input: unknown, client: InfraiSms): Promise<Diagnostics> {
  const request = resendRequest.parse(input);
  const build: BuildEvent[] = [{ name: "verification_resend_requested", at: new Date().toISOString() }];
  const release: ReleaseOperation[] = [{ release: request.release, action: "resend", at: new Date().toISOString() }];
  await client.resend(request.messageId, `verification:${request.messageId}`);
  const events = await client.events(request.messageId);
  build.push({ name: "delivery_state_read", at: new Date().toISOString() });
  return { messageId: request.messageId, state: deliveryState(events), events, build, release };
}

function json(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const key = process.env.INFRAI_API_KEY;
if (process.argv[1]?.endsWith("verification_service.ts") && key) {
  const client = new InfraiSms(key);
  createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/verification/resend") return json(res, 404, { error: "route not found" });
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const result = await resendVerification(JSON.parse(Buffer.concat(chunks).toString("utf8")), client);
      json(res, 200, result);
    } catch (error) {
      const status = error instanceof z.ZodError ? 400 : error instanceof InfraiError && error.status < 500 ? error.status : 502;
      json(res, status, { error: error instanceof Error ? error.message : "request failed" });
    }
  }).listen(Number(process.env.PORT ?? 3000), () => console.log("verification service listening on port 3000"));
}

export { randomUUID };
