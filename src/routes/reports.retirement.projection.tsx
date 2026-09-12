import { createFileRoute } from "@tanstack/react-router";
import { RetirementProjectionPage } from "@/components/reports-retire";

export const Route = createFileRoute("/reports/retirement/projection")({
  ssr: false,
  component: RetirementProjectionPage,
});
