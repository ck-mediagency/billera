"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PUBLIC_PATHS = ["/auth/callback"]; // نخلي callback عام فقط
const ONBOARDING_PATH = "/onboarding";
const LOGIN_PATH = "/login";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    async function check() {
      setReady(false);

      // callback دايمًا مسموح
      if (PUBLIC_PATHS.some((p) => pathname?.startsWith(p))) {
        if (alive) setReady(true);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      // ✅ إذا مو مسجل دخول
      if (!session) {
        // لو هو أصلاً على /login خليّه
        if (pathname?.startsWith(LOGIN_PATH)) {
          if (alive) setReady(true);
          return;
        }
        router.replace(LOGIN_PATH);
        return;
      }

      const userId = session.user.id;

      // ✅ افحص هل عنده profile + settings
      const [{ data: prof }, { data: st }] = await Promise.all([
        supabase.from("profiles").select("user_id").eq("user_id", userId).maybeSingle(),
        supabase.from("user_settings").select("user_id").eq("user_id", userId).maybeSingle(),
      ]);

      const isComplete = !!prof && !!st;

      // ✅ إذا الحساب مو مكتمل → لازم onboarding
      if (!isComplete) {
        if (!pathname?.startsWith(ONBOARDING_PATH)) {
          router.replace(ONBOARDING_PATH);
          return;
        }
        if (alive) setReady(true);
        return;
      }

      // ✅ إذا الحساب مكتمل:
      // امنع /login و /onboarding
      if (pathname?.startsWith(LOGIN_PATH) || pathname?.startsWith(ONBOARDING_PATH)) {
        router.replace("/"); // التطبيق
        return;
      }

      if (alive) setReady(true);
    }

    check();

    // ✅ مهم: لو صار sign in / sign out أثناء فتح الموقع
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        جاري التحميل...
      </div>
    );
  }

  return <>{children}</>;
}
