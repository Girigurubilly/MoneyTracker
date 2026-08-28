import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppGate } from "@/components/shell";

export const Route = createFileRoute("/more")({
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
