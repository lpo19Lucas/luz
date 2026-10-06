"use client";

import { useEffect } from "react";

/** Registra o service worker (public/sw.js) — app instalável + push. */
export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("[pwa] falha ao registrar o service worker", err);
    });
  }, []);
  return null;
}
