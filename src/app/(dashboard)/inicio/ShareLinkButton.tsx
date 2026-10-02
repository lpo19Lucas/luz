"use client";

import { useState } from "react";
import { Button, Stack } from "@mui/material";

/** Copiar/compartilhar o link do salão (B8) — Web Share API quando
 * disponível (celular), senão copia pra área de transferência. */
export default function ShareLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ url, title: "Agende seu horário" });
        return;
      } catch {
        // Cancelado pelo usuário — sem feedback de erro, só não faz nada.
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Stack direction="row" spacing={1}>
      <Button size="small" variant="outlined" onClick={handleShare}>
        {copied ? "Copiado!" : "Copiar / compartilhar"}
      </Button>
    </Stack>
  );
}
