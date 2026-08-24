import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Building2, Plane, Umbrella } from "lucide-react";
import { useT, useUi } from "@/store/ui";
import { useApp } from "@/store/app";

export function OnboardingScreen() {
  const t = useT();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const resetSample = useApp((s) => s.resetSample);
  const clearAll = useApp((s) => s.clearAll);
  const setAddAccount = useUi((s) => s.setAddAccountOpen);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background px-6 pb-10 pt-[max(3rem,env(safe-area-inset-top))]">
      {step === 0 ? (
        <>
          <div className="flex-1 pt-10">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{t.app}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">{t.onboarding.welcome}</h1>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-muted">{t.onboarding.tagline}</p>
            <div className="mt-10 rounded-xl bg-elevated p-4">
              <div className="text-xs text-muted">{t.onboarding.currency}</div>
              <div className="mt-1 text-lg font-medium">HKD · HK$</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="h-12 rounded-xl bg-accent text-sm font-semibold text-on-accent"
          >
            {t.onboarding.next}
          </button>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <div className="flex-1 pt-6">
            <h1 className="text-3xl font-semibold tracking-tight">{t.onboarding.start}</h1>
            <div className="mt-6 space-y-3">
              <Choice
                title={t.onboarding.sample}
                onClick={async () => {
                  await resetSample();
                  setStep(2);
                }}
              />
              <Choice
                title={t.onboarding.account}
                onClick={async () => {
                  await clearAll();
                  setAddAccount(true);
                  setStep(2);
                }}
              />
              <Choice
                title={t.onboarding.import}
                onClick={async () => {
                  await clearAll();
                  void nav({ to: "/more/$page", params: { page: "import" } });
                }}
              />
            </div>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div className="flex-1 pt-6">
            <h1 className="text-3xl font-semibold tracking-tight">{t.onboarding.later}</h1>
            <p className="mt-2 text-sm text-muted">{t.prototypeShort}</p>
            <div className="mt-6 space-y-3">
              <Choice
                icon={<Building2 className="size-5" />}
                title={t.onboarding.home}
                onClick={() => nav({ to: "/reports/living" })}
              />
              <Choice
                icon={<Plane className="size-5" />}
                title={t.onboarding.travel}
                onClick={() => nav({ to: "/reports/travel" })}
              />
              <Choice
                icon={<Umbrella className="size-5" />}
                title={t.onboarding.retire}
                onClick={() => nav({ to: "/reports/retirement" })}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => nav({ to: "/" })}
            className="h-12 rounded-xl bg-accent text-sm font-semibold text-on-accent"
          >
            {t.onboarding.enter}
          </button>
          <button type="button" onClick={() => nav({ to: "/" })} className="mt-2 h-11 text-sm text-muted">
            {t.onboarding.skip}
          </button>
        </>
      ) : null}
    </div>
  );
}

function Choice({
  title,
  onClick,
  icon,
}: {
  title: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-elevated px-4 text-left text-[15px] font-medium"
    >
      {icon}
      {title}
    </button>
  );
}
