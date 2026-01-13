// lib/fx.ts

export const IMPORTANT_CURRENCIES = ["EUR", "USD", "TRY", "GBP", "CHF", "AED", "SAR", "SYP"] as const;
export type ImportantCurrency = (typeof IMPORTANT_CURRENCIES)[number];

export type FxRatesToUSD = Record<string, number>;

/**
 * ✅ 1 UNIT من العملة = كم USD؟
 * (قيم تقريبية - تستخدم كـ fallback لو ما قدرنا نجيب live rates)
 */
export const DEFAULT_RATES_TO_USD: FxRatesToUSD = {
  USD: 1,
  EUR: 1.09,
  TRY: 0.033,
  GBP: 1.27,
  CHF: 1.13,
  AED: 0.272294,
  SAR: 0.266667,
  SYP: 0.0083,
};

export function normalizeCur(input: any): string {
  const s = String(input ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return "USD";

  // Symbols / aliases
  if (s === "€" || s === "EURO") return "EUR";
  if (s === "$" || s === "US$") return "USD";
  if (s === "₺" || s === "TL") return "TRY";
  if (s === "£") return "GBP";

  // keep only letters
  const cleaned = s.replace(/[^A-Z]/g, "");
  return cleaned || "USD";
}

function rateToUSD(cur: string, rates: FxRatesToUSD): number {
  const c = normalizeCur(cur);
  const r = rates[c];
  return Number.isFinite(r) && r > 0 ? r : NaN;
}

/**
 * ✅ تحويل amount من from إلى to عبر USD (Pivot)
 */
export function convertCurrency(amount: number, from: string, to: string, rates: FxRatesToUSD = DEFAULT_RATES_TO_USD): number {
  const a = Number(amount);
  if (!Number.isFinite(a)) return 0;

  const f = normalizeCur(from);
  const t = normalizeCur(to);
  if (f === t) return a;

  const rf = rateToUSD(f, rates);
  const rt = rateToUSD(t, rates);

  // إذا ناقص ريت: رجّع نفس الرقم (بدل ما يكسر)
  if (!Number.isFinite(rf) || !Number.isFinite(rt)) return a;

  const usd = a * rf;
  const out = usd / rt;
  return out;
}

export function roundMoney(x: number, decimals = 2): number {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  const p = Math.pow(10, decimals);
  return Math.round(n * p) / p;
}

/**
 * ✅ أهم دالة عندك:
 * تجيب قيمة العملية بالعملة الأساسية الحالية.
 *
 * - إذا العملية فيها baseAmount + baseCurrencySnapshot مطابق للـ baseCur الحالي -> استخدمها
 * - غير هيك -> احسبها مباشرة من amount + currency
 */
export function txValueInBase(tx: any, baseCur: string, rates: FxRatesToUSD = DEFAULT_RATES_TO_USD): number {
  const bc = normalizeCur(baseCur);

  const snap = normalizeCur(tx?.baseCurrencySnapshot);
  const baseAmount = tx?.baseAmount;

  if (Number.isFinite(baseAmount) && snap && snap === bc) {
    return Number(baseAmount);
  }

  const amt = Number(tx?.amount || 0);
  const cur = normalizeCur(tx?.currency || bc);
  return convertCurrency(amt, cur, bc, rates);
}

/* =========================================================
   ✅ Auto FX Rates (Live) + Cache
   المصدر: Frankfurter (free) — ممتاز للعملات الرئيسية
   ملاحظة: ما بيدعم كل العملات (مثل SYP غالباً)
   ========================================================= */

const FX_CACHE_KEY = "fx_rates_to_usd_cache_v1";
const CACHE_MS = 12 * 60 * 60 * 1000; // 12 hours

type FxCachePayload = {
  updatedAt: number;
  source: "frankfurter" | "fallback";
  ratesToUSD: FxRatesToUSD;
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readCache(): FxCachePayload | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(FX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const updatedAt = Number(parsed.updatedAt);
    const ratesToUSD = parsed.ratesToUSD as FxRatesToUSD;
    const source = parsed.source as FxCachePayload["source"];

    if (!Number.isFinite(updatedAt) || !ratesToUSD || typeof ratesToUSD !== "object") return null;
    if (Date.now() - updatedAt > CACHE_MS) return null;

    return { updatedAt, ratesToUSD, source: source === "frankfurter" ? "frankfurter" : "fallback" };
  } catch {
    return null;
  }
}

function writeCache(payload: FxCachePayload) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(FX_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/**
 * ✅ ترجع أسعار (toUSD) بحيث:
 * 1 UNIT من العملة = كم USD؟
 *
 * - بتحاول تجيب من Frankfurter
 * - بتدمج مع DEFAULT (fallback) للعملات الناقصة
 * - بتخزن كاش 12 ساعة
 */
export async function getAutoRatesToUSD(): Promise<{
  ratesToUSD: FxRatesToUSD;
  updatedAt: number;
  source: "cache" | "frankfurter" | "fallback";
}> {
  // 1) cache first
  const cached = readCache();
  if (cached) {
    return { ratesToUSD: cached.ratesToUSD, updatedAt: cached.updatedAt, source: "cache" };
  }

  // 2) try frankfurter
  try {
    // Frankfurter: from=USD => rates are: 1 USD = X CUR
    // We need: 1 CUR = how many USD => toUSD[CUR] = 1 / X
    const symbols = IMPORTANT_CURRENCIES.filter((c) => c !== "USD" && c !== "SYP").join(",");
    const url = `https://api.frankfurter.app/latest?from=USD&to=${encodeURIComponent(symbols)}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("FX fetch failed");

    const data: any = await res.json();
    const fx: Record<string, number> = data?.rates ?? {};

    const computed: FxRatesToUSD = { USD: 1 };

    for (const cur of IMPORTANT_CURRENCIES) {
      const c = normalizeCur(cur);

      if (c === "USD") {
        computed.USD = 1;
        continue;
      }

      // Frankfurter غالباً ما يدعم SYP، نخليه fallback
      if (c === "SYP") continue;

      const usdToCur = Number(fx?.[c]);
      if (Number.isFinite(usdToCur) && usdToCur > 0) {
        computed[c] = 1 / usdToCur; // 1 CUR = ? USD
      }
    }

    // merge: computed overrides defaults, defaults fill missing
    const merged: FxRatesToUSD = { ...DEFAULT_RATES_TO_USD, ...computed };

    const payload: FxCachePayload = {
      updatedAt: Date.now(),
      source: "frankfurter",
      ratesToUSD: merged,
    };
    writeCache(payload);

    return { ratesToUSD: merged, updatedAt: payload.updatedAt, source: "frankfurter" };
  } catch {
    // 3) fallback
    const payload: FxCachePayload = {
      updatedAt: Date.now(),
      source: "fallback",
      ratesToUSD: { ...DEFAULT_RATES_TO_USD },
    };
    writeCache(payload);
    return { ratesToUSD: payload.ratesToUSD, updatedAt: payload.updatedAt, source: "fallback" };
  }
}

/**
 * ✅ Helper: خذ rates من state (لو موجودة) وإلا default
 * (مفيد بالصفحات لما بدك تحسب تحويلات بكل مكان بنفس المنطق)
 */
export function ratesFromState(state: any): FxRatesToUSD {
  const r = state?.fxRatesToUSD;
  if (r && typeof r === "object") return r as FxRatesToUSD;
  return DEFAULT_RATES_TO_USD;
}
