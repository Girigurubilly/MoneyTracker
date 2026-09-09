import { createFileRoute } from "@tanstack/react-router";
import { WorthTrendPage } from "@/components/reports-worth";

export const Route = createFileRoute("/reports/worth")({
  ssr: false,
  component: WorthTrendPage,
});
