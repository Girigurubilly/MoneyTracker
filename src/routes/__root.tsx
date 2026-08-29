import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { assetUrl } from "@/lib/base";
import appCss from "../styles.css?url";

const APP_NAME = "HK Life Money";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#f2f2f7" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: assetUrl("favicon.svg") },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: assetUrl("__grok/manifest.webmanifest") },
      { rel: "apple-touch-icon", href: assetUrl("__grok/icon-180.png") },
    ],
  }),
  component: () => (
    <html lang="zh-HK" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("hk-life-money-theme");if(t)document.documentElement.setAttribute("data-theme",t);var c=JSON.parse(localStorage.getItem("hk-life-money-theme-custom")||"{}");var s=document.documentElement.style;if(c.background)s.setProperty("--color-background",c.background);if(c.foreground)s.setProperty("--color-foreground",c.foreground);if(c.accent)s.setProperty("--color-accent",c.accent);}catch(e){}})();`,
          }}
        />
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
