import { createFileRoute } from "@tanstack/react-router";
import { CashflowScreen } from "@/components/reports";

export const Route = createFileRoute("/_app/reports/cashflow")({
  component: CashflowScreen,
});
