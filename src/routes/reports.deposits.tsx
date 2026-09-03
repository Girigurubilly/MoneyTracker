import { createFileRoute } from "@tanstack/react-router";
import { DepositsPage } from "@/components/reports-deposits";

export const Route = createFileRoute("/reports/deposits")({
  ssr: false,
  component: DepositsPage,
});
