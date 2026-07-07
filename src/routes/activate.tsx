import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthCard } from "@/components/auth/auth-card";
import { TextField } from "@/components/auth/text-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/activate")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
    token_hash: typeof search.token_hash === "string" ? search.token_hash : undefined,
  }),
  component: Activate,
});

type Status = "checking" | "invalid" | "ready";

const DEFAULT_INVALID_MESSAGE = "This invite link has expired — ask your admin to resend it.";

function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "there";
}

function Activate() {
  const navigate = useNavigate();
  const { token, token_hash: tokenHash } = Route.useSearch();
  const inviteToken = tokenHash ?? token;

  // Captured synchronously on first render — supabase-js processes and then
  // strips `#access_token=...`/`#error=...` from the URL asynchronously, so
  // reading window.location.hash inside an effect can already be too late.
  const [initialHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : ""));

  const [status, setStatus] = useState<Status>("checking");
  const [invalidMessage, setInvalidMessage] = useState(DEFAULT_INVALID_MESSAGE);
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    function applySession(sessionUser: User) {
      if (!active) return;
      setUser(sessionUser);
      setName(sessionUser.user_metadata?.full_name ?? sessionUser.user_metadata?.name ?? "");
      setStatus("ready");
    }

    async function run() {
      // Supabase redirects expired/used invite links back here with
      // #error=...&error_code=...&error_description=... instead of a session —
      // supabase-js doesn't surface this itself, so it has to be read manually.
      const hashParams = new URLSearchParams(initialHash.replace(/^#/, ""));
      const errorDescription = hashParams.get("error_description");
      if (errorDescription) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        if (active) {
          setInvalidMessage(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
          setStatus("invalid");
        }
        return;
      }

      // A valid invite link's #access_token=...&refresh_token=... is picked up
      // automatically by the Supabase client (detectSessionInUrl), so by the
      // time getSession() resolves, this reflects the invite sign-in already.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        applySession(data.session.user);
        return;
      }

      // Fallback for email templates that link with ?token_hash=...&type=invite
      // instead of the implicit #access_token= flow.
      if (inviteToken) {
        const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: inviteToken,
          type: "invite",
        });
        if (!verifyError && verified.user) {
          applySession(verified.user);
          return;
        }
      }

      if (active) setStatus("invalid");
    }

    run();
    return () => {
      active = false;
    };
  }, [initialHash, inviteToken]);

  async function handleActivate(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!user) return;

    setError(null);
    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { full_name: name },
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    await supabase.from("profiles").update({ status: "active", full_name: name }).eq("id", user.id);

    navigate({ to: "/dashboard" });
  }

  if (status === "checking") {
    return (
      <AuthCard>
        <div className="mt-10 mb-4 grid place-items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
        </div>
      </AuthCard>
    );
  }

  if (status === "invalid") {
    return (
      <AuthCard>
        <h1 className="mt-6 text-xl font-semibold text-gray-900">This invite link isn't valid</h1>
        <p className="mt-2 text-sm text-gray-500">{invalidMessage}</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className="mt-6 text-xl font-semibold text-gray-900">Welcome, {firstNameOf(name)}</h1>
      <p className="mt-1 text-sm text-gray-500">Set a password to activate your account.</p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleActivate} noValidate>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint={!error ? "Minimum 8 characters" : undefined}
          error={error ?? undefined}
          required
          minLength={8}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
        />

        <SubmitButton loading={submitting}>Activate account</SubmitButton>
      </form>
    </AuthCard>
  );
}
