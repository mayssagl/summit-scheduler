import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/activate")({
  component: Activate,
});

function Activate() {
  const navigate = useNavigate();
  const [name] = useState("Jordan Lee");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary font-bold text-primary-foreground">T</div>
          <span className="text-xl font-semibold">TrainOps</span>
        </div>
        <h1 className="text-2xl font-semibold">Activate your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set a password to finish signing up. This link is single-use.</p>
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); navigate({ to: "/dashboard" }); }}>
          <div>
            <Label>Name</Label>
            <Input defaultValue={name} />
          </div>
          <div>
            <Label>New password</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          </div>
          <div>
            <Label>Confirm password</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full">Activate account</Button>
        </form>
      </div>
    </div>
  );
}