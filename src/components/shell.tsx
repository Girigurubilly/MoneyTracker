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
        "app-shell relative mx-auto min-h-dvh max-w-lg overflow-x-hidden bg-background lg:max-w-none lg:pb-0",
        onToday
          ? access === "elderly"
            ? "pb-[calc(4.5rem+2.25rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(4rem+2.25rem+env(safe-area-inset-bottom))]"
          : access === "elderly"
            ? "pb-[calc(4.5rem+1rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(4rem+1rem+env(safe-area-inset-bottom))]",
      )}
    >
      <div className="lg:ml-56">{children}</div>
      <AddFab />
      <Nav />
      <AddFlow />
      <SearchFlow />
      <TxDetail />
      <TripProposal />
      <TripLinkCatcher />
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
      className="fixed right-4 z-30 grid size-14 place-items-center rounded-full bg-accent text-on-accent shadow-lg lg:hidden"
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
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-elevated pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className={cn("mx-auto grid max-w-lg", cols)}>
          {items.map((it) => (
            <Link key={it.to} to={it.to} className={cn("flex h-16 flex-col items-center justify-center gap-0.5 text-xs", access === "elderly" && "h-[4.5rem] text-sm", it.match(path) ? "text-accent" : "text-muted")}>
              <CategoryIcon name={iconFor(it.slot)} className={access === "elderly" ? "size-6" : "size-5"} />
              {it.label}
            </Link>
          ))}
        </div>
      </nav>
      <aside className="fixed bottom-0 left-0 top-0 hidden w-56 border-r border-line bg-elevated p-4 lg:block">
        <div className="mb-6 text-lg font-semibold">{t.app}</div>
        {items.map((it) => (
          <Link key={it.to} to={it.to} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm", it.match(path) ? "bg-accent-soft text-accent" : "text-muted")}>
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
  const locale = useUi((s) => s.locale);
  const copy: Record<string, { en: string; zh: string }> = {
    daily: {
      en: "Remaining budget = cap − spending so far − monthly regulars and this-month-only holds whose charged day is still after today. Daily allowed remaining divides that by calendar days after today (last day uses the remaining amount).",
      zh: "剩餘預算 = 開支上限 − 本月已花費 − 扣帳日尚未到的每月定期與本月臨時。每日尚可花費把該金額除以今天之後的剩餘日數（月末當日則用剩餘金額）。",
    },
    disc: {
      en: "Projected avg daily spend = (spending so far − posted regulars/ad-hoc whose charged day has already passed) ÷ day of month. No transaction matching.",
      zh: "預計每日平均開支 =（已花費 − 已入帳的定期／臨時）÷ 本月第幾天。以扣帳日判斷，不對賬交易。",
    },
    cap: {
      en: "Reserved = monthly regulars and this-month holds whose charged day is still after today. Posted regulars/ad-hoc = those whose charged day is today or earlier. Headline = spending so far + reserved + projected avg daily × days left. Projected non-regular (full month) = (spending so far − posted regulars/ad-hoc) + avg daily × days left.",
      zh: "已預留 = 扣帳日尚未到的每月定期與本月臨時。已入帳的定期／臨時 = 扣帳日已到的項目。標題 = 已花費 + 已預留 + 預計每日平均 × 剩餘日數。預計非定期（全月）=（已花費 − 已入帳的定期／臨時）+ 預計每日平均 × 剩餘日數。",
    },
    mortgage: {
      en: "Constant-rate amortisation using the current effective rate. Not a lender quote.",
      zh: "以現行實際利率作固定利率攤還。並非銀行報價。",
    },
    retirement: {
      en: "Income and spend-now use a figure you typed when set, otherwise the last-12-month ledger average. After retirement there is no salary. The sticky bar is the official path verdict.",
      zh: "收入同而家開支：有人手填就用你填嘅數，否則用近 12 個月帳本平均。退休後冇薪金。頂部黏住條係官方路徑結論。",
    },
    trip: {
      en: "Annual travel = travel-category spends plus anything linked to a trip this year ÷ your annual budget. The linked / unlinked split explains why the ring can be higher than trip cards. Trip meals: use Travel → Meals, or link Dining out to a trip.",
      zh: "全年旅遊 = 本年旅遊分類開支加已掛旅程嘅開支 ÷ 你設嘅全年預算。「已掛／未掛」解釋點解環形圖可以高過旅程卡。旅途用餐請用「旅遊・旅途用餐」，或者將飲食掛到旅程。",
    },
  };
  const body = key ? copy[key] : null;
  return (
    <Overlay open={!!key} onClose={() => setInfoKey(null)} title={t.common.info}>
      <div className="rt-sheet-in">
        <p className="px-5 pb-8 text-sm leading-relaxed text-muted">{body ? (locale === "zh-HK" ? body.zh : body.en) : ""}</p>
      </div>
    </Overlay>
  );
}
