import { createFileRoute } from "@tanstack/react-router";
import { BalancePage } from "@/components/reports-balance";

export const Route = createFileRoute("/reports/balance")({
  ssr: false,
  component: BalancePage,
});
