import { createFileRoute } from "@tanstack/react-router";
import { TravelScreen } from "@/components/reports";

export const Route = createFileRoute("/_app/reports/travel/")({
  component: TravelScreen,
});
