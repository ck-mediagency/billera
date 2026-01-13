"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ACCENT = "#5BB9B4";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;

    async function init() {
      // إذا المستخدم وصل هون من رابط الإيميل، Supabase رح يجهّز session
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      // ما في session؟ يعني فات عالصفحة مباشرة بدون رابط reset
      if (!data.session) {
        setMsg({ type: "error", text: "افتح الصفحة من رابط تغيير كلمة المرور الذي وصلك على الإيميل." });
      }

      setReady(true);
    }

    init();
    return () => {
      alive = false;
    };
  }, []);

  async function saveNewPassword() {
    setLoading(true);
    setMsg(null);

    if (password.length < 6) {
      setMsg({ type: "error", text: "كلمة المرور لازم تكون 6 أحرف على الأقل." });
      setLoading(false);
      return;
    }
    if (password !== password2) {
      setMsg({ type: "error", text: "كلمتا المرور غير متطابقتين." });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMsg({ type: "error", text: error.message });
      setLoading(false);
      return;
    }

    setMsg({ type: "success", text: "تم تغيير كلمة المرور بنجاح. سيتم تحويلك لتسجيل الدخول." });

    // نسجل خروج من الجلسة المؤقتة ونرجعه للـ login
    setTimeout(async () => {
      await supabase.auth.signOut();
      router.replace("/login");
    }, 800);

    setLoading(false);
  }

  if (!ready) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>جاري التحميل...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "#F7F7F8" }}>
      <div style={{ width: "100%", maxWidth: 440, borderRadius: 18, border: "1px solid #E6E6E9", background: "#fff", padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.06)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, textAlign: "center" }}>تغيير كلمة المرور</h1>
        <p style={{ margin: "6px 0 14px", fontSize: 13, color: "#6B7280", textAlign: "center" }}>
          اكتب كلمة مرور جديدة
        </p>

        <label style={{ fontSize: 13, fontWeight: 800 }}>كلمة المرور الجديدة</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid #D1D5DB", marginTop: 8, outline: "none", fontSize: 14 }}
        />

        <div style={{ height: 12 }} />

        <label style={{ fontSize: 13, fontWeight: 800 }}>تأكيد كلمة المرور</label>
        <input
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder="••••••••"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid #D1D5DB", marginTop: 8, outline: "none", fontSize: 14 }}
        />

        <button
          onClick={saveNewPassword}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 16,
            padding: 12,
            borderRadius: 14,
            border: "1px solid transparent",
            background: loading ? "#D1D5DB" : ACCENT,
            color: "#fff",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
        </button>

        {msg && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              background: msg.type === "success" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
              border: msg.type === "success" ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(239,68,68,0.25)",
              color: msg.type === "success" ? "rgba(22,101,52,1)" : "rgba(127,29,29,1)",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
