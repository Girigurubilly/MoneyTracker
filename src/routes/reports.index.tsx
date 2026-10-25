import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/reports";

export const Route = createFileRoute("/reports/")({
  ssr: false,
  component: DashboardPage,
});
