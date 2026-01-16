"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BottomNav from "@/components/BottomNav";
import type { AppState } from "@/lib/types";
import { loadState, saveState } from "@/lib/storage";
import { IMPORTANT_CURRENCIES, normalizeCur, getAutoRatesToUSD } from "@/lib/fx";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

/** ✅ روابط صاحب التطبيق (عدّلها أنت فقط) */
const OWNER_SOCIAL_LINKS = {
  instagram: "https://www.instagram.com/ibrahim.jab99/",
  youtube: "https://www.youtube.com/@ibrahim.jab99",
  tiktok: "https://www.tiktok.com/@ibrahim.jab99",
  facebook: "https://www.facebook.com/ibrahim.jaber.320943",
} as const;

type IncomeBreakdownItem = {
  id: string;
  label: string;
  category?: string;
  amount: number;
};

type IncomeBreakdownState = {
  monthlyIncome: number; // نظري
  currency: string;
  items: IncomeBreakdownItem[];
};

type ExtendedState = AppState & {
  incomeBuckets?: any[];
  expenseBuckets?: any[];
  monthlyIncomeTarget?: number;

  // ✅ FX (Live rates)
  fxRatesToUSD?: Record<string, number>;
  fxUpdatedAt?: number;
  fxSource?: "cache" | "frankfurter" | "fallback";

  // ✅ (قديم) كان محلي — رح نخليه لتوافق قديم فقط
  profile?: {
    name?: string;
    job?: string;
    bio?: string;
    avatarDataUrl?: string;
  };

  lang?: "ar" | "en" | "de";

  // ✅ NEW: Income Breakdown (نظري فقط)
  incomeBreakdown?: IncomeBreakdownState;
};

