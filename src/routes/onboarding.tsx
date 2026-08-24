import { createFileRoute } from "@tanstack/react-router";
import { OnboardingScreen } from "@/components/onboarding";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingScreen,
});
