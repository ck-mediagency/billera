"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { loadState } from "@/lib/storage";
import type { AppState } from "@/lib/types";

const ACCENT = "#5BB9B4";

type MsgState = { type: "success" | "warn" | "error"; text: string } | null;

type ExtendedState = AppState & {
  incomeBuckets?: { id: string; name: string; percent?: number }[];
  expenseBuckets?: { id: string; name: string; percent?: number }[];
  onboardingDone?: boolean;
};

function getSiteUrl() {
  // ✅ يشتغل على localhost وعلى الدومين الحقيقي بدون تعديل يدوي
  if (typeof window === "undefined") return "http://localhost:3000";
  return window.location.origin;
}

function shouldGoToSetup(s: ExtendedState | null | undefined) {
  const accountsCount = (s?.accounts ?? []).length;
  const catsCount = ((s?.incomeBuckets ?? []).length + (s?.expenseBuckets ?? []).length);

  // إذا ما في محافظ أو ما في تصنيفات → لازم setup
  return accountsCount === 0 || catsCount === 0 || !s?.onboardingDone;
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<MsgState>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // ✅ SIGN IN
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setMsg({
            type: "error",
            text: "بيانات الدخول غير صحيحة. تأكد من الإيميل وكلمة المرور.",
          });
          setLoading(false);
          return;
        }

        // ✅ بعد تسجيل الدخول: قرر وين تروح
        const s = (loadState() as ExtendedState) ?? null;
        router.replace(shouldGoToSetup(s) ? "/setup" : "/");
        setLoading(false);
        return;
      }

      // ✅ SIGN UP
      const siteUrl = getSiteUrl();

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`,
        },
      });

      if (error) {
        setMsg({ type: "error", text: error.message });
        setLoading(false);
        return;
      }

      // ✅ إذا الإيميل موجود مسبقاً: identities = []
      const identities = (data?.user as any)?.identities;
      const isExistingEmail = Array.isArray(identities) && identities.length === 0;

      if (isExistingEmail) {
        setMsg({ type: "warn", text: "هذا الإيميل لديه حساب بالفعل. سجّل دخولك." });
        setMode("signin");
        setLoading(false);
        return;
      }

      setMsg({
        type: "success",
        text: "تم إنشاء الحساب. راجع الإيميل واضغط رابط التأكيد، بعدها ارجع وسجّل دخول.",
      });
      setMode("signin");
      setLoading(false);
    } catch {
      setMsg({ type: "error", text: "صار خطأ غير متوقع. جرّب مرة ثانية." });
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setMsg({ type: "error", text: "اكتب الإيميل أولاً، ثم اضغط نسيت كلمة المرور." });
      return;
    }

    setLoading(true);
    setMsg(null);

    const siteUrl = getSiteUrl();

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${siteUrl}/reset-password`,
    });

    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "success", text: "تم إرسال رابط تغيير كلمة المرور إلى الإيميل." });
    }

    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "#F7F7F8",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 18,
          border: "1px solid #E6E6E9",
          background: "#fff",
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              margin: "0 auto 10px",
              background: `${ACCENT}1A`,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${ACCENT}33`,
            }}
            aria-hidden
          >
            <span style={{ color: ACCENT, fontWeight: 900 }}>M</span>
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            {mode === "signup" ? "إنشاء حساب" : "تسجيل الدخول"}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B7280" }}>
            {mode === "signup" ? "أنشئ حسابك ثم أكّد الإيميل" : "ادخل بإيميلك وكلمة المرور"}
          </p>
        </div>

        <label style={{ fontSize: 13, color: "#111827", fontWeight: 700 }}>البريد الإلكتروني</label>
        <input
          type="email"
          placeholder="example@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid #D1D5DB",
            marginTop: 8,
            outline: "none",
            fontSize: 14,
          }}
        />

        <div style={{ height: 12 }} />

        <label style={{ fontSize: 13, color: "#111827", fontWeight: 700 }}>كلمة المرور</label>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid #D1D5DB",
            marginTop: 8,
            outline: "none",
            fontSize: 14,
          }}
        />

        {/* ✅ زر نسيت كلمة المرور (يظهر فقط بوضع تسجيل الدخول) */}
        {mode === "signin" && (
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={loading}
            style={{
              marginTop: 10,
              width: "100%",
              background: "transparent",
              border: "none",
              color: "#111827",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 13,
              textDecoration: "underline",
              textAlign: "center",
            }}
          >
            نسيت كلمة المرور؟
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !email || (mode === "signup" ? password.length < 6 : password.length < 1)}
          style={{
            width: "100%",
            marginTop: 16,
            padding: 12,
            borderRadius: 14,
            border: "1px solid transparent",
            background:
              loading || !email || (mode === "signup" ? password.length < 6 : password.length < 1)
                ? "#D1D5DB"
                : ACCENT,
            color: "#fff",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "جاري..." : mode === "signup" ? "إنشاء حساب" : "تسجيل الدخول"}
        </button>

        {msg && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 900,
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              background:
                msg.type === "success"
                  ? "rgba(34,197,94,0.10)"
                  : msg.type === "warn"
                  ? "rgba(245,158,11,0.12)"
                  : "rgba(239,68,68,0.10)",
              border:
                msg.type === "success"
                  ? "1px solid rgba(34,197,94,0.25)"
                  : msg.type === "warn"
                  ? "1px solid rgba(245,158,11,0.28)"
                  : "1px solid rgba(239,68,68,0.25)",
              color:
                msg.type === "success"
                  ? "rgba(22,101,52,1)"
                  : msg.type === "warn"
                  ? "rgba(120,53,15,1)"
                  : "rgba(127,29,29,1)",
            }}
          >
            <div style={{ fontSize: 16, lineHeight: "16px", marginTop: 1 }}>
              {msg.type === "success" ? "✅" : msg.type === "warn" ? "⚠️" : "⛔"}
            </div>
            <div style={{ lineHeight: 1.4 }}>{msg.text}</div>
          </div>
        )}

        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button
            onClick={() => {
              setMsg(null);
              setMode(mode === "signup" ? "signin" : "signup");
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#111827",
              fontWeight: 800,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {mode === "signup" ? "لديك حساب؟ سجّل دخول" : "ما عندك حساب؟ أنشئ حساب"}
          </button>
        </div>
      </div>
    </div>
  );
}
