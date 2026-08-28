import { createFileRoute } from "@tanstack/react-router";
import { AppGate } from "@/components/shell";
import { BudgetScreen } from "@/components/budget";

export const Route = createFileRoute("/budget")({ ssr: false, component: Page });

function Page() {
  return (
    <AppGate>
      <BudgetScreen />
    </AppGate>
  );
}
