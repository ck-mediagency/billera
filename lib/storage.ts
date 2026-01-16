// lib/storage.ts
const BASE_KEY = "moneyapp_state"; // legacy + base prefix

// ✅ Event name موحّد لكل التطبيق
export const APPSTATE_CHANGED_EVENT = "appstate:changed";

function keyFor(userId?: string | null) {
  return userId ? `${BASE_KEY}_${userId}` : `${BASE_KEY}_guest`;
}

/**
 * ✅ Migration helper:
 * - إذا كان في بيانات قديمة تحت المفتاح القديم BASE_KEY
 * - ونحنا هلأ عم نشتغل بحساب userId
 * - مننقلها مرة واحدة لمفتاح المستخدم ثم منحذف القديم
 */
function migrateLegacyToUser(userId?: string | null) {
  if (!userId) return;

  try {
    const legacyRaw = localStorage.getItem(BASE_KEY); // 👈 المفتاح القديم
    if (!legacyRaw) return;

    const userKey = keyFor(userId);
    const already = localStorage.getItem(userKey);

    // إذا في بيانات للمستخدم أصلاً ما منستبدلها
    if (already) {
      localStorage.removeItem(BASE_KEY);
      return;
    }

    localStorage.setItem(userKey, legacyRaw);
    localStorage.removeItem(BASE_KEY);
  } catch {
    // ignore
  }
}

export function loadState(userId?: string | null) {
  try {
    // ✅ حاول هجرة بيانات legacy إذا موجودة
    migrateLegacyToUser(userId);

    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * ✅ saveState صار يطلق حدث بعد الحفظ
 * حتى كل الصفحات اللي بتسمع للحدث تعمل reload للـ state
 */
export function saveState(state: any, userId?: string | null) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(state));

    // ✅ خبر باقي الصفحات ضمن نفس التبويب
    window.dispatchEvent(new Event(APPSTATE_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function clearState(userId?: string | null) {
  try {
    localStorage.removeItem(keyFor(userId));

    // ✅ كمان بعد المسح
    window.dispatchEvent(new Event(APPSTATE_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/**
 * ✅ Optional util: clear all app keys (useful for debugging)
 */
export function clearAllAppStates() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === BASE_KEY || k.startsWith(`${BASE_KEY}_`))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));

    // ✅ بعد المسح الكامل
    window.dispatchEvent(new Event(APPSTATE_CHANGED_EVENT));
  } catch {
    // ignore
  }
}
