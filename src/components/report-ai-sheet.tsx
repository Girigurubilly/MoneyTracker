import { useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { downloadBlob } from "@/lib/backup";
import { copyPlainText, sharePlainText } from "@/lib/copy-text";
import { useT } from "@/store/ui";

export function ReportAiButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button type="button" className="mx-4 mb-4 flex h-11 w-[calc(100%-2rem)] items-center justify-center rounded-xl bg-elevated text-sm font-medium" onClick={onClick}>
      {t.reports.exportBrief}
    </button>
  );
}

export function ReportAiSheet({ title, hint, filename, markdown, onClose }: { title: string; hint: string; filename: string; markdown: string; onClose: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  async function copy() {
    setBusy(true);
    try {
      if (await copyPlainText(markdown)) {
        toast(t.assets.copied);
        return;
      }
      const shared = await sharePlainText(markdown, title);
      if (shared === "shared" || shared === "aborted") return;
      toast(t.assets.copyFailed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Overlay open onClose={onClose} title={title} variant="page">
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{hint}</p>
      <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} className="h-11 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => void copy()}>
          {t.assets.copyBrief}
        </button>
        <button type="button" className="h-11 rounded-xl bg-elevated text-sm font-medium" onClick={() => downloadBlob(filename, markdown, "text/markdown")}>
          {t.assets.downloadBrief}
        </button>
      </div>
      <pre className="mx-4 mb-8 max-h-[70dvh] select-text overflow-auto whitespace-pre-wrap rounded-2xl bg-elevated p-4 text-[11px] leading-4 text-muted">{markdown}</pre>
    </Overlay>
  );
}
