import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Calendar, List, Scale, Wallet } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { useT, useUi, readSavedLocale } from "@/store/ui";
import { useApp } from "@/store/app";
import { Overlay } from "@/components/shared";
import { AddFlow } from "@/components/add-sheet";
import { SearchFlow } from "@/components/search-sheet";
import { TxDetail } from "@/components/tx-detail";
import { AddAccountOverlay } from "@/components/assets";

const tabs = [
  { to: "/", id: "today", icon: Calendar },
  { to: "/assets", id: "assets", icon: Scale },
  { to: "/budget", id: "budget", icon: Wallet },
  { to: "/reports", id: "reports", icon: BarChart3 },
  { to: "/more", id: "more", icon: List },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function TodayGlyph({ day, className }: { day: number; className?: string }) {
  return (
    <span className={cn("relative grid place-items-center", className)}>
      <svg
        viewBox="0 0 24 24"
        className="size-full"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
        <path d="M8 3v3M16 3v3M3.5 10h17" />
      </svg>
      <span className="absolute top-[11px] text-[9px] font-semibold leading-none tabular-nums">{day}</span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const day = new Date().getDate();
  const ready = useApp((s) => s.ready);
  const hydrate = useApp((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    if (typeof navigator !== "undefined") void navigator.storage?.persist?.();
  }, [hydrate]);

  useEffect(() => {
    const saved = readSavedLocale();
    if (saved !== locale) setLocale(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.lang = locale === "zh-HK" ? "zh-HK" : "en";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#0284c7");
  }, [locale]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line px-3 py-6 lg:flex">
          <div className="px-3 pb-6 text-sm font-semibold tracking-tight">{t.app}</div>
          <nav className="flex flex-1 flex-col gap-1">
            {tabs.map((tab) => {
              const active = isActive(pathname, tab.to);
              const Icon = tab.icon;
              const label = t.nav[tab.id];
              return (
                <Link
                  key={tab.id}
                  to={tab.to}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                    active ? "bg-accent-soft text-accent" : "text-muted",
                  )}
                >
                  {tab.id === "today" ? (
                    <TodayGlyph day={day} className="size-5" />
                  ) : (
                    <Icon className="size-5" strokeWidth={1.7} />
                  )}
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0">
            {ready ? children : <Loading />}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-nav/95 shadow-[0_-8px_24px_rgba(26,35,50,0.06)] backdrop-blur-md lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.to);
            const Icon = tab.icon;
            const label = t.nav[tab.id];
            return (
              <Link
                key={tab.id}
                to={tab.to}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px]",
                  active ? "text-accent" : "text-muted",
                )}
              >
                {tab.id === "today" ? (
                  <TodayGlyph day={day} className="size-6" />
                ) : (
                  <Icon className="size-6" strokeWidth={active ? 1.9 : 1.6} />
                )}
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <AddFlow />
      <SearchFlow />
      <TxDetail />
      <AddAccountOverlay />
      <InfoDialog />
      <Toaster theme="light" position="top-center" richColors={false} />
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center text-sm text-muted">HK Life Money</div>
  );
}

function InfoDialog() {
  const t = useT();
  const key = useUi((s) => s.infoKey);
  const setInfoKey = useUi((s) => s.setInfoKey);
  const copy: Record<string, { en: string; zh: string }> = {
    daily: {
      en: "Remaining spendable = spending cap − spending so far − monthly regulars not yet charged. Daily spendable divides that by remaining calendar days this month, including today. Guidance only — not a cash-balance guarantee.",
      zh: "剩餘可動用 = 開支上限 − 本月已花費 − 尚未扣帳的每月定期。每日可花費把該金額除以本月剩餘日數（含今天）。僅供參考，並非現金結餘保證。",
    },
    mortgage: {
      en: "Constant-rate amortisation using the current effective rate. Remaining payments include this month when the charged day has not yet arrived. End date is the last payment day. Not a lender quote.",
      zh: "以現行實際利率作固定利率攤還。若本月扣帳日尚未到，攤還表仍會列出本期供款。完結日為最後一期扣帳日。並非銀行報價。",
    },
    retirement: {
      en: "Pre-retirement saving uses the last 12 months’ average (income − expense). Target monthly is the retirement spend that saving rate can support in today’s HKD. Property is excluded from spendable capital by default.",
      zh: "退休前儲蓄取近 12 個月收入減開支的月均。目標每月是按此儲蓄推算至退休後可持續的每月開支（今日港元）。物業預設不計入可動用退休資金。",
    },
    trip: {
      en: "A trip is a date range. Spent is the sum of expenses linked to that trip. Budget used is spent ÷ cash budget. Link an expense from its detail screen or when adding it.",
      zh: "旅程是一段日期。已花費是連結到該旅程的支出總和。預算已用 = 已花費 ÷ 現金預算。可在新增支出或支出詳情把紀錄連結到進行中的旅程。",
    },
    cap: {
      en: "Remaining = cap − spending so far − monthly regulars whose charged day has not yet arrived. Forecast used also adds projected remaining non-regular spend: (spending − realized regulars) ÷ day of month × remaining days after today. The ring is green if forecast used is within the cap, amber if over by up to 10%, red if over by more.",
      zh: "剩餘 = 上限 − 本月已花費 − 扣帳日尚未到的每月定期。預測已用會再加上預計其餘非定期：（已花費 − 已實現定期）÷ 本月已過日數 × 餘下日數（不含今天）。預測未超出上限為綠，超出 10% 以內為黃，再高為紅。",
    },
  };
  const locale = useUi((s) => s.locale);
  const body = key ? copy[key] : null;
  return (
    <Overlay open={!!key} onClose={() => setInfoKey(null)} title={t.common.info}>
      <p className="px-5 pb-6 text-sm leading-relaxed text-muted">
        {body ? (locale === "zh-HK" ? body.zh : body.en) : t.common.coming}
      </p>
    </Overlay>
  );
}
