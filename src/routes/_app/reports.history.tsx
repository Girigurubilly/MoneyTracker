import { createFileRoute } from "@tanstack/react-router";
import { HistoryReports } from "@/components/reports";

export const Route = createFileRoute("/_app/reports/history")({
  component: HistoryReports,
});
