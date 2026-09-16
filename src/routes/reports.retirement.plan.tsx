import { createFileRoute } from "@tanstack/react-router";
import { FirePlanPage } from "@/components/reports-fire";

export const Route = createFileRoute("/reports/retirement/plan")({
  ssr: false,
  component: FirePlanPage,
});
