import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RoleRoute } from "@/components/role-route";

export const Route = createFileRoute("/_app")({
  component: () => (
    <RoleRoute>
      <AppShell />
    </RoleRoute>
  ),
});
