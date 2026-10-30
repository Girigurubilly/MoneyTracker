import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/reports/history")({
  ssr: false,
  component: () => <Navigate to="/reports/balance" replace />,
});
