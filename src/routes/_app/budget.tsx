import { createFileRoute } from "@tanstack/react-router";
import { BudgetScreen } from "@/components/budget";

export const Route = createFileRoute("/_app/budget")({
  component: BudgetScreen,
});
