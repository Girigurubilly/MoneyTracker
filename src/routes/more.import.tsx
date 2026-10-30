import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/more/import")({
  ssr: false,
  component: () => <Navigate to="/more/backup" replace />,
});
