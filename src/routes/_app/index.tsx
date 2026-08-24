import { createFileRoute } from "@tanstack/react-router";
import { TodayScreen } from "@/components/today";

export const Route = createFileRoute("/_app/")({
  component: TodayScreen,
});
