import { createFileRoute } from "@tanstack/react-router";
import { RetirementAccountsPage } from "@/components/retirement-accounts";

export const Route = createFileRoute("/more/retirement-accounts")({
  ssr: false,
  component: RetirementAccountsPage,
});
