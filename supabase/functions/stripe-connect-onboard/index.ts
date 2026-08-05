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
    return json({ error: "Server misconfigured: missing STRIPE_SECRET_KEY secret. Ask an admin to connect Stripe first." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Missing Authorization header." }, 401);

  let body: { origin?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body — origin falls back to empty below
  }
  if (!body.origin) return json({ error: "origin is required." }, 400);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerAuth, error: callerAuthError } = await callerClient.auth.getUser();
  if (callerAuthError || !callerAuth.user) return json({ error: "Not authenticated." }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, full_name, role, stripe_connect_account_id")
    .eq("id", callerAuth.user.id)
    .single();
  if (!profile) return json({ error: "Profile not found." }, 404);
  if (profile.role !== "instructor") return json({ error: "Only instructors have a payout account." }, 403);

  const origin = body.origin;

  try {
    let accountId = profile.stripe_connect_account_id as string | null;

    if (!accountId) {
      const account = await stripeRequest("accounts", stripeKey, {
        type: "express",
        email: profile.email,
        "capabilities[transfers][requested]": "true",
        "business_type": "individual",
      });
      accountId = account.id;
      await admin
        .from("profiles")
        .update({ stripe_connect_account_id: accountId, stripe_onboarding_status: "pending" })
        .eq("id", profile.id);
    }

    const link = await stripeRequest("account_links", stripeKey, {
      account: accountId!,
      refresh_url: `${origin}/payments`,
      return_url: `${origin}/payments`,
      type: "account_onboarding",
    });

    return json({ url: link.url });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Failed to start Stripe onboarding." }, 502);
  }
});
