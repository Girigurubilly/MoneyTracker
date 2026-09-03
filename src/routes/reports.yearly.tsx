import { createFileRoute } from "@tanstack/react-router";
import { YearlyPage } from "@/components/reports-yearly";

export const Route = createFileRoute("/reports/yearly")({
  ssr: false,
  component: YearlyPage,
});
