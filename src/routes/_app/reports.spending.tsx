import { createFileRoute } from "@tanstack/react-router";
import { SpendingScreen } from "@/components/reports";

export const Route = createFileRoute("/_app/reports/spending")({
  component: SpendingScreen,
});
