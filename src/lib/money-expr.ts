/** Safe + - * / ( ) amount expressions. Returns null if incomplete or invalid. */
export function parseMoneyExpr(raw: string): number | null {
  const s = raw
    .trim()
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");
  if (!s) return null;
  let i = 0;
  const peek = () => s[i] ?? "";
  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = peek();
      i += 1;
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = peek();
      i += 1;
      const r = parseFactor();
      if (op === "/") {
        if (r === 0) throw new Error("div0");
        v /= r;
      } else v *= r;
    }
    return v;
  }
  function parseFactor(): number {
    if (peek() === "+") {
      i += 1;
      return parseFactor();
    }
    if (peek() === "-") {
      i += 1;
      return -parseFactor();
    }
    if (peek() === "(") {
      i += 1;
      const v = parseExpr();
      if (peek() !== ")") throw new Error("paren");
      i += 1;
      return v;
    }
    return parseNumber();
  }
  function parseNumber(): number {
    const start = i;
    while (/\d/.test(peek())) i += 1;
    if (peek() === ".") {
      i += 1;
      while (/\d/.test(peek())) i += 1;
    }
    if (start === i) throw new Error("num");
    return Number(s.slice(start, i));
  }
  try {
    const v = parseExpr();
    if (i !== s.length) return null;
    if (!Number.isFinite(v)) return null;
    return v;
  } catch {
    return null;
  }
}

export function resolveAmountInput(raw: string): number {
  const parsed = parseMoneyExpr(raw);
  if (parsed == null) return Math.abs(Number(raw) || 0);
  return Math.abs(parsed);
}

export function commitAmountExpr(raw: string): string {
  const parsed = parseMoneyExpr(raw);
  if (parsed == null) return raw;
  const n = Math.abs(parsed);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10000) / 10000);
}

export function applyPadKey(expr: string, key: string): string {
  const mapped = key === "×" ? "*" : key === "÷" ? "/" : key === "−" ? "-" : key;
  if (mapped === "back") return expr.slice(0, -1);
  if (mapped === "=") return commitAmountExpr(expr);
  if (mapped === "±") {
    if (!expr) return "-";
    if (expr.startsWith("-")) return expr.slice(1);
    return `-${expr}`;
  }
  if (mapped === "+" || mapped === "-" || mapped === "*" || mapped === "/") {
    if (!expr) return mapped === "-" ? "-" : `0${mapped}`;
    if (/[+\-*/]$/.test(expr)) return expr.slice(0, -1) + mapped;
    return expr + mapped;
  }
  if (mapped === ".") {
    const last = expr.split(/[+\-*/]/).pop() ?? "";
    if (last.includes(".")) return expr;
    return `${expr}${last === "" ? "0." : "."}`;
  }
  if (/^\d$/.test(mapped)) return expr === "0" ? mapped : expr + mapped;
  return expr;
}
