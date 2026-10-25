import { useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { useT, useUi } from "@/store/ui";
import { useApp } from "@/store/app";
import { cn } from "@/lib/utils";

const TOUR_COUNT = 2;

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
  const onStarter = !replay && step === TOUR_COUNT;

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
          {Array.from({ length: TOUR_COUNT }, (_, i) => (
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
        <Starter ready={ready} onSample={() => void finish("sample")} onEmpty={() => void finish("empty")} />
      ) : step === 0 ? (
        <div className="flex flex-1 flex-col pt-6">
          <div className="flex gap-2">
            <LangChip active={locale === "zh-HK"} onClick={() => setLocale("zh-HK")}>
              繁中
            </LangChip>
            <LangChip active={locale === "en"} onClick={() => setLocale("en")}>
              EN
            </LangChip>
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">{t.onboarding.welcome}</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">{t.onboarding.tagline}</p>
          <TodayPreview locale={locale} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col pt-6">
          <h1 className="text-3xl font-semibold tracking-tight">{t.onboarding.todayTitle}</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">{t.onboarding.today2}</p>
          <AddPreview />
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
            {t.onboarding.next}
          </button>
        )}
      </div>
    </div>
  );
}

function TodayPreview({ locale }: { locale: "en" | "zh-HK" }) {
  const t = useT();
  const days = locale === "zh-HK" ? ["一", "二", "三", "四", "五", "六", "日"] : ["M", "T", "W", "T", "F", "S", "S"];
  const lunch = locale === "zh-HK" ? "午餐" : "Lunch";
  const food = locale === "zh-HK" ? "飲食" : "Dining";
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line">
      <div className="flex items-center gap-3 bg-elevated px-3 py-3">
        <span className="grid size-11 place-items-center rounded-full bg-background text-accent">
          <Wallet className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{t.today.expenseMonth}</span>
          <span className="text-xs text-muted">{t.budget.expectedMonth}</span>
        </span>
        <span className="text-lg font-semibold tabular-nums">HK$12,400</span>
      </div>
      <div className="grid grid-cols-7 px-1 py-2 text-center">
        {days.map((d, i) => (
          <div key={`${d}-${i}`} className="flex flex-col items-center">
            <span className="text-[10px] text-muted">{d}</span>
            <span className={cn("mt-0.5 grid size-8 place-items-center rounded-full text-xs", i === 2 && "bg-accent font-semibold text-on-accent")}>{20 + i}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line px-3 py-3">
        <div>
          <div className="text-sm font-medium">{lunch}</div>
          <div className="text-xs text-muted">{food}</div>
        </div>
        <div className="text-sm font-semibold text-expense">−HK$68</div>
      </div>
    </div>
  );
}

function AddPreview() {
  const t = useT();
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-background">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm text-muted">{t.add.category}</span>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent">{t.add.recentCategories}</span>
      </div>
      <div className="px-4 pb-1 text-right text-3xl font-semibold tabular-nums">72,000</div>
      <div className="px-4 pb-3 text-right text-xs font-semibold text-accent">HKD</div>
      <div className="mx-3 mb-3 grid grid-cols-4 gap-1.5">
        {["1", "2", "3", "+"].map((k) => (
          <span key={k} className={cn("grid h-10 place-items-center rounded-lg text-sm font-medium", k === "+" ? "bg-watch text-on-accent" : "bg-elevated")}>
            {k}
          </span>
        ))}
      </div>
      <div className="mx-3 mb-3 grid h-12 place-items-center rounded-xl bg-accent text-base font-semibold text-on-accent">{t.add.save}</div>
    </div>
  );
}

function Starter({ ready, onSample, onEmpty }: { ready: boolean; onSample: () => void; onEmpty: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col pt-8">
      <h1 className="text-3xl font-semibold tracking-tight">{t.onboarding.startTitle}</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">{t.onboarding.startHint}</p>
      <button type="button" disabled={!ready} className="mt-8 rounded-2xl bg-elevated px-4 py-4 text-left disabled:opacity-50" onClick={onEmpty}>
        <div className="text-[15px] font-semibold">{t.onboarding.start}</div>
        <div className="mt-1 text-sm text-muted">{t.onboarding.startEmptyHint}</div>
      </button>
      <button type="button" disabled={!ready} className="mt-3 rounded-2xl bg-elevated px-4 py-4 text-left disabled:opacity-50" onClick={onSample}>
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
