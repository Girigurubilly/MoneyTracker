import { createFileRoute } from "@tanstack/react-router";
import { AssetsScreen } from "@/components/assets";

export const Route = createFileRoute("/_app/assets/")({
  component: AssetsScreen,
});
