import { supabase } from "@/lib/supabaseClient";

export async function logout() {
  await supabase.auth.signOut();

  // تحويل المستخدم لصفحة تسجيل الدخول
  window.location.href = "/login";
}