type DbProfile = {
  user_id: string;
  full_name: string;
  job_title: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type DbSettings = {
  user_id: string;
  base_currency: string;
  monthly_income_target: number;
};

function defaultState(): ExtendedState {
  return {
    baseCurrency: "USD",
    accounts: [],
    txs: [],
    incomeBuckets: [],
    expenseBuckets: [],
    lang: "ar",
    monthlyIncomeTarget: 3000,

    fxRatesToUSD: undefined,
    fxUpdatedAt: undefined,
    fxSource: undefined,

    profile: {
      name: "User",
      job: "IT Specialist",
      bio: "Local Only",
      avatarDataUrl: "",
    },

    incomeBreakdown: {
      monthlyIncome: 2400,
      currency: "EUR",
      items: [
        { id: "rent", label: "أجار المنزل", category: "مصاريف ثابتة", amount: 900 },
        { id: "electric", label: "كهرباء", category: "فواتير", amount: 70 },
        { id: "transport", label: "مواصلات", category: "فواتير", amount: 60 },
        { id: "debts", label: "دين", category: "دين", amount: 300 },
        { id: "charity", label: "صدقة", category: "صدقة", amount: 50 },
      ],
    },
  };
}

function topLinkStyle() {
  return {
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 900 as const,
    textDecoration: "none",
    color: "#000",
    background: "rgba(255,255,255,0.92)",
    border: "none",
    boxShadow: "0 8px 22px rgba(0,0,0,0.04)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
}

function labelStyle() {
  return { fontSize: 12, color: "rgba(0,0,0,0.65)", fontWeight: 800 as const, marginBottom: 6 };
}

function inputStyle() {
  return {
    width: "100%",
    borderRadius: 16,
    padding: "12px 12px",
    border: "1px solid rgba(0,0,0,0.08)",
    outline: "none",
    fontWeight: 900 as const,
    color: "#000",
    background: "white",
  } as React.CSSProperties;
}

function pillBtn(active: boolean) {
  return {
    flex: 1,
    borderRadius: 16,
    padding: "12px 12px",
    fontWeight: 900 as const,
    border: "none",
    cursor: "pointer",
    background: active ? "var(--primary)" : "rgba(0,0,0,0.06)",
    color: active ? "white" : "#000",
  } as React.CSSProperties;
}

function smallEditBtn() {
  return {
    border: "none",
    cursor: "pointer",
    borderRadius: 12,
    padding: "8px 10px",
    fontWeight: 900 as const,
    background: "rgba(50,194,182,0.16)",
    boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.26)",
    color: "#000",
  } as React.CSSProperties;
}

function smallGhostBtn() {
  return {
    border: "none",
    cursor: "pointer",
    borderRadius: 12,
    padding: "8px 10px",
    fontWeight: 900 as const,
    background: "rgba(0,0,0,0.05)",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
    color: "#000",
  } as React.CSSProperties;
}

function IconChevronDown({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="rgba(0,0,0,0.70)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCamera({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 7h2l1-2h4l1 2h2a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Z"
        stroke="rgba(0,0,0,0.82)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="rgba(0,0,0,0.82)" strokeWidth="2" />
    </svg>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "white",
        border: "none",
        borderRadius: 20,
        boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </section>
  );
}

function SocialIcon({ kind, size = 18 }: { kind: "ig" | "yt" | "tt" | "fb"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as any;

  if (kind === "ig") {
    return (
      <svg {...common}>
        <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z" stroke="rgba(0,0,0,0.86)" strokeWidth="2" />
        <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" stroke="rgba(0,0,0,0.86)" strokeWidth="2" />
        <path d="M17.5 6.5h.01" stroke="rgba(0,0,0,0.86)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "yt") {
    return (
      <svg {...common}>
        <path d="M21 12s0-4-1-5-5-1-8-1-7 0-8 1-1 5-1 5 0 4 1 5 5 1 8 1 7 0 8-1 1-5 1-5Z" stroke="rgba(0,0,0,0.86)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M11 10l4 2-4 2v-4Z" fill="rgba(0,0,0,0.86)" />
      </svg>
    );
  }
  if (kind === "tt") {
    return (
      <svg {...common}>
        <path d="M14 3v10.2a3.8 3.8 0 1 1-3-3.72" stroke="rgba(0,0,0,0.86)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 7c1.2 1.8 2.8 2.8 5 3" stroke="rgba(0,0,0,0.86)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M14 8h3V5h-3c-1.66 0-3 1.34-3 3v3H8v3h3v7h3v-7h3l1-3h-4V8c0-.55.45-1 1-1Z" fill="rgba(0,0,0,0.86)" />
    </svg>
  );
}

function useOutsideClick(refs: React.RefObject<HTMLElement>[], onOutside: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      const inside = refs.some((r) => r.current && r.current.contains(t));
      if (!inside) onOutside();
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true } as any);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown as any);
    };
  }, [refs, onOutside, enabled]);
}

