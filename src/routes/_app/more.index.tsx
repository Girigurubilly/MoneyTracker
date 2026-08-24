import { createFileRoute } from "@tanstack/react-router";
import { MoreScreen } from "@/components/more";

export const Route = createFileRoute("/_app/more/")({
  component: MoreScreen,
});
