import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routerBasepath } from "@/lib/base";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    basepath: routerBasepath(),
    defaultErrorComponent: AppErrorComponent,
  });
}
