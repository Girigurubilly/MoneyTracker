export const PWA_ICON_KEY = "hk-life-money-icon";

export function readSavedPwaIcon(): string | null {
  try {
    return localStorage.getItem(PWA_ICON_KEY);
  } catch {
    return null;
  }
}

export function applyPwaIcon(dataUrl: string | null) {
  if (typeof document === "undefined") return;
  const href = dataUrl || "";
  for (const rel of ["apple-touch-icon", "icon"]) {
    const links = document.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!href) continue;
    if (links.length) {
      links.forEach((el) => {
        el.href = href;
      });
    } else {
      const el = document.createElement("link");
      el.rel = rel;
      el.href = href;
      document.head.appendChild(el);
    }
  }
}

export function persistPwaIcon(dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(PWA_ICON_KEY, dataUrl);
    else localStorage.removeItem(PWA_ICON_KEY);
  } catch {
    /* ignore */
  }
  applyPwaIcon(dataUrl);
}

export function resizeImageFile(file: File, size = 180): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.fillStyle = "#f2f2f7";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

export function resizeWallpaperFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 1080;
      const maxH = 1920;
      let w = img.width;
      let h = img.height;
      const scale = Math.min(1, maxW / w, maxH / h);
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}
