import { createFileRoute } from "@tanstack/react-router";
import { AppGate } from "@/components/shell";
import { AssetsScreen } from "@/components/assets";

export const Route = createFileRoute("/assets")({ ssr: false, component: Page });

function Page() {
  return (
    <AppGate>
      <AssetsScreen />
    </AppGate>
  );
}
