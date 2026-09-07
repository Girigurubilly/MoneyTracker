import { createFileRoute } from "@tanstack/react-router";
import { TrendsPage } from "@/components/reports-trends";

export const Route = createFileRoute("/reports/trends")({
  ssr: false,
  component: TrendsPage,
});
