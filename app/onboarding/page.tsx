"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { uploadAvatarForCurrentUser } from "@/lib/avatar";


const ACCENT = "#5BB9B4";

const CURRENCIES = ["USD", "EUR", "TRY", "GBP", "CHF", "AED", "SAR", "SYP"];

export default function OnboardingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Required
  const [fullName, setFullName] = useState("");
  const [monthlyGoal, setMonthlyGoal] = useState<number>(3000);
  const [baseCurrency, setBaseCurrency] = useState("USD");

  // Optional
  const [jobTitle, setJobTitle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    let alive = true;

    async function init() {
      setLoading(true);
      setMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      const userId = session.user.id;

      // إذا عنده بيانات أصلاً ما لازم يرجع يعبي
      const [{ data: prof }, { data: st }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      ]);

      if (prof && st) {
        router.replace("/settings");
        return;
      }

      // Prefill لطيف من user metadata إذا موجود
      const suggestedName =
        (session.user.user_metadata?.full_name as string) ||
        (session.user.user_metadata?.name as string) ||
        "";

      if (alive && suggestedName && !fullName) setFullName(suggestedName);

      if (alive) setLoading(false);
    }

    init();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function save() {
    setSaving(true);
    setMsg(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      router.replace("/login");
      return;
    }

    const userId = session.user.id;

    // تحقق إلزامي
    if (!fullName.trim()) {
      setMsg("الاسم مطلوب");
      setSaving(false);
      return;
    }
    if (!baseCurrency.trim()) {
      setMsg("العملة الأساسية مطلوبة");
      setSaving(false);
      return;
    }
    if (!monthlyGoal || monthlyGoal <= 0) {
      setMsg("هدف الدخل الشهري لازم يكون رقم صحيح");
      setSaving(false);
      return;
    }

    const up1 = supabase.from("profiles").upsert({
      user_id: userId,
      full_name: fullName.trim(),
      job_title: jobTitle.trim() || null,
      bio: bio.trim() || null,
      updated_at: new Date().toISOString(),
    });

    const up2 = supabase.from("user_settings").upsert({
      user_id: userId,
      base_currency: baseCurrency.trim().toUpperCase(),
      monthly_income_target: monthlyGoal,
      updated_at: new Date().toISOString(),
    });

    const [r1, r2] = await Promise.all([up1, up2]);

    const err = r1.error || r2.error;
    if (err) {
      setMsg(err.message);
      setSaving(false);
      return;
    }

    router.replace("/settings");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        جاري التحميل...
      </div>
    );
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
          maxWidth: 520,
          borderRadius: 18,
          border: "1px solid #E6E6E9",
          background: "#fff",
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, textAlign: "center" }}>
          إعداد الحساب
        </h1>
        <p style={{ margin: "8px 0 16px", fontSize: 13, color: "#6B7280", textAlign: "center" }}>
          ثلاث معلومات إلزامية وبعدها بتدخل التطبيق مباشرة
        </p>
<label style={{ fontSize: 13, fontWeight: 800 }}>
  الصورة الشخصية (اختياري)
</label>

<div
  style={{
    marginTop: 10,
    marginBottom: 10,
    padding: 14,
    borderRadius: 18,
    background: "rgba(50,194,182,0.08)",
    display: "flex",
    alignItems: "center",
    gap: 14,
  }}
>
  {/* Avatar */}
  <div
    style={{
      width: 64,
      height: 64,
      borderRadius: 20,
      background: "rgba(255,255,255,0.9)",
      boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
      display: "grid",
      placeItems: "center",
      overflow: "hidden",
      fontWeight: 900,
      fontSize: 22,
      color: "rgba(0,0,0,0.6)",
      flexShrink: 0,
    }}
  >
    {avatarFile ? (
      <img
        src={URL.createObjectURL(avatarFile)}
        alt="avatar preview"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    ) : (
      (name || "U").charAt(0).toUpperCase()
    )}
  </div>

  {/* Actions */}
  <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
    <label
      style={{
        alignSelf: "flex-end",
        padding: "10px 14px",
        borderRadius: 14,
        background: "rgba(50,194,182,0.25)",
        fontWeight: 900,
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      إضافة صورة
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
      />
    </label>

    
  </div>
</div>

        {/* Required */}
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 800 }}>الاسم (إجباري)</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="مثال: إبراهيم"
            style={inputStyle}
          />

          <label style={{ fontSize: 13, fontWeight: 800 }}>هدف الدخل الشهري (إجباري)</label>
          <input
            type="number"
            value={monthlyGoal}
            onChange={(e) => setMonthlyGoal(Number(e.target.value))}
            style={inputStyle}
          />

          <label style={{ fontSize: 13, fontWeight: 800 }}>العملة الأساسية (إجباري)</label>
          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
            style={inputStyle}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ height: 16 }} />

        {/* Optional */}
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 800 }}>
            المهنة (اختياري)
          </label>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="مثال: IT Specialist"
            style={inputStyle}
          />

          <label style={{ fontSize: 13, fontWeight: 800 }}>
            نبذة قصيرة (اختياري)
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="اكتب سطرين عن نفسك…"
            style={{ ...inputStyle, minHeight: 90, resize: "vertical" as const }}
          />

          

        </div>

        <button
          onClick={save}
          disabled={saving || !fullName.trim() || !baseCurrency || !monthlyGoal}
          style={{
            width: "100%",
            marginTop: 16,
            padding: 12,
            borderRadius: 14,
            border: "1px solid transparent",
            background: saving ? "#D1D5DB" : ACCENT,
            color: "#fff",
            fontWeight: 900,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "جاري الحفظ..." : "حفظ والدخول للتطبيق"}
        </button>

        {msg && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              background: "#F9FAFB",
              border: "1px solid #E5E7EB",
              fontSize: 13,
              color: "#111827",
            }}
          >
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #D1D5DB",
  outline: "none",
  fontSize: 14,
};
