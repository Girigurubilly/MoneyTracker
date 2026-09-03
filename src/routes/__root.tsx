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
            __html: `(function(){try{var r=document.documentElement;var t=localStorage.getItem("hk-life-money-theme");if(t)r.setAttribute("data-theme",t);var c=JSON.parse(localStorage.getItem("hk-life-money-theme-custom")||"{}");var s=r.style;var m={background:"--color-background",foreground:"--color-foreground",elevated:"--color-elevated",muted:"--color-muted",accent:"--color-accent"};for(var k in m){if(c[k])s.setProperty(m[k],c[k]);}if(c.fontId&&c.fontId!=="theme")r.setAttribute("data-font",c.fontId);if(c.fontSize&&c.fontSize!=="md")r.setAttribute("data-font-size",c.fontSize);}catch(e){}})();`,
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
