"use client";

// Botão "Instalar app" (PWA). Android/Chrome: usa o prompt nativo
// (beforeinstallprompt). iPhone/iPad: o Safari não tem prompt — abre o passo
// a passo do "Compartilhar → Adicionar à Tela de Início" (e no iOS o push só
// funciona com o app instalado). Já instalado ou navegador sem suporte: some.
import { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogContent, DialogTitle, Typography, Stack } from "@mui/material";
import { isIos } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallAppPrompt({
  appName,
  description,
  variant = "card",
}: {
  appName: string;
  description?: string;
  variant?: "card" | "sidebar";
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true); // começa escondido até checar no cliente
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setIos(isIos(navigator.userAgent, navigator.maxTouchPoints));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!deferred && !ios)) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } else {
      setHelpOpen(true);
    }
  }

  const label = ios ? "Instalar no iPhone" : "Instalar app";

  return (
    <>
      {variant === "sidebar" ? (
        <Button onClick={handleClick} size="small" fullWidth sx={{ color: "#D4AF37", justifyContent: "flex-start", px: 1 }}>
          📲 {label}
        </Button>
      ) : (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2, bgcolor: "background.paper" }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            📲 Instale o app {appName}
          </Typography>
          {description && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
              {description}
            </Typography>
          )}
          <Button onClick={handleClick} variant="contained" size="small">
            {label}
          </Button>
        </Box>
      )}

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Instalar no iPhone</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mb: 1 }}>
            <Typography variant="body2">
              1. Abra esta página no <b>Safari</b>.
            </Typography>
            <Typography variant="body2">
              2. Toque em <b>Compartilhar</b> (o quadrado com a seta para cima ⬆️).
            </Typography>
            <Typography variant="body2">
              3. Escolha <b>Adicionar à Tela de Início</b> e confirme.
            </Typography>
            <Typography variant="body2">
              4. Abra o app {appName} pela tela inicial para ativar as notificações.
            </Typography>
          </Stack>
          <Button onClick={() => setHelpOpen(false)} fullWidth variant="outlined" sx={{ mt: 1 }}>
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
