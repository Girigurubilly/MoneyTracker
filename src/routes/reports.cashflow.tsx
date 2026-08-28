import { createFileRoute } from "@tanstack/react-router";
import { CashflowPage } from "@/components/reports";

export const Route = createFileRoute("/reports/cashflow")({
  ssr: false,
  component: CashflowPage,
});
