import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function stripeRequest(path: string, secretKey: string, params: Record<string, string>) {
  const body = new URLSearchParams(params);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? `Stripe request to ${path} failed (${response.status}).`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Server misconfigured: missing Supabase environment variables." }, 500);
  }
  if (!stripeKey) {
    return json({ error: "Server misconfigured: missing STRIPE_SECRET_KEY secret." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Missing Authorization header." }, 401);

  let body: { payout_request_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (!body.payout_request_id) return json({ error: "payout_request_id is required." }, 400);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerAuth, error: callerAuthError } = await callerClient.auth.getUser();
  if (callerAuthError || !callerAuth.user) return json({ error: "Not authenticated." }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", callerAuth.user.id).single();
  if (callerProfile?.role !== "admin") return json({ error: "Only admins can send payouts." }, 403);

  const { data: payoutRequest } = await admin
    .from("payout_requests")
    .select("id, instructor_id, amount, currency, status")
    .eq("id", body.payout_request_id)
    .single();
  if (!payoutRequest) return json({ error: "Payout request not found." }, 404);
  if (payoutRequest.status !== "requested") return json({ error: `This request is already ${payoutRequest.status}.` }, 409);

  const { data: instructor } = await admin
    .from("profiles")
    .select("stripe_connect_account_id, stripe_onboarding_status")
    .eq("id", payoutRequest.instructor_id)
    .single();
  if (!instructor?.stripe_connect_account_id || instructor.stripe_onboarding_status !== "complete") {
    return json({ error: "This instructor hasn't finished connecting their payout account yet." }, 409);
  }

  await admin.from("payout_requests").update({ status: "processing" }).eq("id", payoutRequest.id);

  try {
    // A Transfer moves funds from the platform's Stripe balance into the
    // connected account's Stripe balance. From there, Stripe's automatic
    // payout schedule sends it on to the instructor's actual bank account —
    // that leg isn't controlled by this app; account.updated / payout.*
    // webhooks (see stripe-webhook) reflect it back if something fails.
    const transfer = await stripeRequest("transfers", stripeKey, {
      amount: String(Math.round(payoutRequest.amount * 100)),
      currency: payoutRequest.currency,
      destination: instructor.stripe_connect_account_id,
      "metadata[payout_request_id]": payoutRequest.id,
    });

    await admin
      .from("payout_requests")
      .update({ status: "paid", stripe_transfer_id: transfer.id })
      .eq("id", payoutRequest.id);

    return json({ ok: true, transfer_id: transfer.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe transfer failed.";
    await admin.from("payout_requests").update({ status: "failed", failure_reason: message }).eq("id", payoutRequest.id);
    return json({ error: message }, 502);
  }
});
