"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // مجرد للتأكد أن session انحفظت بعد التأكيد
    supabase.auth.getSession().then(() => {
      router.replace("/settings"); // أو الصفحة الرئيسية تبعك إذا بدك
    });
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      جاري تأكيد الحساب...
    </div>
  );
}
const PUBLIC_PATHS = ["/login", "/auth/callback", "/onboarding", "/reset-password"];
