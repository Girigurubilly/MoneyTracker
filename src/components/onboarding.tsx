import { useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { BarChart3, Landmark, PieChart, Sparkles, Wallet, WalletCards } from "lucide-react";
import { useT, useUi } from "@/store/ui";
import { useApp } from "@/store/app";
import { cn } from "@/lib/utils";

const TOUR_COUNT = 6;

export function OnboardingScreen() {
  const t = useT();
  const nav = useNavigate();
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const setOnboarded = useUi((s) => s.setOnboarded);
  const resetSample = useApp((s) => s.resetSample);
  const clearAll = useApp((s) => s.clearAll);
  const ready = useApp((s) => s.ready);
  const search = useSearch({ strict: false }) as { replay?: boolean | string };
  const replay = search.replay === true || search.replay === "1" || search.replay === "true";
  const [step, setStep] = useState(0);
  const pages = tourPages(t);
  const onStarter = !replay && step === TOUR_COUNT;
  const page = pages[Math.min(step, TOUR_COUNT - 1)];

  async function finish(mode: "sample" | "empty" | "done") {
    if (mode === "sample") await resetSample();
    if (mode === "empty") await clearAll();
    if (!replay) setOnboarded(true);
    void nav({ to: replay ? "/more/other" : "/" });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background px-6 pb-8 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {pages.map((_, i) => (
            <span
              key={i}
              className={cn("h-1.5 rounded-full transition-all", i === step || (onStarter && i === TOUR_COUNT - 1) ? "w-5 bg-accent" : "w-1.5 bg-line")}
            />
          ))}
          {replay ? null : <span className={cn("h-1.5 rounded-full", onStarter ? "w-5 bg-accent" : "w-1.5 bg-line")} />}
        </div>
        {onStarter ? null : (
          <button type="button" className="h-9 px-2 text-sm text-muted" onClick={() => (replay ? void finish("done") : setStep(TOUR_COUNT))}>
            {replay ? t.onboarding.done : t.onboarding.skip}
          </button>
        )}
      </div>

      {onStarter ? (
        <Starter
          ready={ready}
          onSample={() => void finish("sample")}
          onEmpty={() => void finish("empty")}
        />
      ) : (
        <div className="flex flex-1 flex-col pt-8">
          <div className={cn("grid size-14 place-items-center rounded-2xl", page.tone)}>{page.icon}</div>
          {step === 0 ? (
            <div className="mt-6 flex gap-2">
              <LangChip active={locale === "zh-HK"} onClick={() => setLocale("zh-HK")}>
                繁中
              </LangChip>
              <LangChip active={locale === "en"} onClick={() => setLocale("en")}>
                EN
              </LangChip>
            </div>
          ) : null}
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-muted">{t.app}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{page.title}</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">{page.body}</p>
          <ul className="mt-6 space-y-2">
            {page.points.map((p) => (
              <li key={p} className="flex gap-2 text-sm leading-5 text-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {step > 0 ? (
          <button type="button" className="h-12 flex-1 rounded-xl bg-elevated text-sm font-semibold" onClick={() => setStep((s) => s - 1)}>
            {t.onboarding.back}
          </button>
        ) : null}
        {onStarter ? null : (
          <button
            type="button"
            className="h-12 flex-1 rounded-xl bg-accent text-sm font-semibold text-on-accent"
            onClick={() => {
              if (step + 1 >= TOUR_COUNT) {
                if (replay) void finish("done");
                else setStep(TOUR_COUNT);
                return;
              }
              setStep((s) => s + 1);
            }}
          >
            {step + 1 >= TOUR_COUNT ? (replay ? t.onboarding.done : t.onboarding.next) : t.onboarding.next}
          </button>
        )}
      </div>
    </div>
  );
}

function Starter({ ready, onSample, onEmpty }: { ready: boolean; onSample: () => void; onEmpty: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col pt-8">
      <h1 className="text-3xl font-semibold tracking-tight">{t.onboarding.startTitle}</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">{t.onboarding.startHint}</p>
      <button
        type="button"
        disabled={!ready}
        className="mt-8 rounded-2xl bg-elevated px-4 py-4 text-left disabled:opacity-50"
        onClick={onEmpty}
      >
        <div className="text-[15px] font-semibold">{t.onboarding.start}</div>
        <div className="mt-1 text-sm text-muted">{t.onboarding.startEmptyHint}</div>
      </button>
      <button
        type="button"
        disabled={!ready}
        className="mt-3 rounded-2xl bg-elevated px-4 py-4 text-left disabled:opacity-50"
        onClick={onSample}
      >
        <div className="text-[15px] font-semibold">{t.onboarding.sample}</div>
        <div className="mt-1 text-sm text-muted">{t.onboarding.sampleHint}</div>
      </button>
    </div>
  );
}

function LangChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("h-8 rounded-full px-3 text-xs font-medium", active ? "bg-accent text-on-accent" : "bg-elevated text-muted")}
    >
      {children}
    </button>
  );
}

function tourPages(t: ReturnType<typeof useT>) {
  return [
    {
      icon: <Sparkles className="size-7 text-accent" />,
      tone: "bg-accent-soft",
      title: t.onboarding.welcome,
      body: t.onboarding.tagline,
      points: [t.onboarding.pPrivate, t.onboarding.pHkd, t.onboarding.pOffline],
    },
    {
      icon: <WalletCards className="size-7 text-expense" />,
      tone: "bg-expense-soft",
      title: t.onboarding.todayTitle,
      body: t.onboarding.todayBody,
      points: [t.onboarding.today1, t.onboarding.today2, t.onboarding.today3],
    },
    {
      icon: <Landmark className="size-7 text-income" />,
      tone: "bg-success-soft",
      title: t.onboarding.assetsTitle,
      body: t.onboarding.assetsBody,
      points: [t.onboarding.assets1, t.onboarding.assets2, t.onboarding.assets3],
    },
    {
      icon: <Wallet className="size-7 text-watch" />,
      tone: "bg-watch-soft",
      title: t.onboarding.budgetTitle,
      body: t.onboarding.budgetBody,
      points: [t.onboarding.budget1, t.onboarding.budget2, t.onboarding.budget3],
    },
    {
      icon: <PieChart className="size-7 text-accent" />,
      tone: "bg-accent-soft",
      title: t.onboarding.reportsTitle,
      body: t.onboarding.reportsBody,
      points: [t.onboarding.reports1, t.onboarding.reports2, t.onboarding.reports3],
    },
    {
      icon: <BarChart3 className="size-7 text-accent" />,
      tone: "bg-elevated",
      title: t.onboarding.moreTitle,
      body: t.onboarding.moreBody,
      points: [t.onboarding.more1, t.onboarding.more2, t.onboarding.more3],
    },
  ];
}