/** ✅ Social Footer فوق BottomNav بدون تداخل */
function SocialFooter({ items }: { items: { label: string; kind: "ig" | "yt" | "tt" | "fb"; url: string }[] }) {
  const [navH, setNavH] = useState(86);

  useEffect(() => {
    const update = () => {
      const el = document.querySelector('[data-bottom-nav="1"]') as HTMLElement | null;
      if (!el) return;
      const h = Math.ceil(el.getBoundingClientRect().height || 0);
      if (h > 0) setNavH(h);
    };

    update();

    const onResize = () => update();
    window.addEventListener("resize", onResize);

    const el = document.querySelector('[data-bottom-nav="1"]') as HTMLElement | null;
    const ro = el ? new ResizeObserver(() => update()) : null;
    if (el && ro) ro.observe(el);

    return () => {
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
    };
  }, []);

  if (!items.length) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: navH + 10,
        zIndex: 80,
        display: "flex",
        justifyContent: "center",
        padding: "0 14px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          borderRadius: 18,
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.14)",
          border: "1px solid rgba(0,0,0,0.06)",
          backdropFilter: "blur(10px)",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          pointerEvents: "auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "right" }}>
          <div style={{ fontWeight: 900, fontSize: 12, color: "#000" }}>تابعنا</div>
          <div style={{ fontWeight: 800, fontSize: 11, color: "rgba(0,0,0,0.55)" }}> شاركنا رأيك بتعليق </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {items.map((s) => (
            <a
              key={s.kind + s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              title={s.label}
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                background: "rgba(0,0,0,0.04)",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
                display: "grid",
                placeItems: "center",
                textDecoration: "none",
              }}
            >
              <SocialIcon kind={s.kind} size={18} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/login";
}
  const router = useRouter();

  const [state, setState] = useState<ExtendedState>(defaultState());
  const [hydrated, setHydrated] = useState(false);

  // ✅ FX UI state
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState("");

  // ✅ Supabase user data
  const [sbLoading, setSbLoading] = useState(true);
  const [sbError, setSbError] = useState("");
  const [sbProfile, setSbProfile] = useState<DbProfile | null>(null);
  const [sbSettings, setSbSettings] = useState<DbSettings | null>(null);

  // ✅ UI: edit modes
  const [editProfile, setEditProfile] = useState(false);
  const [editPrefs, setEditPrefs] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // ✅ form fields (from supabase)
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState("");

  const [monthlyIncomeTargetSB, setMonthlyIncomeTargetSB] = useState(3000);
  const [baseCurrencySB, setBaseCurrencySB] = useState("USD");

  const [curOpen, setCurOpen] = useState(false);
  const curBtnRef = useRef<HTMLButtonElement>(null);
  const curPanelRef = useRef<HTMLDivElement>(null);
  useOutsideClick([curBtnRef as any, curPanelRef as any], () => setCurOpen(false), curOpen);

  useEffect(() => {
    // ✅ keep local app state (accounts/txs/...etc) from localStorage
    const refreshLocal = () => {
      const s = loadState() as ExtendedState | null;
      if (s) {
        const ib = (s as any).incomeBreakdown as IncomeBreakdownState | undefined;

        setState({
          ...s,
          incomeBuckets: s.incomeBuckets ?? [],
          expenseBuckets: s.expenseBuckets ?? [],
          lang: (s as any).lang ?? "ar",
          monthlyIncomeTarget:
            Number.isFinite((s as any).monthlyIncomeTarget) && (s as any).monthlyIncomeTarget >= 0
              ? Number((s as any).monthlyIncomeTarget)
              : 3000,
          profile: {
            ...(defaultState().profile as any),
            ...(s.profile ?? {}),
          },
          fxRatesToUSD: s.fxRatesToUSD,
          fxUpdatedAt: s.fxUpdatedAt,
          fxSource: s.fxSource,
          incomeBreakdown: {
            ...(defaultState().incomeBreakdown as IncomeBreakdownState),
            ...(ib ?? {}),
            monthlyIncome: Number.isFinite(ib?.monthlyIncome as any) ? Number(ib?.monthlyIncome) : (defaultState().incomeBreakdown as any).monthlyIncome,
            currency: normalizeCur((ib?.currency as any) || (defaultState().incomeBreakdown as any).currency || "USD"),
            items: Array.isArray(ib?.items) ? ib!.items : ((defaultState().incomeBreakdown as any).items ?? []),
          },
        });
      }
    };

    refreshLocal();
    setHydrated(true);

    window.addEventListener("focus", refreshLocal);
    const onVis = () => {
      if (document.visibilityState === "visible") refreshLocal();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", refreshLocal);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState(state as any);
  }, [state, hydrated]);

  // ✅ auto refresh FX on mount (with cache)
  useEffect(() => {
    refreshFx();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshFx() {
    setFxLoading(true);
    setFxError("");
    try {
      const res = await getAutoRatesToUSD();
      setState((prev) => ({
        ...prev,
        fxRatesToUSD: res.ratesToUSD,
        fxUpdatedAt: res.updatedAt ?? Date.now(),
        fxSource: res.source,
      }));
    } catch (e: any) {
      setFxError("فشل تحديث أسعار الصرف. تحقق من الإنترنت.");
    } finally {
      setFxLoading(false);
    }
  }

  // ✅ Load Supabase profile/settings
  useEffect(() => {
    let alive = true;

    async function loadSupabaseData() {
      setSbLoading(true);
      setSbError("");

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      const userId = session.user.id;

      const [pRes, sRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      ]);

      if (pRes.error || sRes.error) {
        if (alive) {
          setSbError((pRes.error?.message || sRes.error?.message) ?? "فشل تحميل بيانات المستخدم");
          setSbLoading(false);
        }
        return;
      }

      const prof = pRes.data as DbProfile | null;
      const st = sRes.data as DbSettings | null;

      // إذا ناقص بيانات (بالمنطق المفروض AuthGate بيوجه onboarding)
      if (!prof || !st) {
        router.replace("/onboarding");
        return;
      }

      if (!alive) return;

      setSbProfile(prof);
      setSbSettings(st);

      // Fill form
      setFullName(prof.full_name ?? "");
      setJobTitle(prof.job_title ?? "");
      setBio(prof.bio ?? "");
      setAvatarDataUrl(prof.avatar_url ?? "");

      setMonthlyIncomeTargetSB(Number(st.monthly_income_target ?? 3000));
      setBaseCurrencySB(normalizeCur(st.base_currency ?? "USD"));

      // ✅ اختياري: نزامن هذه القيم للـ localStorage للتوافق مع أجزاء التطبيق القديمة
      setState((prev) => ({
        ...prev,
        baseCurrency: normalizeCur(st.base_currency ?? prev.baseCurrency ?? "USD"),
        monthlyIncomeTarget: Number(st.monthly_income_target ?? prev.monthlyIncomeTarget ?? 3000),
        profile: {
          ...(prev.profile ?? {}),
          name: prof.full_name ?? prev.profile?.name,
          job: prof.job_title ?? prev.profile?.job,
          bio: prof.bio ?? prev.profile?.bio,
          avatarDataUrl: prof.avatar_url ?? prev.profile?.avatarDataUrl,
        },
      }));

      setSbLoading(false);
    }

    loadSupabaseData();
    return () => {
      alive = false;
    };
  }, [router]);

  const baseCur = normalizeCur(baseCurrencySB || state.baseCurrency || "USD");

  const currencyList = useMemo(() => {
    const uniq = Array.from(new Set([baseCur, ...IMPORTANT_CURRENCIES.map(normalizeCur)]));
    return uniq;
  }, [baseCur]);

  const lang = (state as any).lang ?? "ar";
  function setLang(v: "ar" | "en" | "de") {
    setState((prev) => ({ ...(prev as any), lang: v } as any));
  }

  function handleAvatarPick(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("اختر صورة فقط.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setAvatarDataUrl(dataUrl); // مؤقتًا نخزن DataURL داخل profiles.avatar_url
    };
    reader.readAsDataURL(file);
  }

  async function saveProfileToSupabase() {
    if (!sbProfile?.user_id) return;
    if (!fullName.trim()) {
      alert("الاسم مطلوب");
      return;
    }

    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim(),
      job_title: jobTitle.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarDataUrl || null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", sbProfile.user_id);

    setSavingProfile(false);

    if (error) {
      alert(error.message);
      return;
    }

    // reload view state
    setSbProfile((p) =>
      p
        ? { ...p, full_name: fullName.trim(), job_title: jobTitle.trim() || null, bio: bio.trim() || null, avatar_url: avatarDataUrl || null }
        : p
    );
    setEditProfile(false);
  }

  async function savePrefsToSupabase() {
    if (!sbSettings?.user_id) return;

    setSavingPrefs(true);
    const { error } = await supabase.from("user_settings").update({
      base_currency: normalizeCur(baseCurrencySB),
      monthly_income_target: Math.max(0, Math.round(Number(monthlyIncomeTargetSB || 0))),
      updated_at: new Date().toISOString(),
    }).eq("user_id", sbSettings.user_id);

    setSavingPrefs(false);

    if (error) {
      alert(error.message);
      return;
    }

    setSbSettings((s) =>
      s
        ? { ...s, base_currency: normalizeCur(baseCurrencySB), monthly_income_target: Math.max(0, Math.round(Number(monthlyIncomeTargetSB || 0))) }
        : s
    );
    setEditPrefs(false);
    setCurOpen(false);
  }

  function setBaseCurrencySBAndClose(c: string) {
    setBaseCurrencySB(normalizeCur(c));
    setCurOpen(false);
  }

  const socialFooterItems = useMemo(() => {
    const L = OWNER_SOCIAL_LINKS;
    return [
      { label: "Instagram", kind: "ig" as const, url: (L.instagram ?? "").trim() },
      { label: "YouTube", kind: "yt" as const, url: (L.youtube ?? "").trim() },
      { label: "TikTok", kind: "tt" as const, url: (L.tiktok ?? "").trim() },
      { label: "Facebook", kind: "fb" as const, url: (L.facebook ?? "").trim() },
    ].filter((x) => x.url.length > 0);
  }, []);

  const name = fullName || "User";
  const job = jobTitle || "—";
  const about = bio || "—";
  const avatar = avatarDataUrl || "";

  return (
    <main
      dir="rtl"
      style={{
        padding: 16,
        paddingBottom: 240,
        maxWidth: 560,
        margin: "0 auto",
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F2F5F7 0%, #EEF2F5 55%, #EEF2F5 100%)",
      }}
    >
      <div style={{ height: 14 }} />

      <header style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2, color: "#000" }}>الإعدادات</div>
          
        </div>

        <a href="/" style={topLinkStyle()}>
          رجوع
        </a>
      </header>

      {/* Supabase loading/errors */}
      {sbLoading ? (
        <div style={{ marginTop: 12, fontWeight: 900, color: "rgba(0,0,0,0.65)" }}>جاري تحميل بياناتك…</div>
      ) : sbError ? (
        <div style={{ marginTop: 12, fontWeight: 900, color: "rgba(180,0,0,0.85)" }}>{sbError}</div>
      ) : null}

      {/* Hero */}
      <section
        style={{
          marginTop: 14,
          borderRadius: 24,
          padding: 14,
          background:
            "linear-gradient(135deg, rgba(50,194,182,0.18) 0%, rgba(50,194,182,0.10) 45%, rgba(255,255,255,0.60) 100%)",
          boxShadow: "0 14px 34px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                overflow: "hidden",
                background: "rgba(255,255,255,0.9)",
                boxShadow: "0 14px 30px rgba(0,0,0,0.10)",
                display: "grid",
                placeItems: "center",
              }}
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    background: "rgba(0,0,0,0.06)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    color: "rgba(0,0,0,0.55)",
                  }}
                >
                  {String(name || "U").trim().slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <label
              style={{
                position: "absolute",
                bottom: -8,
                left: -8,
                width: 34,
                height: 34,
                borderRadius: 14,
                background: "white",
                boxShadow: "0 14px 30px rgba(0,0,0,0.12)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
              title="تغيير الصورة"
            >
              <IconCamera />
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleAvatarPick(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#000" }}>{name}</div>
            <div style={{ marginTop: 4, fontWeight: 900, color: "rgba(0,0,0,0.70)" }}>{job}</div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>{about}</div>
          </div>
        </div>
      </section>

      <div style={{ height: 14 }} />

      {/* ✅ البروفايل: عرض + زر تعديل صغير */}
      <Card>
        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#000" }}>الملف الشخصي</div>

            {!editProfile ? (
              <button type="button" style={smallEditBtn()} onClick={() => setEditProfile(true)}>
                تعديل
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={smallGhostBtn()} onClick={() => {
                  // رجّع القيم من supabase (آخر نسخة)
                  setFullName(sbProfile?.full_name ?? "");
                  setJobTitle(sbProfile?.job_title ?? "");
                  setBio(sbProfile?.bio ?? "");
                  setAvatarDataUrl(sbProfile?.avatar_url ?? "");
                  setEditProfile(false);
                }}>
                  إلغاء
                </button>

                <button type="button" style={smallEditBtn()} onClick={saveProfileToSupabase} disabled={savingProfile}>
                  {savingProfile ? "حفظ..." : "حفظ"}
                </button>
              </div>
            )}
          </div>

          <div style={{ height: 10 }} />

          {!editProfile ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={labelStyle()}>الاسم</div>
                <div style={{ fontWeight: 900, color: "#000" }}>{name}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={labelStyle()}>المهنة</div>
                <div style={{ fontWeight: 900, color: "#000" }}>{job}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={labelStyle()}>نبذة</div>
                <div style={{ fontWeight: 900, color: "#000", maxWidth: 320, textAlign: "left" }}>{about}</div>
              </div>

            
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={labelStyle()}>الاسم (إجباري)</div>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: إبراهيم" style={inputStyle()} />
              </div>

              <div>
                <div style={labelStyle()}>الدور / المهنة (اختياري)</div>
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="مثال: IT Specialist" style={inputStyle()} />
              </div>

              <div>
                <div style={labelStyle()}>نبذة قصيرة (اختياري)</div>
                <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="اكتب سطر…" style={inputStyle()} />
              </div>
            </div>
          )}
        </div>
      </Card>

      <div style={{ height: 14 }} />

      {/* ✅ تفضيلات التطبيق: عرض + زر تعديل صغير */}
      <Card>
        <div style={{ padding: 14, marginBottom: -12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#000" }}>تفضيلات التطبيق</div>

            {!editPrefs ? (
              <button type="button" style={smallEditBtn()} onClick={() => setEditPrefs(true)}>
                تعديل
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={smallGhostBtn()} onClick={() => {
                  setMonthlyIncomeTargetSB(Number(sbSettings?.monthly_income_target ?? 3000));
                  setBaseCurrencySB(normalizeCur(sbSettings?.base_currency ?? "USD"));
                  setEditPrefs(false);
                  setCurOpen(false);
                }}>
                  إلغاء
                </button>

                <button type="button" style={smallEditBtn()} onClick={savePrefsToSupabase} disabled={savingPrefs}>
                  {savingPrefs ? "حفظ..." : "حفظ"}
                </button>
              </div>
            )}
          </div>

          <div style={{ height: 12 }} />

          {!editPrefs ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={labelStyle()}>هدف الدخل الشهري</div>
                <div style={{ fontWeight: 900, color: "#000" }}>{Math.round(Number(monthlyIncomeTargetSB || 0))}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={labelStyle()}>العملة الأساسية</div>
                <div style={{ fontWeight: 900, color: "#000" }}>{baseCur}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <div style={labelStyle()}>هدف الدخل الشهري</div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={String(Number.isFinite(monthlyIncomeTargetSB as any) ? monthlyIncomeTargetSB : 0)}
                  onChange={(e) => setMonthlyIncomeTargetSB(Number(e.target.value || 0))}
                  placeholder="مثال: 3000"
                  style={inputStyle()}
                />
              </div>

              <div>
                <div style={labelStyle()}>العملة الأساسية</div>

                <div style={{ position: "relative" }}>
                  <button
                    ref={curBtnRef}
                    type="button"
                    onClick={() => setCurOpen((v) => !v)}
                    style={{
                      width: "100%",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "right",
                      borderRadius: 18,
                      padding: "14px 14px",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.90) 100%)",
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.07), 0 12px 28px rgba(0,0,0,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 14,
                          background: "rgba(50,194,182,0.14)",
                          boxShadow: "inset 0 0 0 1px rgba(50,194,182,0.26)",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 900,
                          color: "#000",
                        }}
                      >
                        {baseCur}
                      </span>
                      <div style={{ fontWeight: 900, color: "#000" }}>اختيار العملة</div>
                    </div>

                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 14,
                        background: "rgba(0,0,0,0.04)",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <IconChevronDown />
                    </span>
                  </button>

                  {curOpen && (
                    <div
                      ref={curPanelRef}
                      style={{
                        position: "absolute",
                        top: "calc(100% + 10px)",
                        right: 0,
                        left: 0,
                        zIndex: 50,
                        borderRadius: 20,
                        background: "rgba(255,255,255,0.94)",
                        boxShadow: "0 22px 60px rgba(0,0,0,0.18)",
                        overflow: "hidden",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      <div style={{ maxHeight: 280, overflow: "auto", padding: 10 }}>
                        <div style={{ display: "grid", gap: 8 }}>
                          {currencyList.map((c) => {
                            const active = c === baseCur;
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setBaseCurrencySBAndClose(c)}
                                style={{
                                  border: "none",
                                  cursor: "pointer",
                                  width: "100%",
                                  textAlign: "right",
                                  padding: "12px 12px",
                                  borderRadius: 16,
                                  background: active ? "rgba(50,194,182,0.18)" : "rgba(0,0,0,0.04)",
                                  boxShadow: active ? "inset 0 0 0 1px rgba(50,194,182,0.32)" : "inset 0 0 0 1px rgba(0,0,0,0.05)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 10,
                                }}
                              >
                                <span style={{ fontWeight: 900, color: "#000" }}>{c}</span>
                                <span
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 12,
                                    background: active ? "rgba(50,194,182,0.34)" : "rgba(0,0,0,0.05)",
                                    display: "grid",
                                    placeItems: "center",
                                    color: "#000",
                                    fontWeight: 900,
                                  }}
                                >
                                  {active ? "✓" : ""}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* FX */}
              <div>
                <div style={labelStyle()}>أسعار الصرف</div>

                <div
                  style={{
                    borderRadius: 18,
                    padding: 12,
                    background: "rgba(0,0,0,0.03)",
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ display: "grid", gap: 2 }}>
                      <div style={{ fontWeight: 900, color: "#000" }}>آخر تحديث</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.60)" }}>
                        {state.fxUpdatedAt ? new Date(state.fxUpdatedAt).toLocaleString("de-DE") : "—"}
                        {state.fxSource ? ` · ${state.fxSource}` : ""}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={refreshFx}
                      disabled={fxLoading}
                      style={{
                        border: "none",
                        cursor: fxLoading ? "not-allowed" : "pointer",
                        borderRadius: 16,
                        padding: "10px 12px",
                        fontWeight: 900,
                        background: fxLoading ? "rgba(0,0,0,0.10)" : "rgba(50,194,182,0.16)",
                        boxShadow: "inset 0 0 0 1px #32c2b64d",
                        color: "#000",
                        opacity: fxLoading ? 0.7 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fxLoading ? "جاري التحديث..." : "تحديث الآن"}
                    </button>
                  </div>

                  {fxError ? <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(180,0,0,0.85)" }}>{fxError}</div> : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div style={{ height: 14 }} />
<div style={{ height: 14 }} />
{/*
<Card>
  <div style={{ padding: 14 }}>
    <div style={{ fontWeight: 900, fontSize: 14, color: "#000", marginBottom: 10 }}>اللغة</div>

    <div style={{ display: "flex", gap: 10 }}>
      <button type="button" onClick={() => setLang("ar")} style={pillBtn(lang === "ar")}>
        العربية
      </button>
      <button type="button" onClick={() => setLang("de")} style={pillBtn(lang === "de")}>
        Deutsch
      </button>
      <button type="button" onClick={() => setLang("en")} style={pillBtn(lang === "en")}>
        English
      </button>
    </div>
  </div>
</Card>*/}
<button
  onClick={logout}
  style={{
    width: "100%",
    marginTop: 15,
    borderRadius: 16,
    padding: "14px",
    fontWeight: 700,
    border: "none",
    background:"linear-gradient(135deg, #ffeded, #ffe2e2)",
    boxShadow: "0 10px 26px rgba(180,0,0,0.15)",

    color: "rgba(180,0,0,0.9)",
    cursor: "pointer",
  }}
>
  تسجيل الخروج
</button>

      <SocialFooter items={socialFooterItems} />
      <BottomNav />
      
    </main>
    
  );
  
}
