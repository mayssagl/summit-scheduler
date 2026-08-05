import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Verifies Stripe's webhook signature ourselves (Web Crypto HMAC-SHA256)
// rather than pulling in the Stripe SDK just for this one check.
// https://docs.stripe.com/webhooks#verify-manually
async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Tolerate up to 5 minutes of clock skew, same as Stripe's own libraries.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;

  return expected === signature;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!supabaseUrl || !serviceKey) return json({ error: "Server misconfigured." }, 500);
  if (!webhookSecret) return json({ error: "Server misconfigured: missing STRIPE_WEBHOOK_SECRET secret." }, 500);

  const signatureHeader = req.headers.get("Stripe-Signature") ?? "";
  const rawBody = await req.text();

  const valid = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
  if (!valid) return json({ error: "Invalid signature." }, 400);

  const event = JSON.parse(rawBody);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (event.type === "account.updated") {
    const account = event.data.object;
    const status = account.details_submitted && account.payouts_enabled ? "complete" : "pending";
    await admin.from("profiles").update({ stripe_onboarding_status: status }).eq("stripe_connect_account_id", account.id);
  }

  // Fires if the automatic payout from the connected account's Stripe
  // balance to the instructor's actual bank account fails after we already
  // marked the request 'paid' — flip it back so an admin notices and retries.
  if (event.type === "payout.failed" || event.type === "transfer.reversed") {
    const object = event.data.object;
    const payoutRequestId = object.metadata?.payout_request_id;
    if (payoutRequestId) {
      await admin
        .from("payout_requests")
        .update({ status: "failed", failure_reason: object.failure_message ?? "Payout failed at Stripe." })
        .eq("id", payoutRequestId);
    }
  }

  return json({ received: true });
});
