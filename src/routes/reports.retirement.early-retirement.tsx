import { createFileRoute } from "@tanstack/react-router";
import { EarlyRetirementPlanPage } from "@/components/reports-life-plan";

export const Route = createFileRoute("/reports/retirement/early-retirement")({
  ssr: false,
  component: EarlyRetirementPlanPage,
});
