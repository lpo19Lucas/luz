"use client";

import { useRef, useState } from "react";
import { Box, Paper, Typography, Stack, TextField, Button, Avatar, Alert } from "@mui/material";
import { updateSalonProfileAction } from "@/lib/actions/salon";
import { resizeImageToDataURL } from "@/lib/imageResize";

type SalonProfile = {
  slug: string;
  description: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  whatsappPhone: string | null;
  email: string | null;
  cnpj: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  websiteUrl: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  hasCover: boolean;
  coverUrl: string | null;
};

export default function SalonProfileForm({ salon }: { salon: SalonProfile }) {
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(salon.coverUrl);
  const [removeCover, setRemoveCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await resizeImageToDataURL(file);
      setCoverDataUrl(dataUrl);
      setCoverPreview(dataUrl);
      setRemoveCover(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar a imagem");
    }
  }

  function handleRemoveCover() {
    setCoverDataUrl(null);
    setCoverPreview(null);
    setRemoveCover(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <Paper elevation={1} sx={{ p: 3, maxWidth: 560, mb: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 0.5 }}>
        Perfil público (F3)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tudo opcional — aparece no link do salão ({`/${salon.slug}`}).
      </Typography>

      <Stack component="form" action={updateSalonProfileAction} spacing={2}>
        <input type="hidden" name="coverImageData" value={coverDataUrl ?? ""} />
        <input type="hidden" name="removeCover" value={removeCover ? "on" : "off"} />

        <Box>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Capa
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              variant="rounded"
              src={coverPreview ?? undefined}
              sx={{ width: 120, height: 68, bgcolor: "grey.200" }}
            >
              {!coverPreview && "Sem capa"}
            </Avatar>
            <Stack spacing={1}>
              <Button component="label" variant="outlined" size="small">
                Escolher imagem
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleFileChange}
                />
              </Button>
              {coverPreview && (
                <Button size="small" color="error" onClick={handleRemoveCover}>
                  Remover capa
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

        <Stack direction="row" spacing={2}>
          <TextField
            name="primaryColor"
            label="Cor primária"
            size="small"
            type="color"
            defaultValue={salon.primaryColor ?? "#1E2761"}
            sx={{ width: 140 }}
          />
          <TextField
            name="accentColor"
            label="Cor de destaque"
            size="small"
            type="color"
            defaultValue={salon.accentColor ?? "#C9A227"}
            sx={{ width: 140 }}
          />
        </Stack>

        <TextField
          name="description"
          label="Sobre o salão"
          multiline
          minRows={2}
          defaultValue={salon.description ?? ""}
        />

        <Stack direction="row" spacing={2}>
          <TextField
            name="whatsappPhone"
            label="WhatsApp do salão"
            placeholder="(11) 99999-9999"
            defaultValue={salon.whatsappPhone ?? ""}
            size="small"
            fullWidth
          />
          <TextField name="email" label="E-mail" defaultValue={salon.email ?? ""} size="small" fullWidth />
        </Stack>

        <TextField name="cnpj" label="CNPJ" defaultValue={salon.cnpj ?? ""} size="small" sx={{ maxWidth: 260 }} />

        <Typography variant="body2" sx={{ fontWeight: 500, pt: 1 }}>
          Redes sociais
        </Typography>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2 }}>
          <TextField name="instagramUrl" label="Instagram" defaultValue={salon.instagramUrl ?? ""} size="small" fullWidth />
          <TextField name="facebookUrl" label="Facebook" defaultValue={salon.facebookUrl ?? ""} size="small" fullWidth />
          <TextField name="tiktokUrl" label="TikTok" defaultValue={salon.tiktokUrl ?? ""} size="small" fullWidth />
          <TextField name="websiteUrl" label="Site" defaultValue={salon.websiteUrl ?? ""} size="small" fullWidth />
        </Stack>

        <Typography variant="body2" sx={{ fontWeight: 500, pt: 1 }}>
          Endereço
        </Typography>
        <Stack direction="row" spacing={2}>
          <TextField name="addressStreet" label="Rua" defaultValue={salon.addressStreet ?? ""} size="small" fullWidth />
          <TextField name="addressNumber" label="Número" defaultValue={salon.addressNumber ?? ""} size="small" sx={{ width: 120 }} />
        </Stack>
        <TextField
          name="addressComplement"
          label="Complemento"
          defaultValue={salon.addressComplement ?? ""}
          size="small"
        />
        <Stack direction="row" spacing={2}>
          <TextField name="addressNeighborhood" label="Bairro" defaultValue={salon.addressNeighborhood ?? ""} size="small" fullWidth />
          <TextField name="addressCity" label="Cidade" defaultValue={salon.addressCity ?? ""} size="small" fullWidth />
          <TextField name="addressState" label="UF" defaultValue={salon.addressState ?? ""} size="small" sx={{ width: 80 }} />
          <TextField name="addressZip" label="CEP" defaultValue={salon.addressZip ?? ""} size="small" sx={{ width: 140 }} />
        </Stack>

        <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
          Salvar perfil público
        </Button>
      </Stack>
    </Paper>
  );
}
