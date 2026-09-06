import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { AccountSelect } from "@/components/account-select";
import { moneyAccountsForPicker } from "@/lib/accounts";
import { pickName } from "@/lib/i18n";
import {
  parseOctopusText,
  readOctopusSettings,
  suggestOctopusAccountId,
  writeOctopusSettings,
  type OctopusDraft,
} from "@/lib/octopus";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

function fileToImage(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(2.2, 1600 / Math.max(img.width, 1));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const y = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
        const v = y > 170 ? 255 : y < 90 ? 0 : y;
        px[i] = px[i + 1] = px[i + 2] = v;
      }
      ctx.putImageData(data, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

export function OctopusImport({ onClose }: { onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const addTx = useApp((s) => s.addTransaction);
  const picker = moneyAccountsForPicker(accounts);
  const saved = readOctopusSettings();
  const [accountId, setAccountId] = useState(saved.accountId ?? suggestOctopusAccountId(accounts) ?? picker[0]?.id ?? "");
  const [fromAccountId, setFromAccountId] = useState(saved.fromAccountId ?? picker.find((a) => a.id !== accountId)?.id ?? "");
  const [rows, setRows] = useState<OctopusDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [rawText, setRawText] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const expenseCats = useMemo(() => categories.filter((c) => c.kind === "expense"), [categories]);

  function applyText(text: string) {
    const parsed = parseOctopusText(text, categories);
    setRows((prev) => {
      const next = [...prev];
      for (const r of parsed) {
        if (!next.some((x) => x.id === r.id)) next.push(r);
      }
      return next;
    });
    setNote(parsed.length ? t.add.octopusFound.replace("{n}", String(parsed.length)) : t.add.octopusNone);
    return parsed.length;
  }

  async function readFile(file: File) {
    setBusy(true);
    setNote(t.add.octopusReading);
    try {
      const canvas = await fileToImage(file);
      const mod = await import("tesseract.js");
      const Tesseract = (mod.default ?? mod) as typeof import("tesseract.js");
      const result = await Tesseract.recognize(canvas, "chi_tra+eng", {
        workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js",
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-simd-lstm.wasm.js",
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
      });
      const text = result.data.text ?? "";
      setRawText((prev) => (prev ? `${prev}\n${text}` : text));
      applyText(text);
    } catch (err) {
      setNote(`${t.add.octopusFailed} ${err instanceof Error ? err.message : ""}`.trim());
      setShowRaw(true);
    } finally {
      setBusy(false);
    }
  }

  async function importRows() {
    if (!accountId) return;
    writeOctopusSettings({ accountId, fromAccountId });
    const ready = rows.filter((r) => !r.skip);
    if (!ready.length) {
      toast(t.add.octopusNone);
      return;
    }
    for (const r of ready) {
      if (r.kind === "topup") {
        if (!fromAccountId) {
          toast(t.add.octopusNeedFrom);
          return;
        }
        await addTx({
          id: newId(),
          type: "transfer",
          amount: r.amount,
          currency: "HKD",
          accountId: fromAccountId,
          toAccountId: accountId,
          destAmount: r.amount,
          date: r.date || new Date().toISOString().slice(0, 10),
          payee: r.merchant,
          payeeZh: r.merchant,
          note: r.time ? `Octopus ${r.time}` : "Octopus top-up",
        });
      } else {
        await addTx({
          id: newId(),
          type: "expense",
          amount: r.amount,
          currency: "HKD",
          accountId,
          categoryId: r.categoryId,
          date: r.date || new Date().toISOString().slice(0, 10),
          payee: r.merchant,
          payeeZh: r.merchant,
          note: r.time ? `Octopus ${r.time}` : "Octopus",
        });
      }
    }
    toast(t.add.octopusImported.replace("{n}", String(ready.length)));
    onClose();
  }

  return (
    <Overlay open onClose={onClose} variant="page">
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="h-11 px-2 text-sm text-accent" onClick={onClose}>
          {t.add.cancel}
        </button>
        <h1 className="text-base font-semibold">{t.add.octopus}</h1>
        <button type="button" className="h-11 px-2 text-sm font-medium text-accent" disabled={busy} onClick={() => void importRows()}>
          {t.add.save}
        </button>
      </header>
      <p className="px-5 pb-3 pt-2 text-xs leading-5 text-muted">{t.add.octopusHint}</p>
      <div className="mx-4 mb-3 space-y-2 rounded-2xl bg-elevated px-4 py-3">
        <label className="flex items-center justify-between gap-3 py-1">
          <span className="text-sm">{t.add.octopusAccount}</span>
          <AccountSelect accounts={picker} value={accountId} onChange={setAccountId} className="max-w-[11rem] text-right text-sm" />
        </label>
        <label className="flex items-center justify-between gap-3 py-1">
          <span className="text-sm">{t.add.octopusFrom}</span>
          <AccountSelect accounts={picker.filter((a) => a.id !== accountId)} value={fromAccountId} onChange={setFromAccountId} className="max-w-[11rem] text-right text-sm" />
        </label>
      </div>
      <div className="px-4 pb-3">
        <label className="inline-flex h-11 items-center rounded-xl bg-accent px-4 text-sm font-medium text-on-accent">
          {busy ? t.add.octopusReading : t.add.octopusPick}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              void files.reduce(async (p, f) => {
                await p;
                await readFile(f);
              }, Promise.resolve());
            }}
          />
        </label>
        {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
        <button type="button" className="mt-2 text-xs text-accent" onClick={() => setShowRaw((v) => !v)}>
          {t.add.octopusPaste}
        </button>
        {showRaw ? (
          <div className="mt-2">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={6}
              className="w-full rounded-xl bg-elevated px-3 py-2 text-xs"
              placeholder={t.add.octopusPasteHint}
            />
            <button
              type="button"
              className="mt-2 h-9 rounded-lg bg-elevated px-3 text-xs font-medium"
              onClick={() => applyText(rawText)}
            >
              {t.add.octopusParse}
            </button>
          </div>
        ) : null}
      </div>
      <div className="px-4 pb-10">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t.add.octopusEmpty}</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="mb-2 rounded-xl bg-elevated px-3 py-2">
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={!r.skip} onChange={() => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, skip: !x.skip } : x)))} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.merchant}</div>
                  <div className="text-xs text-muted">{[r.date, r.time].filter(Boolean).join(" ")} · {r.kind === "topup" ? t.add.octopusTopup : t.add.expense}</div>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${r.kind === "topup" ? "text-income" : ""}`}>
                  {r.kind === "topup" ? "+" : "−"}{r.amount.toFixed(1)}
                </span>
              </div>
              {r.kind === "expense" ? (
                <select
                  value={r.categoryId ?? ""}
                  onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, categoryId: e.target.value } : x)))}
                  className="mt-1 w-full bg-transparent text-xs text-muted outline-none"
                >
                  <option value="">{t.add.pickCategory}</option>
                  {expenseCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {pickName(locale, c.name, c.nameZh)}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Overlay>
  );
}
