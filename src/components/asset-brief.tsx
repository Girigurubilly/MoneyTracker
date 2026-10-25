import { copyPlainText, sharePlainText } from "@/lib/copy-text";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { downloadBlob } from "@/lib/backup";
import { todayISO } from "@/lib/format";
import { buildAssetBrief, renderAssetBriefMarkdown } from "@/lib/calc/asset-brief";
import { useApp } from "@/store/app";
import { useT } from "@/store/ui";

export function AssetBriefButton({ className }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {t.assets.exportAi}
      </button>
      {open ? <AssetBriefSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AssetBriefSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const txs = useApp((s) => s.transactions);
  const categories = useApp((s) => s.categories);
  const holdings = useApp((s) => s.holdings);
  const deposits = useApp((s) => s.deposits);
  const retirementAccounts = useApp((s) => s.retirementAccounts);
  const mortgage = useApp((s) => s.mortgage);
  const recurring = useApp((s) => s.recurring);
  const markdown = useMemo(
    () =>
      renderAssetBriefMarkdown(
        buildAssetBrief({
          today: todayISO(),
          accounts,
          rates,
          txs,
          categories,
          holdings,
          deposits,
          retirementAccounts,
          mortgage,
          recurring,
        }),
      ),
    [accounts, rates, txs, categories, holdings, deposits, retirementAccounts, mortgage, recurring],
  );

  async function copy() {
    if (await copyPlainText(markdown)) {
      toast(t.assets.copied);
      return;
    }
    const shared = await sharePlainText(markdown, t.assets.exportAi);
    if (shared === "shared" || shared === "aborted") return;
    toast(t.assets.copyFailed);
  }

  return (
    <Overlay open onClose={onClose} title={t.assets.exportAi} variant="page">
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.assets.exportAiHint}</p>
      <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
        <button type="button" className="h-11 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => void copy()}>
          {t.assets.copyBrief}
        </button>
        <button
          type="button"
          className="h-11 rounded-xl bg-elevated text-sm font-medium"
          onClick={() => downloadBlob(`hk-life-assets-${todayISO()}.md`, markdown, "text/markdown")}
        >
          {t.assets.downloadBrief}
        </button>
      </div>
      <pre className="mx-4 mb-8 max-h-[70dvh] select-text overflow-auto whitespace-pre-wrap rounded-2xl bg-elevated p-4 text-[11px] leading-4 text-muted">
        {markdown}
      </pre>
    </Overlay>
  );
}
