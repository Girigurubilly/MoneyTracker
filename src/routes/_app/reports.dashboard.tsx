import { createFileRoute } from "@tanstack/react-router";
import { LifeDashboard } from "@/components/reports";

export const Route = createFileRoute("/_app/reports/dashboard")({
  component: LifeDashboard,
});
