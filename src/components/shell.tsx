import { useEffect, type ReactNode } from "react";
import { Link, Navigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, Bone, Building2, Cat, Cpu, Fish, Heart, Home, Landmark, Leaf, Moon, MoreHorizontal, PawPrint, PieChart, Sparkles, TreePine, Wallet, WalletCards } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi, readOnboarded } from "@/store/ui";
import { isDarkTheme } from "@/lib/theme";
import { applyPwaIcon, readSavedPwaIcon } from "@/lib/pwa-icon";
import { Overlay } from "@/components/shared";
import { AddFlow } from "@/components/add-sheet";
import { SearchFlow } from "@/components/search-sheet";
import { TxDetail } from "@/components/tx-detail";

export function AppGate({ children }: { children: ReactNode }) {
  const ready = useApp((s) => s.ready);
  const hydrate = useApp((s) => s.hydrate);
  const onboarded = useUi((s) => s.onboarded);
  const setOnboarded = useUi((s) => s.setOnboarded);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const theme = useUi((s) => s.theme);

  useEffect(() => {
    void hydrate();
    setOnboarded(readOnboarded());
    applyPwaIcon(readSavedPwaIcon());
  }, [hydrate, setOnboarded]);

  if (!onboarded && path !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  if (path === "/onboarding") {
    return (
      <>
        {children}
        <Toaster theme={isDarkTheme(theme) ? "dark" : "light"} position="top-center" richColors={false} />
      </>
    );
  }
  if (!ready) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">HK Life Money</div>;
  }
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-background/80 pb-[4.25rem] lg:max-w-none lg:pb-0">
      <div className="lg:ml-56">{children}</div>
      <Nav />
      <AddFlow />
      <SearchFlow />
      <TxDetail />
      <InfoDialog />
      <Toaster theme={isDarkTheme(theme) ? "dark" : "light"} position="top-center" richColors={false} />
    </div>
  );
}

function Nav() {
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const access = useUi((s) => s.accessMode);
  const theme = useUi((s) => s.theme);
  const pack =
    theme === "shiba"
      ? { today: PawPrint, assets: Bone, budget: Heart, reports: Home, more: MoreHorizontal }
      : theme === "cat"
        ? { today: Cat, assets: Fish, budget: Heart, reports: Home, more: MoreHorizontal }
        : theme === "panda"
          ? { today: Leaf, assets: TreePine, budget: Heart, reports: Home, more: MoreHorizontal }
          : theme === "hongkong"
            ? { today: Landmark, assets: Building2, budget: PieChart, reports: BarChart3, more: MoreHorizontal }
            : theme === "anime"
              ? { today: Sparkles, assets: Heart, budget: PieChart, reports: BarChart3, more: MoreHorizontal }
              : theme === "pinky"
                ? { today: Heart, assets: WalletCards, budget: PieChart, reports: BarChart3, more: MoreHorizontal }
                : theme === "cyberpunk"
                  ? { today: Cpu, assets: WalletCards, budget: PieChart, reports: BarChart3, more: MoreHorizontal }
                  : theme === "dark"
                    ? { today: Moon, assets: WalletCards, budget: PieChart, reports: BarChart3, more: MoreHorizontal }
                    : { today: Wallet, assets: WalletCards, budget: PieChart, reports: BarChart3, more: MoreHorizontal };
  const all = [
    { to: "/", label: t.nav.today, icon: pack.today, match: (p: string) => p === "/" },
    { to: "/assets", label: t.nav.assets, icon: pack.assets, match: (p: string) => p.startsWith("/assets") },
    { to: "/budget", label: t.nav.budget, icon: pack.budget, match: (p: string) => p.startsWith("/budget") },
    { to: "/reports", label: t.nav.reports, icon: pack.reports, match: (p: string) => p.startsWith("/reports") },
    { to: "/more", label: t.nav.more, icon: pack.more, match: (p: string) => p.startsWith("/more") },
  ] as const;
  const items = access === "kid" ? all.filter((it) => it.to !== "/reports" && it.to !== "/assets") : all;
  const cols = items.length === 3 ? "grid-cols-3" : "grid-cols-5";
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-elevated pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className={cn("mx-auto grid max-w-lg", cols)}>
          {items.map((it) => (
            <Link key={it.to} to={it.to} className={cn("flex h-16 flex-col items-center justify-center gap-0.5 text-xs", access === "elderly" && "h-[4.5rem] text-sm", it.match(path) ? "text-accent" : "text-muted")}>
              <it.icon className={access === "elderly" ? "size-6" : "size-5"} />
              {it.label}
            </Link>
          ))}
        </div>
      </nav>
      <aside className="fixed bottom-0 left-0 top-0 hidden w-56 border-r border-line bg-elevated p-4 lg:block">
        <div className="mb-6 text-lg font-semibold">{t.app}</div>
        {items.map((it) => (
          <Link key={it.to} to={it.to} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm", it.match(path) ? "bg-accent-soft text-accent" : "text-muted")}>
            <it.icon className="size-4" />
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
      en: "Current monthly income and spend are averages of the last 12 months. After retirement there is no salary.",
      zh: "現時每月收入與開支取近 12 個月平均。退休後不再有薪金。",
    },
    trip: {
      en: "Annual travel is travel-category and trip-linked spending this year ÷ the annual travel budget you set.",
      zh: "全年旅遊 = 本年旅遊分類及已連結旅程的開支 ÷ 你設定的全年旅遊預算。",
    },
  };
  const body = key ? copy[key] : null;
  return (
    <Overlay open={!!key} onClose={() => setInfoKey(null)} title={t.common.info}>
      <p className="px-5 pb-8 text-sm leading-relaxed text-muted">{body ? (locale === "zh-HK" ? body.zh : body.en) : ""}</p>
    </Overlay>
  );
}
