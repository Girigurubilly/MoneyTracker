import { useEffect, useRef, type ReactNode } from "react";
import { Link, Navigate, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi, readOnboarded } from "@/store/ui";
import { isDarkTheme } from "@/lib/theme";
import { applyPwaIcon, readSavedPwaIcon } from "@/lib/pwa-icon";
import { Overlay } from "@/components/shared";
import { CategoryIcon } from "@/components/category-icon";
import { defaultNavIcons, type NavSlot } from "@/lib/nav-icons";
import { AddFlow } from "@/components/add-sheet";
import { SearchFlow } from "@/components/search-sheet";
import { TxDetail } from "@/components/tx-detail";
import { TripLinkCatcher, TripProposal } from "@/components/trip-proposal";
import { TripEstimateSheet } from "@/components/trip-estimate";
import { stashTripHash } from "@/lib/trip-link";
import { assetUrl } from "@/lib/base";
import { isApplyingRemote, markLocalEdit, runDailyDriveSync, syncWithDrive } from "@/lib/drive-sync";
import { runDailyOpen } from "@/lib/daily-open";

export function AppGate({ children }: { children: ReactNode }) {
  const ready = useApp((s) => s.ready);
  const hydrate = useApp((s) => s.hydrate);
  const onboarded = useUi((s) => s.onboarded);
  const setOnboarded = useUi((s) => s.setOnboarded);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const theme = useUi((s) => s.theme);
  const access = useUi((s) => s.accessMode);

  const search = useRouterState({ select: (s) => s.location.search }) as { replay?: boolean | string };
  const replay = search?.replay === true || search?.replay === "1" || search?.replay === "true";

  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const prev = document.documentElement.dataset.duo;
      let pose = "phone";
      if (!coarse) {
        pose = "desk";
      } else if (w > h && w >= 880 && w <= 1020 && (h >= 480 || prev === "book")) {
        // Opened flat and wide: about 951×543. A Pro Max sideways is as wide
        // but shorter than 480, so it stays a phone. The keyboard only
        // shrinks the height, so keep the split once it is on.
        pose = "book";
      } else if (h > w && w >= 630 && w <= 720 && h >= 740) {
        pose = "open";
      } else {
        const sw = window.screen?.width || 0;
        const sh = window.screen?.height || 0;
        const long = Math.max(sw, sh);
        const short = Math.min(sw, sh);
        const outer = short >= 440 && short <= 520 && long >= 640 && long <= 740;
        if (outer && w > h) pose = "strip";
        else if (outer && h > w && w <= 430) pose = "cover";
      }
      document.documentElement.dataset.duo = pose;
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      vv?.removeEventListener("resize", apply);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.access = access;
  }, [access]);

  useEffect(() => {
    // Fixed name so TripPlanner reuses this tab (target="money-tracker") instead of opening another.
    window.name = "money-tracker";
    // Onboarding redirect drops the hash; keep a #proposal= / #link= for after it.
    stashTripHash(window.location.hash);
    void (async () => {
      await hydrate();
      setOnboarded(readOnboarded());
    })();
    applyPwaIcon(readSavedPwaIcon());
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register(assetUrl("sw.js")).catch(() => undefined);
    }
  }, [hydrate, setOnboarded]);

  const onboardedNow = onboarded || (ready && readOnboarded());

  if (!ready) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">HK Life Money</div>;
  }
  if (!onboardedNow && path !== "/onboarding") {
    return <Navigate to="/onboarding" search={{ replay: false }} replace />;
  }
  if (path === "/onboarding") {
    if (onboardedNow && !replay) return <Navigate to="/" replace />;
    return (
      <>
        {children}
        <Toaster theme={isDarkTheme(theme) ? "dark" : "light"} position="top-center" richColors={false} />
      </>
    );
  }
  const onToday = path === "/";
  return (
    <div
      className={cn(
        "app-shell relative mx-auto min-h-dvh max-w-lg bg-background lg:max-w-none lg:pb-0",
        onToday && "app-today",
        onToday
          ? access === "elderly"
            ? "pb-[calc(4.5rem+2.25rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(4rem+2.25rem+env(safe-area-inset-bottom))]"
          : access === "elderly"
            ? "pb-[calc(4.5rem+1rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(4rem+1rem+env(safe-area-inset-bottom))]",
      )}
    >
      <div className="app-main overflow-x-hidden lg:ml-56">{children}</div>
      <AddFab />
      <Nav />
      <AddFlow />
      <SearchFlow />
      <TxDetail />
      <TripProposal />
      <TripLinkCatcher />
      <TripEstimateSheet />
      <InfoDialog />
      <LocalEditMark />
      <DailyDriveSync />
      <Toaster theme={isDarkTheme(theme) ? "dark" : "light"} position="top-center" richColors={false} />
    </div>
  );
}

