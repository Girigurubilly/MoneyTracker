import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppGate } from "@/components/shell";

export const Route = createFileRoute("/reports")({
  ssr: false,
  component: Layout,
});

function Layout() {
  return (
    <AppGate>
      <Outlet />
    </AppGate>
  );
}
