import { createFileRoute } from "@tanstack/react-router";
import { SpendingPage } from "@/components/reports";

export const Route = createFileRoute("/reports/spending")({
  ssr: false,
  component: SpendingPage,
});
