import { createFileRoute } from "@tanstack/react-router";
import { RetirementSetupPage } from "@/components/retirement-setup";

export const Route = createFileRoute("/reports/retirement/setup")({
  ssr: false,
  component: RetirementSetupPage,
});
