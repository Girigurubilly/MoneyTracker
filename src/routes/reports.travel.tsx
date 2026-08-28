import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/reports/travel")({
  ssr: false,
  component: Outlet,
});
