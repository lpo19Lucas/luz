"use client";

// "Ativar notificações neste aparelho" (PWA — Fase E2). Pede a permissão do
// navegador só quando a pessoa toca no botão (nunca ao abrir a página), se
// inscreve no serviço de push e registra o aparelho na Luz:
// - dono/profissional: sem accessToken (usa a sessão);
// - cliente: com o accessToken do agendamento.
// No iPhone o push só existe com o app instalado — aí mostra o aviso de
// instalar em vez do botão.
import { useCallback, useEffect, useState } from "react";
import { Box, Button, Typography, Alert } from "@mui/material";
import { isIos, iosSupportsWebPush, urlBase64ToUint8Array } from "@/lib/pwa";
import { isStandaloneDisplay } from "./InstallAppPrompt";

export type PushState = "loading" | "unsupported" | "unconfigured" | "needs-install" | "old-ios" | "denied" | "off" | "on";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export default function EnableNotifications({
  accessToken,
  variant = "card",
  title = "Notificações neste aparelho",
  description,
}: {
  accessToken?: string;
  variant?: "card" | "sidebar";
  title?: string;
  description?: string;
}) {
  const [state, setState] = useState<PushState>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(
    async (subscription: PushSubscription) => {
      const res = await fetch("/api/push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), accessToken }),
      });
      if (!res.ok) throw new Error("Não foi possível registrar este aparelho.");
    },
    [accessToken]
  );

  useEffect(() => {
    (async () => {
      const ua = navigator.userAgent;
      if (isIos(ua, navigator.maxTouchPoints)) {
        if (!iosSupportsWebPush(ua)) return setState("old-ios");
        if (!isStandaloneDisplay()) return setState("needs-install");
      }
      if (!pushSupported()) return setState("unsupported");
      const config = await fetch("/api/push/subscription").then((r) => r.json()).catch(() => null);
      if (!config?.configured || !config.publicKey) return setState("unconfigured");
      setPublicKey(config.publicKey);
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        // Garante que o aparelho está associado a quem está usando agora.
        await register(existing).catch(() => {});
        setState("on");
      } else {
        setState("off");
      }
    })().catch(() => setState("unsupported"));
  }, [register]);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const subscription =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      await register(subscription);
      setState("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ativar.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported" || state === "unconfigured") return null;

  if (variant === "sidebar") {
    if (state === "on") {
      return (
        <Typography sx={{ color: "#8FD3A8", fontSize: 13, px: 1, py: 1 }}>🔔 Notificações ativas</Typography>
      );
    }
    if (state !== "off") return null;
    return (
      <Button onClick={enable} disabled={busy} size="small" fullWidth sx={{ color: "#D4AF37", justifyContent: "flex-start", px: 1 }}>
        🔔 Ativar notificações
      </Button>
    );
  }

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2, bgcolor: "background.paper" }}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
        🔔 {title}
      </Typography>
      {description && state !== "on" && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          {description}
        </Typography>
      )}
      {state === "off" && (
        <Button onClick={enable} disabled={busy} variant="contained" size="small">
          {busy ? "Ativando..." : "Ativar notificações"}
        </Button>
      )}
      {state === "on" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="body2" sx={{ color: "success.main", fontWeight: 600 }}>
            Ativadas neste aparelho
          </Typography>
          <Button onClick={disable} disabled={busy} size="small" color="inherit">
            Desativar
          </Button>
        </Box>
      )}
      {state === "denied" && (
        <Alert severity="info" sx={{ mt: 1 }}>
          As notificações estão bloqueadas neste navegador. Libere nas configurações do site (ícone de cadeado ao lado do
          endereço) e recarregue a página.
        </Alert>
      )}
      {state === "needs-install" && (
        <Alert severity="info" sx={{ mt: 1 }}>
          No iPhone, as notificações funcionam com o app instalado: toque em Compartilhar → Adicionar à Tela de Início e
          abra o app pela tela inicial.
        </Alert>
      )}
      {state === "old-ios" && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Este iPhone não recebe notificações do site (precisa do iOS 16.4 ou mais novo).
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
