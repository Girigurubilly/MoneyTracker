import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { AccountSelect } from "@/components/account-select";
import { moneyAccountsForPicker } from "@/lib/accounts";
import { pickName } from "@/lib/i18n";
import { parseApplePayText } from "@/lib/apple-pay";
import { todayISO } from "@/lib/format";
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
  const expenseCats = useMemo(() => categories.filter((c) => c.kind === "expense"), [categories]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState(picker.find((a) => a.type === "credit")?.id ?? picker[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [cardHint, setCardHint] = useState("");
  const [ready, setReady] = useState(false);

  async function readFile(file: File) {
    setBusy(true);
    setNote(t.add.appleReading);
    try {
      const canvas = await fileToImage(file);
      const mod = await import("tesseract.js");
      const Tesseract = (mod.default ?? mod) as typeof import("tesseract.js");
      const result = await Tesseract.recognize(canvas, "chi_tra+eng", {
        workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js",
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-simd-lstm.wasm.js",
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
      });
      const draft = parseApplePayText(result.data.text ?? "", accounts, categories);
      if (!draft) {
        setNote(t.add.appleNone);
        setReady(true);
        return;
      }
      setAmount(draft.amount ? String(draft.amount) : "");
      setPayee(draft.payee);
      if (draft.date) setDate(draft.date);
      if (draft.accountId) setAccountId(draft.accountId);
      if (draft.categoryId) setCategoryId(draft.categoryId);
      setCardHint(draft.cardHint);
      setReady(true);
      setNote(t.add.appleReview);
    } catch (err) {
      setNote(`${t.add.appleFailed} ${err instanceof Error ? err.message : ""}`.trim());
      setReady(true);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const amt = Number(amount);
    if (!amt || amt <= 0 || !accountId) {
      toast(t.add.appleNeedFields);
      return;
    }
    await addTx({
      id: newId(),
      type: "expense",
      amount: amt,
      currency: "HKD",
      accountId,
      categoryId: categoryId || undefined,
      date,
      payee: payee || "Apple Pay",
      payeeZh: payee || "Apple Pay",
      note: cardHint ? `Apple Pay · ${cardHint}` : "Apple Pay",
    });
    toast(t.add.savedToast);
    onClose();
  }

  return (
    <Overlay open onClose={onClose} variant="page">
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="h-11 px-2 text-sm text-accent" onClick={onClose}>
          {t.add.cancel}
        </button>
        <h1 className="text-base font-semibold">{t.add.applePay}</h1>
        <button type="button" className="h-11 px-2 text-sm font-medium text-accent" disabled={busy || !ready} onClick={() => void save()}>
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
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void readFile(file);
            }}
          />
        </label>
        {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
      </div>
      {ready ? (
        <div className="mx-4 space-y-2 rounded-2xl bg-elevated px-4 py-3">
          <label className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm text-muted">{t.add.amount}</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-36 bg-transparent text-right text-lg font-semibold outline-none" />
          </label>
          <label className="block py-2">
            <span className="text-sm text-muted">{t.add.note}</span>
            <input value={payee} onChange={(e) => setPayee(e.target.value)} className="mt-1 h-10 w-full bg-transparent text-sm outline-none" />
          </label>
          <label className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm text-muted">{t.add.date}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 bg-transparent text-sm text-accent outline-none" />
          </label>
          <label className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm">{t.add.account}</span>
            <AccountSelect accounts={picker} value={accountId} onChange={setAccountId} className="max-w-[12rem] text-right text-sm" />
          </label>
          {cardHint ? <p className="text-[11px] text-muted">{t.add.appleCard}: {cardHint}</p> : null}
          <label className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm">{t.add.category}</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="max-w-[12rem] bg-transparent text-right text-sm outline-none">
              <option value="">{t.add.pickCategory}</option>
              {expenseCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {pickName(locale, c.name, c.nameZh)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </Overlay>
  );
}
