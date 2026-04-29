import { prisma } from "./prisma";

/**
 * Phone number that admin events fan out to. Override at runtime via
 * `ADMIN_NOTIFY_PHONE`; defaults to the contact you wired into the app.
 */
export const ADMIN_NOTIFY_PHONE =
  process.env.ADMIN_NOTIFY_PHONE || "8179597508";

/**
 * Persist an admin notification + best-effort fan-out to an outbound channel.
 *
 * Outbound channels (all optional, controlled by env vars):
 *  - `ADMIN_NOTIFY_WEBHOOK` : POSTs JSON {kind,title,body,phone} to this URL.
 *    Plug into IFTTT / Zapier / your own server to forward to SMS/WhatsApp.
 *  - `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM` : if set,
 *    sends an SMS via Twilio. (Add these on Vercel to get real SMS.)
 *
 * If neither is configured, the event is still durably recorded in the
 * `Notification` table and logged to the server console — admin can review
 * past alerts via `/admin/notifications` (future) or directly in the DB.
 */
export async function recordAndNotify(input: {
  kind: string;
  title: string;
  body: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}) {
  const phone = input.phone ?? ADMIN_NOTIFY_PHONE;
  let delivered = false;

  // 1. Try Twilio (real SMS) if configured
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (sid && token && from && phone) {
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const params = new URLSearchParams();
      params.set("To", phone.startsWith("+") ? phone : `+91${phone}`);
      params.set("From", from);
      params.set("Body", `${input.title}\n\n${input.body}`);
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        },
      );
      if (r.ok) delivered = true;
    }
  } catch (e) {
    console.warn("[notify] twilio failed", e);
  }

  // 2. Generic webhook fallback (plug into IFTTT / Zapier / custom)
  try {
    const url = process.env.ADMIN_NOTIFY_WEBHOOK;
    if (url) {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: input.kind,
          title: input.title,
          body: input.body,
          phone,
          metadata: input.metadata ?? null,
          at: new Date().toISOString(),
        }),
      });
      delivered = true;
    }
  } catch (e) {
    console.warn("[notify] webhook failed", e);
  }

  // 3. Always: console log + DB row
  console.log(
    `[notify:${input.kind}] -> ${phone}\n  ${input.title}\n  ${input.body}`,
  );

  try {
    await prisma.notification.create({
      data: {
        kind: input.kind,
        title: input.title,
        body: input.body,
        phone,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        delivered,
      },
    });
  } catch (e) {
    console.warn("[notify] failed to persist notification", e);
  }
}
