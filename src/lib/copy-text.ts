function copyBySelection(text: string): boolean {
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.top = "0";
  el.style.left = "0";
  el.style.width = "1px";
  el.style.height = "1px";
  el.style.padding = "0";
  el.style.border = "none";
  el.style.outline = "none";
  el.style.opacity = "0";
  el.style.fontSize = "16px";
  document.body.appendChild(el);
  const sel = window.getSelection();
  const prev = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
  el.focus();
  el.select();
  el.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  el.remove();
  if (sel) {
    sel.removeAllRanges();
    if (prev) sel.addRange(prev);
  }
  return ok;
}

export function copyPlainText(text: string): Promise<boolean> {
  const clip =
    navigator.clipboard?.write && typeof ClipboardItem !== "undefined"
      ? navigator.clipboard
          .write([new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }) })])
          .then(() => true)
          .catch(async () => {
            try {
              await navigator.clipboard.writeText(text);
              return true;
            } catch {
              return false;
            }
          })
      : navigator.clipboard?.writeText
        ? navigator.clipboard.writeText(text).then(
            () => true,
            () => false,
          )
        : Promise.resolve(false);
  const selected = copyBySelection(text);
  return clip.then((ok) => ok || selected);
}

export async function sharePlainText(text: string, title: string): Promise<"shared" | "aborted" | "unavailable"> {
  if (!navigator.share) return "unavailable";
  try {
    await navigator.share({ title, text });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "aborted";
    return "unavailable";
  }
}
