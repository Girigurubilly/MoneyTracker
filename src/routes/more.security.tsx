import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/more/security")({
  ssr: false,
  component: () => <Navigate to="/more" replace />,
});
