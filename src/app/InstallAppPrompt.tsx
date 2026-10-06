"use client";

// Botão "Instalar app" (PWA).
// - Com o prompt nativo disponível (Chrome/Edge/Android): instala em um toque.
//   O prompt é capturado no <head> (src/app/layout.tsx) assim que a página
//   carrega — o Chrome avisa uma vez só, muitas vezes antes deste botão
//   existir (no celular ele fica num menu que só monta quando é aberto).
// - Sem prompt (iPhone, Samsung Internet, Firefox, Safari no Mac, ou o Chrome
//   ainda não ofereceu): abre o passo a passo do navegador da pessoa.
// - Já instalado (aberto pelo ícone): some.
import { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogContent, DialogTitle, Typography, Stack } from "@mui/material";
import { installHelp, isIos, type InstallHelp } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type WindowWithPrompt = Window & { __luzInstallPrompt?: BeforeInstallPromptEvent | null };

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
  const [help, setHelp] = useState<InstallHelp | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true); // começa escondido até checar no cliente
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const w = window as WindowWithPrompt;
    setInstalled(isStandaloneDisplay());
    setIos(isIos(navigator.userAgent, navigator.maxTouchPoints));
    setHelp(installHelp(navigator.userAgent, navigator.maxTouchPoints));
    setDeferred(w.__luzInstallPrompt ?? null);

    // Captura própria também (caso o script do <head> não tenha rodado, ex.: testes).
    const onNative = (e: Event) => {
      e.preventDefault();
      w.__luzInstallPrompt = e as BeforeInstallPromptEvent;
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onCaptured = () => setDeferred(w.__luzInstallPrompt ?? null);
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onNative);
    window.addEventListener("luz:installprompt", onCaptured);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onNative);
      window.removeEventListener("luz:installprompt", onCaptured);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !help) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      // O prompt só pode ser usado uma vez.
      (window as WindowWithPrompt).__luzInstallPrompt = null;
      setDeferred(null);
      if (outcome === "accepted") setInstalled(true);
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
        <DialogTitle>Instalar o app {appName}</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            No {help.platform}:
          </Typography>
          <Stack spacing={1.5} sx={{ mb: 1 }}>
            {help.steps.map((step, i) => (
              <Typography key={i} variant="body2">
                {i + 1}. {step}
              </Typography>
            ))}
          </Stack>
          <Button onClick={() => setHelpOpen(false)} fullWidth variant="outlined" sx={{ mt: 1 }}>
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
