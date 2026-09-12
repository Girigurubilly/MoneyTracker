import { createFileRoute } from "@tanstack/react-router";
import { HoldingsPage } from "@/components/holdings";

export const Route = createFileRoute("/more/holdings")({
  ssr: false,
  component: HoldingsPage,
});
