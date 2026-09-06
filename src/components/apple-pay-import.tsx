import { useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryPicker } from "@/components/category-picker";
import { AccountSelect } from "@/components/account-select";
import { moneyAccountsForPicker } from "@/lib/accounts";
import { categoryPath } from "@/lib/categories";
import { parseApplePayText, type ApplePayDraft } from "@/lib/apple-pay";
import { todayISO } from "@/lib/format";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

function enhanceGrayText(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const y = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
    const v = y > 214 ? 255 : y < 60 ? 0 : Math.min(255, (y - 60) * 1.55);
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function cropBand(src: HTMLCanvasElement, topRatio: number, bottomRatio: number, zoom = 1.6): HTMLCanvasElement {
  const y = Math.round(src.height * topRatio);
  const h = Math.max(8, Math.round(src.height * (bottomRatio - topRatio)));
  const out = document.createElement("canvas");
  out.width = Math.round(src.width * zoom);
  out.height = Math.round(h * zoom);
  const ctx = out.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, 0, y, src.width, h, 0, 0, out.width, out.height);
  }
  return enhanceGrayText(out);
}

function fileToImage(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(3.2, 2400 / Math.max(img.width, 1));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

export function ApplePayImport({ onClose }: { onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const addTx = useApp((s) => s.addTransaction);
  const picker = moneyAccountsForPicker(accounts);
  const fallbackAccount = picker.find((a) => a.type === "credit")?.id ?? picker[0]?.id ?? "";
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<ApplePayDraft[]>([]);
  const [pickCatId, setPickCatId] = useState<string | null>(null);
  const picking = rows.find((r) => r.id === pickCatId) ?? null;

  function patch(id: string, next: Partial<ApplePayDraft>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }

  async function readFiles(files: File[]) {
    setBusy(true);
    setNote(t.add.appleReading);
    try {
      const mod = await import("tesseract.js");
      const Tesseract = (mod.default ?? mod) as typeof import("tesseract.js");
      const worker = await Tesseract.createWorker("chi_tra+eng", 1, {
        workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js",
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-simd-lstm.wasm.js",
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
      });
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
      });
      const found: ApplePayDraft[] = [];
      for (const file of files) {
        const canvas = await fileToImage(file);
        const full = await worker.recognize(enhanceGrayText(canvas));
        await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK });
        const mid = await worker.recognize(cropBand(canvas, 0.15, 0.34, 1.8));
        await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE });
        const line = await worker.recognize(cropBand(canvas, 0.18, 0.27, 2));
        const text = [full.data.text, mid.data.text, line.data.text].filter(Boolean).join("\n");
        const draft = parseApplePayText(text, accounts, categories);
        if (draft) {
          if (!draft.accountId) draft.accountId = fallbackAccount;
          if (!draft.date) draft.date = todayISO();
          draft.id = `${draft.id}|${found.length}|${file.name}`;
          found.push(draft);
        }
      }
      await worker.terminate();
      setRows((prev) => [...prev, ...found]);
      setNote(found.length ? t.add.octopusFound.replace("{n}", String(found.length)) : t.add.appleNone);
    } catch (err) {
      setNote(`${t.add.appleFailed} ${err instanceof Error ? err.message : ""}`.trim());
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const ready = rows.filter((r) => !r.skip);
    if (!ready.length || ready.some((r) => !r.amount || !r.accountId)) {
      toast(t.add.appleNeedFields);
      return;
    }
    for (const r of ready) {
      await addTx({
        id: newId(),
        type: "expense",
        amount: r.amount,
        currency: "HKD",
        accountId: r.accountId!,
        categoryId: r.categoryId || undefined,
        date: r.date || todayISO(),
        payee: r.payee || "Apple Pay",
        payeeZh: r.payee || "Apple Pay",
        note: r.cardHint ? `Apple Pay · ${r.cardHint}` : "Apple Pay",
      });
    }
    toast(t.add.octopusImported.replace("{n}", String(ready.length)));
    onClose();
  }

  if (picking) {
    return (
      <CategoryPicker
        categories={categories}
        kind="expense"
        selectedId={picking.categoryId || undefined}
        txType="expense"
        onClose={() => setPickCatId(null)}
        onSelect={(c) => {
          patch(picking.id, { categoryId: c?.id ?? "" });
          setPickCatId(null);
        }}
      />
    );
  }

  return (
    <Overlay open onClose={onClose} variant="page">
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="h-11 px-2 text-sm text-accent" onClick={onClose}>
          {t.add.cancel}
        </button>
        <h1 className="text-base font-semibold">{t.add.applePay}</h1>
        <button type="button" className="h-11 px-2 text-sm font-medium text-accent" disabled={busy || !rows.length} onClick={() => void save()}>
          {t.add.save}
        </button>
      </header>
      <p className="px-5 pb-3 pt-2 text-xs leading-5 text-muted">{t.add.appleHint}</p>
      <div className="px-4 pb-3">
        <label className="inline-flex h-11 items-center rounded-xl bg-accent px-4 text-sm font-medium text-on-accent">
          {busy ? t.add.appleReading : t.add.applePick}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              if (files.length) void readFiles(files);
            }}
          />
        </label>
        {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
      </div>
      <div className="px-4 pb-10">
        {rows.map((r) => {
          const cat = categories.find((c) => c.id === r.categoryId);
          return (
            <div key={r.id} className={`mb-3 rounded-2xl bg-elevated px-3 py-3 ${r.skip ? "opacity-50" : ""}`}>
              <div className="mb-2 flex items-center gap-2">
                <input type="checkbox" checked={!r.skip} onChange={() => patch(r.id, { skip: !r.skip })} />
                <input
                  value={String(r.amount || "")}
                  onChange={(e) => patch(r.id, { amount: Number(e.target.value) || 0 })}
                  inputMode="decimal"
                  className="min-w-0 flex-1 bg-transparent text-right text-xl font-semibold outline-none"
                />
              </div>
              <input
                value={r.payee}
                onChange={(e) => patch(r.id, { payee: e.target.value })}
                placeholder={t.add.note}
                className="mb-2 h-10 w-full rounded-lg bg-background px-3 text-sm outline-none"
              />
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-xs text-muted">{t.add.date}</span>
                <input type="date" value={r.date} onChange={(e) => patch(r.id, { date: e.target.value })} className="h-9 bg-transparent text-sm text-accent outline-none" />
              </div>
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-xs text-muted">{t.add.account}</span>
                <AccountSelect accounts={picker} value={r.accountId ?? ""} onChange={(id) => patch(r.id, { accountId: id })} className="max-w-[12rem] text-right text-sm" />
              </div>
              <button type="button" className="mt-1 flex w-full items-center gap-2 py-2 text-left" onClick={() => setPickCatId(r.id)}>
                {cat ? (
                  <span className="grid size-8 place-items-center rounded-full bg-background">
                    <CategoryIcon name={cat.icon} />
                  </span>
                ) : null}
                <span className={`text-sm ${cat ? "" : "text-muted"}`}>{cat ? categoryPath(cat, categories, locale) : t.add.pickCategory}</span>
              </button>
            </div>
          );
        })}
      </div>
    </Overlay>
  );
}
