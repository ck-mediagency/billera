"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PUBLIC_PATHS = ["/auth/callback", "/reset-password"]; // صفحات عامة
const SETUP_PATH = "/setup";
const LOGIN_PATH = "/login";

// ✅ صفحات مسموحة أثناء الإعداد
const SETUP_ALLOWED_PATHS = ["/setup", "/accounts", "/buckets"];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    async function check() {
      setReady(false);

      // ✅ صفحات عامة دايمًا مسموحة
      if (PUBLIC_PATHS.some((p) => pathname?.startsWith(p))) {
        if (alive) setReady(true);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      // ✅ إذا مو مسجل دخول
      if (!session) {
        if (pathname?.startsWith(LOGIN_PATH)) {
          if (alive) setReady(true);
          return;
        }
        router.replace(LOGIN_PATH);
        return;
      }

      // ✅ مسجل دخول: قرر setup ولا لا (حسب Supabase)
      const [accRes, buckRes] = await Promise.all([
        supabase.from("accounts").select("id", { count: "exact", head: true }),
        supabase.from("buckets").select("id", { count: "exact", head: true }),
      ]);

      const hasAccounts = (accRes.count ?? 0) > 0;
      const hasBuckets = (buckRes.count ?? 0) > 0;
      const needSetup = !(hasAccounts && hasBuckets);

      if (needSetup) {
        // ✅ اسمح فقط بصفحات الإعداد المطلوبة
        const allowed = SETUP_ALLOWED_PATHS.some((p) => pathname?.startsWith(p));
        if (!allowed) {
          router.replace(SETUP_PATH);
          return;
        }
        if (alive) setReady(true);
        return;
      }

      // ✅ إذا ما بحاجة setup:
      // امنع /login و /setup
      if (pathname?.startsWith(LOGIN_PATH) || pathname?.startsWith(SETUP_PATH)) {
        router.replace("/");
        return;
      }

      if (alive) setReady(true);
    }

    check();

    // ✅ إذا صار sign in / sign out أثناء فتح الموقع
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
