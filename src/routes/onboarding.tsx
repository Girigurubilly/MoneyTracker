import { createFileRoute } from "@tanstack/react-router";
import { AppGate } from "@/components/shell";
import { OnboardingScreen } from "@/components/onboarding";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    replay: search.replay === true || search.replay === "true" || search.replay === "1",
  }),
  component: Page,
});

function Page() {
  return (
    <AppGate>
      <OnboardingScreen />
    </AppGate>
  );
}
