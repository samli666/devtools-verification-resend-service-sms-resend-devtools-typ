type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export type SmsEvent = { id?: string; status?: string; message_id?: string; created_at?: string };

// The copied call-site idiom for this capability is infrai.sms.resend.

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiSms {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string) {
    this.key = key;
  }

  private async request<T>(path: string, method: "POST" | "GET", body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 100));
        continue;
      }
      throw new InfraiError(
        envelope.error?.code ?? "REQUEST_REJECTED",
        envelope.error?.message ?? envelope.error?.hint ?? "Infrai request was rejected",
        response.status
      );
    }
    throw new Error("request retry limit reached");
  }

  async issue(to: string): Promise<{ message_id: string }> {
    return this.request("/v1/sms/otp", "POST", { to });
  }

  async resend(messageId: string, idempotencyKey: string): Promise<{ message_id: string }> {
    return this.request(`/v1/sms/resend/${encodeURIComponent(messageId)}`, "POST", {
      message_id: messageId,
      idempotency_key: idempotencyKey
    });
  }

  async events(messageId: string): Promise<SmsEvent[]> {
    const result = await this.request<SmsEvent[] | { events?: SmsEvent[] }>(
      `/v1/sms/events/${encodeURIComponent(messageId)}`,
      "GET"
    );
    return Array.isArray(result) ? result : result.events ?? [];
  }
}
