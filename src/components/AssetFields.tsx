"use client";

import { MenuItem, Stack, TextField, Typography } from "@mui/material";
import type { AssetKind, AssetSize } from "@prisma/client";
import { ASSET_FIELDS, ASSET_SIZE_LABEL, ASSET_SIZES } from "@/lib/clientAssets";

export type AssetFormValue = { name: string; size: AssetSize | ""; detail: string };

export const EMPTY_ASSET: AssetFormValue = { name: "", size: "", detail: "" };

/** Ficha do pet ou do veículo — usada no agendamento público e no manual do dono. */
export default function AssetFields({
  kind,
  value,
  onChange,
  required = true,
}: {
  kind: AssetKind;
  value: AssetFormValue;
  onChange: (next: AssetFormValue) => void;
  /** No agendamento manual do dono a ficha é opcional. */
  required?: boolean;
}) {
  const fields = ASSET_FIELDS[kind];
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {fields.title}
      </Typography>
      <TextField
        label={fields.name}
        size="small"
        required={required}
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        inputProps={{ maxLength: 60 }}
      />
      <TextField
        label={fields.detail}
        size="small"
        placeholder={fields.detailPlaceholder}
        value={value.detail}
        onChange={(e) => onChange({ ...value, detail: e.target.value })}
        inputProps={{ maxLength: 40 }}
      />
      <TextField
        select
        label="Porte"
        size="small"
        required={required}
        value={value.size}
        onChange={(e) => onChange({ ...value, size: e.target.value as AssetSize })}
        helperText="O valor do serviço muda conforme o porte."
      >
        {ASSET_SIZES.map((size) => (
          <MenuItem key={size} value={size}>
            {ASSET_SIZE_LABEL[kind][size]}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
