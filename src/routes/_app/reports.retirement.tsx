import { createFileRoute } from "@tanstack/react-router";
import { RetirementScreen } from "@/components/reports";

export const Route = createFileRoute("/_app/reports/retirement")({
  component: RetirementScreen,
});
