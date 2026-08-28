import { createFileRoute } from "@tanstack/react-router";
import { HistoryPage } from "@/components/reports";

export const Route = createFileRoute("/reports/history")({
  ssr: false,
  component: HistoryPage,
});
