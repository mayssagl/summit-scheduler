import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { TextField } from "@/components/auth/text-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.session) {
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    navigate({ to: "/dashboard" });
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first, then click “Forgot password?”");
      return;
    }
    setError(null);
    await supabase.auth.resetPasswordForEmail(email);
    setResetSent(true);
  }

  return (
    <AuthCard>
      <h1 className="mt-6 text-xl font-semibold text-foreground">Sign in</h1>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
        />

        {error && (
          <p role="alert" className="-mt-1 text-xs text-destructive">
            {error}
          </p>
        )}

        <SubmitButton loading={loading}>Sign in</SubmitButton>
      </form>

      <div className="mt-4 text-center">
        {resetSent ? (
          <p className="text-xs text-muted-foreground">Check your inbox for a password reset link.</p>
        ) : (
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Forgot password?
          </button>
        )}
      </div>
    </AuthCard>
  );
}
