import { useEffect, type ReactNode } from "react";
import { Link, Navigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, MoreHorizontal, PieChart, Wallet, WalletCards } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi, readOnboarded } from "@/store/ui";
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

  useEffect(() => {
    void hydrate();
    setOnboarded(readOnboarded());
  }, [hydrate, setOnboarded]);

  if (!onboarded && path !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  if (path === "/onboarding") {
    return (
      <>
        {children}
        <Toaster theme="light" position="top-center" richColors={false} />
      </>
    );
  }
  if (!ready) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">HK Life Money</div>;
  }
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-background pb-[4.25rem] lg:max-w-none lg:pb-0">
      <div className="lg:ml-56">{children}</div>
      <Nav />
      <AddFlow />
      <SearchFlow />
      <TxDetail />
      <InfoDialog />
      <Toaster theme="light" position="top-center" richColors={false} />
    </div>
  );
}

function Nav() {
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/", label: t.nav.today, icon: Wallet, match: (p: string) => p === "/" },
    { to: "/assets", label: t.nav.assets, icon: WalletCards, match: (p: string) => p.startsWith("/assets") },
    { to: "/budget", label: t.nav.budget, icon: PieChart, match: (p: string) => p.startsWith("/budget") },
    { to: "/reports", label: t.nav.reports, icon: BarChart3, match: (p: string) => p.startsWith("/reports") },
    { to: "/more", label: t.nav.more, icon: MoreHorizontal, match: (p: string) => p.startsWith("/more") },
  ] as const;
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-elevated pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {items.map((it) => (
            <Link key={it.to} to={it.to} className={cn("flex h-16 flex-col items-center justify-center gap-0.5 text-xs", it.match(path) ? "text-accent" : "text-muted")}>
              <it.icon className="size-5" />
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
      en: "Remaining budget = spending cap − spending so far − monthly regulars not yet posted this month − this-month-only holds not yet due. Daily spendable divides that by remaining calendar days this month, including today. This-month-only items are budget holds, not transactions.",
      zh: "剩餘預算 = 開支上限 − 本月已花費 − 尚未入帳的每月定期 − 尚未扣帳的本月臨時。每日可花費把該金額除以本月剩餘日數（含今天）。本月臨時只佔預算，不會建立交易。",
    },
    disc: {
      en: "Still to spend = monthly regulars not yet posted this month + uncharged this-month-only holds + paced leftover non-regular spend. Non-regular so far = spending so far − posted regulars matched this month.",
      zh: "預計本月尚餘開支 = 尚未入帳的每月定期 + 尚未扣帳的本月臨時 + 按其速度推算的其餘非定期。已實現非定期 = 本月已花費 − 本月已配對的定期。",
    },
    cap: {
      en: "The headline is projected spending for this month versus your monthly cap. Projected spend = posted spend + remaining scheduled regulars not yet posted + remaining this-month-only holds + paced leftover non-regular spend. Remaining = cap − posted − remaining scheduled − remaining holds.",
      zh: "標題數字是本月預計開支對比開支上限。預計開支 = 本月已花費 + 尚未入帳的每月定期 + 尚未扣帳的本月臨時 + 按其速度推算的其餘非定期。剩餘 = 上限 − 已花費 − 尚未入帳定期 − 尚未扣帳臨時。",
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