function DailyDriveSync() {
  const ready = useApp((s) => s.ready);
  const t = useT();
  const toldPass = useRef(false);
  useEffect(() => {
    if (!ready) return;
    const tick = () => void useApp.getState().realizePlanned();
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    let cancel = false;
    let timer = 0;
    let attempt = 0;
    const clearTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = 0;
    };
    const schedule = () => {
      if (attempt >= 6) return;
      const wait = [3000, 8000, 20000, 40000, 60000, 60000][attempt] ?? 60000;
      attempt += 1;
      clearTimer();
      timer = window.setTimeout(run, wait);
    };
    const run = () => {
      clearTimer();
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        schedule();
        return;
      }
      const s = useApp.getState();
      void runDailyOpen({
        holdingCount: s.holdings.length,
        refreshFx: () => s.refreshFx(),
        refreshQuotes: () => s.refreshHoldingPrices(),
        drive: () => runDailyDriveSync({ exportSnapshot: s.exportSnapshot, replaceAll: s.replaceAll }),
        resync: () => {
          markLocalEdit();
          return syncWithDrive({ exportSnapshot: useApp.getState().exportSnapshot, replaceAll: useApp.getState().replaceAll });
        },
      }).then((r) => {
        if (cancel) return;
        if (r.drive === "pulled") toast(t.backup.synced);
        if (r.drive === "need-pass" && !toldPass.current) {
          toldPass.current = true;
          toast(t.backup.driveNeedPass);
        }
        if (r.fxPending || r.quotesPending || r.drive === "offline" || r.drive === "fail") schedule();
      });
    };
    const wake = () => {
      attempt = 0;
      run();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") wake();
    };
    wake();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", wake);
    return () => {
      cancel = true;
      clearTimer();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", wake);
    };
  }, [ready, t]);
  return null;
}

function LocalEditMark() {
  useEffect(() => {
    let skip = true;
    const unsub = useApp.subscribe(() => {
      if (skip || isApplyingRemote()) return;
      markLocalEdit();
    });
    const timer = window.setTimeout(() => {
      skip = false;
    }, 800);
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}

function AddFab() {
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const access = useUi((s) => s.accessMode);
  const openAdd = useUi((s) => s.openAdd);
  const addOpen = useUi((s) => s.addOpen);
  const searchOpen = useUi((s) => s.searchOpen);
  const txDetailId = useUi((s) => s.txDetailId);
  if (path !== "/" || addOpen || searchOpen || txDetailId) return null;
  const bar = access === "elderly" ? "4.5rem" : "4rem";
  return (
    <button
      type="button"
      aria-label={t.add.title}
      onClick={() => openAdd("expense")}
      style={{ bottom: `calc(${bar} + 0.7rem + env(safe-area-inset-bottom))` }}
      className="app-fab fixed right-[max(1rem,env(safe-area-inset-right))] z-30 grid size-14 place-items-center rounded-full bg-accent text-on-accent shadow-lg lg:hidden"
    >
      <Plus className="size-7" strokeWidth={1.8} />
    </button>
  );
}

function Nav() {
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const access = useUi((s) => s.accessMode);
  const theme = useUi((s) => s.theme);
  const navIcons = useUi((s) => s.navIcons);
  const defaults = defaultNavIcons(theme);
  const iconFor = (slot: NavSlot) => navIcons[slot] ?? defaults[slot];
  const all = [
    { to: "/", slot: "today" as const, label: t.nav.today, match: (p: string) => p === "/" },
    { to: "/assets", slot: "assets" as const, label: t.nav.assets, match: (p: string) => p.startsWith("/assets") },
    { to: "/budget", slot: "budget" as const, label: t.nav.budget, match: (p: string) => p.startsWith("/budget") },
    { to: "/reports", slot: "reports" as const, label: t.nav.reports, match: (p: string) => p.startsWith("/reports") },
    { to: "/more", slot: "more" as const, label: t.nav.more, match: (p: string) => p.startsWith("/more") },
  ];
  const items = access === "kid" ? all.filter((it) => it.to !== "/reports") : all;
  const cols = items.length === 4 ? "grid-cols-4" : items.length === 3 ? "grid-cols-3" : "grid-cols-5";
  return (
    <>
      <nav className="app-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-elevated pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:hidden">
        <div className={cn("mx-auto grid max-w-lg", cols)}>
          {items.map((it) => (
            <Link key={it.to} to={it.to} className={cn("app-tab-link flex h-16 flex-col items-center justify-center gap-0.5 text-xs", access === "elderly" && "app-tab-elderly h-[4.5rem] text-sm", it.match(path) ? "text-accent" : "text-muted")}>
              <CategoryIcon name={iconFor(it.slot)} className={access === "elderly" ? "size-6" : "size-5"} />
              {it.label}
            </Link>
          ))}
        </div>
      </nav>
      <aside className="app-side fixed bottom-0 left-0 top-0 z-40 hidden w-56 flex-col gap-1 overflow-y-auto border-r border-line bg-elevated p-4 pt-[max(1rem,env(safe-area-inset-top))] lg:flex">
        <div className="mb-6 px-3 text-lg font-semibold">{t.app}</div>
        {items.map((it) => (
          <Link key={it.to} to={it.to} className={cn("flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm", it.match(path) ? "bg-accent-soft text-accent" : "text-muted")}>
            <CategoryIcon name={iconFor(it.slot)} className="size-4" />
            {it.label}
          </Link>
        ))}
      </aside>
    </>
  );
}

function InfoDialog() {
  const t = useT();
  const key = useUi((s) => s.infoKey);
  const setInfoKey = useUi((s) => s.setInfoKey);
  const copy = t.info as Record<string, string>;
  const body = key ? copy[key] : null;
  return (
    <Overlay open={!!key} onClose={() => setInfoKey(null)} title={t.common.info}>
      <div className="rt-sheet-in">
        <p className="px-5 pb-8 text-sm leading-relaxed text-muted">{body ?? ""}</p>
      </div>
    </Overlay>
  );
}
