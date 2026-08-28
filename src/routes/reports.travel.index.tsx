import { createFileRoute } from "@tanstack/react-router";
import { TravelPage } from "@/components/reports";

export const Route = createFileRoute("/reports/travel/")({
  ssr: false,
  component: TravelPage,
});
