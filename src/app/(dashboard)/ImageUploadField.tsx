"use client";

// Campo de foto pros formulários de profissional e serviço (server actions).
// Redimensiona no navegador e manda a data URL num input escondido
// (`imageData`); `removeImage` = "on" quando o dono tira a foto atual. A
// action lê os dois com readImageField (src/lib/storedImages.ts).
import { useRef, useState } from "react";
import { Avatar, Box, Button, Stack, Typography, Alert } from "@mui/material";
import { resizeImageToDataURL } from "@/lib/imageResize";

export default function ImageUploadField({
  label,
  currentUrl,
  shape = "circle",
  fallback,
}: {
  label: string;
  currentUrl?: string | null;
  shape?: "circle" | "rounded";
  fallback?: string;
}) {
  const [dataUrl, setDataUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const resized = await resizeImageToDataURL(file, 640, 0.82);
      setDataUrl(resized);
      setPreview(resized);
      setRemoved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar a imagem");
    }
  }

  function handleRemove() {
    setDataUrl("");
    setPreview(null);
    setRemoved(Boolean(currentUrl));
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Box>
      <input type="hidden" name="imageData" value={dataUrl} />
      <input type="hidden" name="removeImage" value={removed ? "on" : "off"} />
      <Typography variant="body2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar
          src={preview ?? undefined}
          alt={label}
          variant={shape === "circle" ? "circular" : "rounded"}
          sx={{ width: 72, height: 72, bgcolor: "grey.200", color: "text.secondary", fontSize: 13 }}
        >
          {fallback ?? "Sem foto"}
        </Avatar>
        <Stack spacing={0.75}>
          <Button component="label" variant="outlined" size="small">
            {preview ? "Trocar foto" : "Escolher foto"}
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleChange} />
          </Button>
          {preview && (
            <Button size="small" color="error" onClick={handleRemove}>
              Remover foto
            </Button>
          )}
        </Stack>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
