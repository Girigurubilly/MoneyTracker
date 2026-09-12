import { createFileRoute } from "@tanstack/react-router";
import { StockPricesPage } from "@/components/reports-prices";

export const Route = createFileRoute("/reports/prices")({
  ssr: false,
  component: StockPricesPage,
});
