import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryPicker } from "@/components/category-picker";
import { AccountLine, LineRow, TextLine } from "@/components/txn-composer";
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
    const v = y > 208 ? 255 : y < 70 ? 0 : (y - 70) * (255 / 138);
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function cropBand(src: HTMLCanvasElement, topRatio: number, bottomRatio: number): HTMLCanvasElement {
  const y = Math.round(src.height * topRatio);
  const h = Math.max(8, Math.round(src.height * (bottomRatio - topRatio)));
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = h;
  const ctx = out.getContext("2d");
  if (ctx) ctx.drawImage(src, 0, y, src.width, h, 0, 0, src.width, h);
  return enhanceGrayText(out);
}

function fileToImage(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(3, 2200 / Math.max(img.width, 1));
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
  const [editId, setEditId] = useState<string | null>(null);
  const [pickCat, setPickCat] = useState(false);
  const editing = rows.find((r) => r.id === editId) ?? null;
  const cat = useMemo(() => categories.find((c) => c.id === editing?.categoryId), [categories, editing?.categoryId]);

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
      const found: ApplePayDraft[] = [];
      for (const file of files) {
        const canvas = await fileToImage(file);
        const band = cropBand(canvas, 0.14, 0.36);
        const full = await worker.recognize(enhanceGrayText(canvas));
        const bandOcr = await worker.recognize(band);
        const text = `${full.data.text ?? ""}\n${bandOcr.data.text ?? ""}`;
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
      if (found.length === 1) setEditId(found[0].id);
    } catch (err) {
      setNote(`${t.add.appleFailed} ${err instanceof Error ? err.message : ""}`.trim());
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const ready = rows.filter((r) => !r.skip);
    if (!ready.length) {
      toast(t.add.appleNeedFields);
      return;
    }
    if (ready.some((r) => !r.amount || !r.accountId)) {
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

  if (pickCat && editing) {
    return (
      <CategoryPicker
        categories={categories}
        kind="expense"
        selectedId={editing.categoryId || undefined}
        txType="expense"
        onClose={() => setPickCat(false)}
        onSelect={(c) => {
          patch(editing.id, { categoryId: c?.id ?? "" });
          setPickCat(false);
        }}
      />
    );
  }

  return (
    <Overlay open onClose={onClose} variant="page">
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="h-11 px-2 text-sm text-accent" onClick={editing ? () => setEditId(null) : onClose}>
          {editing ? t.add.cancel : t.add.cancel}
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
      {editing ? (
        <div className="pb-8">
          <label className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
            <span className="text-sm text-muted">{t.add.amount}</span>
            <input
              value={String(editing.amount || "")}
              onChange={(e) => patch(editing.id, { amount: Number(e.target.value) || 0 })}
              inputMode="decimal"
              className="w-36 bg-transparent text-right text-2xl font-semibold outline-none"
            />
          </label>
          <TextLine value={editing.payee} onChange={(v) => patch(editing.id, { payee: v })} placeholder={t.add.note} />
          <label className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <span className="text-sm text-muted">{t.add.date}</span>
            <input type="date" value={editing.date} onChange={(e) => patch(editing.id, { date: e.target.value })} className="h-10 bg-transparent text-sm text-accent outline-none" />
          </label>
          <AccountLine accounts={accounts} value={editing.accountId ?? ""} onChange={(id) => patch(editing.id, { accountId: id })} placeholder={t.add.account} />
          {editing.cardHint ? <p className="px-4 pt-1 text-[11px] text-muted">{t.add.appleCard}: {editing.cardHint}</p> : null}
          <LineRow
            leading={
              cat ? (
                <span className="grid size-8 place-items-center rounded-full bg-elevated">
                  <CategoryIcon name={cat.icon} />
                </span>
              ) : null
            }
            label={cat ? categoryPath(cat, categories, locale) : ""}
            placeholder={t.add.pickCategory}
            onPressLabel={() => setPickCat(true)}
          />
        </div>
      ) : (
        <div className="px-4 pb-10">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setEditId(r.id)}
              className="mb-2 flex w-full items-start gap-2 rounded-xl bg-elevated px-3 py-2 text-left"
            >
              <input
                type="checkbox"
                checked={!r.skip}
                onClick={(e) => e.stopPropagation()}
                onChange={() => patch(r.id, { skip: !r.skip })}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.payee || t.add.note}</div>
                <div className="text-xs text-muted">{r.date}{r.cardHint ? ` · ${r.cardHint}` : ""}</div>
              </div>
              <span className="text-sm font-semibold tabular-nums">{r.amount ? r.amount.toFixed(2) : "—"}</span>
            </button>
          ))}
        </div>
      )}
    </Overlay>
  );
}
