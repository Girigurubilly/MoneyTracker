import { createFileRoute } from "@tanstack/react-router";
import { RetirementPage } from "@/components/reports";

export const Route = createFileRoute("/reports/retirement")({
  ssr: false,
  component: RetirementPage,
});
