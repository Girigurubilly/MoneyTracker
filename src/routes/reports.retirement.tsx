import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/reports/retirement")({
  ssr: false,
  component: Outlet,
});
