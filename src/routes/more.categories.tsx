import { createFileRoute } from "@tanstack/react-router";
import { CategoriesPage } from "@/components/more";

export const Route = createFileRoute("/more/categories")({
  ssr: false,
  component: CategoriesPage,
});
