import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/reports";

export const Route = createFileRoute("/reports/dashboard")({
  ssr: false,
  component: DashboardPage,
});
