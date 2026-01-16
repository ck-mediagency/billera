"use client";

import { useEffect, useState } from "react";
import { APPSTATE_CHANGED_EVENT, loadState } from "@/lib/storage";

export function useAppState<TState>(defaultState: () => TState, userId?: string | null) {
  const [state, setState] = useState<TState>(() => {
    return (loadState(userId) as TState) ?? defaultState();
  });

  useEffect(() => {
    const sync = () => {
      setState(((loadState(userId) as TState) ?? defaultState()));
    };

    // ✅ تحديث داخل نفس التبويب
    window.addEventListener(APPSTATE_CHANGED_EVENT, sync);

    // ✅ تحديث بين التبويبات (لو فاتح التطبيق بتبويبين)
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(APPSTATE_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [userId, defaultState]);

  return { state, setState };
}
