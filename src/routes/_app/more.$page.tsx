import { createFileRoute } from "@tanstack/react-router";
import {
  BackupPage,
  CategoriesPage,
  FxPage,
  ImportPage,
  PreferencesPage,
  RecurringPage,
  ScreensPage,
  SecurityPage,
} from "@/components/more";

export const Route = createFileRoute("/_app/more/$page")({
  component: MorePageRoute,
});

function MorePageRoute() {
  const { page } = Route.useParams();
  switch (page) {
    case "categories":
      return <CategoriesPage />;
    case "recurring":
      return <RecurringPage />;
    case "fx":
      return <FxPage />;
    case "import":
      return <ImportPage />;
    case "backup":
      return <BackupPage />;
    case "security":
      return <SecurityPage />;
    case "preferences":
      return <PreferencesPage />;
    case "screens":
      return <ScreensPage />;
    default:
      return <ScreensPage />;
  }
}
