// lib/storage.ts
const BASE_KEY = "moneyapp_state"; // legacy + base prefix

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

export function saveState(state: any, userId?: string | null) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function clearState(userId?: string | null) {
  try {
    localStorage.removeItem(keyFor(userId));
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
  } catch {
    // ignore
  }
}
