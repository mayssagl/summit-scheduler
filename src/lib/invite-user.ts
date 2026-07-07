import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/auth";

interface InviteUserInput {
  email: string;
  fullName: string;
  role: AppRole;
  accessToken: string;
  redirectTo: string;
}

function validateInput(data: unknown): InviteUserInput {
  if (typeof data !== "object" || data === null) throw new Error("Invalid request.");
  const { email, fullName, role, accessToken, redirectTo } = data as Record<string, unknown>;
  if (typeof email !== "string" || !email) throw new Error("Email is required.");
  if (typeof fullName !== "string" || !fullName) throw new Error("Name is required.");
  if (role !== "admin" && role !== "delivery_manager" && role !== "instructor") throw new Error("Invalid role.");
  if (typeof accessToken !== "string" || !accessToken) throw new Error("Not authenticated.");
  if (typeof redirectTo !== "string" || !redirectTo) throw new Error("Missing redirect URL.");
  return { email, fullName, role, accessToken, redirectTo };
}

export const inviteUser = createServerFn({ method: "POST" })
  .validator(validateInput)
  .handler(async ({ data }) => {
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey) throw new Error("Server is missing Supabase URL/anon key configuration.");
    if (!serviceKey) {
      throw new Error(
        "Invites aren't configured on this server yet — add SUPABASE_SERVICE_ROLE_KEY (server-only, from Supabase Project Settings > API) to the environment.",
      );
    }

    // Verify the caller is a real, currently-authenticated admin before doing
    // anything privileged — the service-role client below bypasses RLS entirely.
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerAuth, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerAuth.user) throw new Error("Not authenticated.");

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", callerAuth.user.id)
      .single();
    if (callerProfile?.role !== "admin") throw new Error("Only admins can invite users.");

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName },
      redirectTo: data.redirectTo,
    });
    if (inviteError || !invited.user) throw new Error(inviteError?.message ?? "Failed to invite user.");

    const { error: profileError } = await admin.from("profiles").insert({
      id: invited.user.id,
      full_name: data.fullName,
      email: data.email,
      role: data.role,
      status: "invited",
    });
    if (profileError) throw new Error(profileError.message);

    return { userId: invited.user.id as string };
  });
