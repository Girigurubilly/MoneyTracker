import { createFileRoute } from "@tanstack/react-router";
import { AppGate } from "@/components/shell";
import { TodayScreen } from "@/components/today";

export const Route = createFileRoute("/")({ ssr: false, component: Home });

function Home() {
  return (
    <AppGate>
      <TodayScreen />
    </AppGate>
  );
}
