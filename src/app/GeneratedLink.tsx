"use client";

// Link gerado (convite/redefinição de senha) com copiar e enviar por WhatsApp —
// usado no admin e no convite do profissional.
import { useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

/** Link gerado (convite/redefinição) com copiar e enviar por WhatsApp. */
export default function GeneratedLink({ link, whatsappHref, note }: { link: string; whatsappHref?: string | null; note?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Alert severity="success" sx={{ "& .MuiAlert-message": { width: "100%" } }}>
      {note && <Typography variant="body2" sx={{ mb: 1 }}>{note}</Typography>}
      <Box sx={{ fontFamily: "monospace", fontSize: 12.5, wordBreak: "break-all", bgcolor: "background.paper", p: 1, borderRadius: 1, mb: 1 }}>
        {link}
      </Box>
      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? "Copiado!" : "Copiar link"}
        </Button>
        {whatsappHref && (
          <Button size="small" variant="contained" href={whatsappHref} target="_blank" rel="noopener">
            Enviar por WhatsApp
          </Button>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        O link só aparece agora — gere outro se precisar (o anterior deixa de valer).
      </Typography>
    </Alert>
  );
}
