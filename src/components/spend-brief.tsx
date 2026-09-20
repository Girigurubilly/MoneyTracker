import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { downloadBlob } from "@/lib/backup";
import { todayISO } from "@/lib/format";
import { buildSpendBrief, renderSpendBriefMarkdown } from "@/lib/calc/spend-brief";
import type { PeriodPreset } from "@/lib/calc/period";
import { useApp } from "@/store/app";
import { useT } from "@/store/ui";

export function SpendBriefButton({
  from,
  to,
  preset,
  hideAdhoc,
  mergeParents,
  className,
}: {
  from: string;
  to: string;
  preset: PeriodPreset;
  hideAdhoc: boolean;
  mergeParents: boolean;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {t.reports.exportPeriodAi}
      </button>
      {open ? (
        <SpendBriefSheet
          from={from}
          to={to}
          preset={preset}
          hideAdhoc={hideAdhoc}
          mergeParents={mergeParents}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function SpendBriefSheet({
  from,
  to,
  preset,
  hideAdhoc,
  mergeParents,
  onClose,
}: {
  from: string;
  to: string;
  preset: PeriodPreset;
  hideAdhoc: boolean;
  mergeParents: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const txs = useApp((s) => s.transactions);
  const categories = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const markdown = useMemo(
    () =>
      renderSpendBriefMarkdown(
        buildSpendBrief({
          today: todayISO(),
          from,
          to,
          preset,
          hideAdhoc,
          mergeParents,
          txs,
          categories,
          rates,
        }),
      ),
    [from, to, preset, hideAdhoc, mergeParents, txs, categories, rates],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      const el = document.createElement("textarea");
      el.value = markdown;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    toast(t.assets.copied);
  }

  return (
    <Overlay open onClose={onClose} title={t.reports.exportPeriodAi} variant="page">
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.reports.exportPeriodAiHint}</p>
      <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
        <button type="button" className="h-11 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => void copy()}>
          {t.assets.copyBrief}
        </button>
        <button
          type="button"
          className="h-11 rounded-xl bg-elevated text-sm font-medium"
          onClick={() => downloadBlob(`hk-life-spend-${from}-to-${to}.md`, markdown, "text/markdown")}
        >
          {t.assets.downloadBrief}
        </button>
      </div>
      <pre className="mx-4 mb-8 max-h-[70dvh] overflow-auto whitespace-pre-wrap rounded-2xl bg-elevated p-4 text-[11px] leading-4 text-muted">
        {markdown}
      </pre>
    </Overlay>
  );
}
