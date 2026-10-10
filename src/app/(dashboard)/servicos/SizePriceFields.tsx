import { Stack, TextField, Typography } from "@mui/material";
import type { AssetKind } from "@prisma/client";
import { ASSET_SIZES, ASSET_SIZE_LABEL, parseSizePrices } from "@/lib/clientAssets";

/**
 * Preço por porte (pet shop, lava-jato). Campo vazio = vale o preço base
 * acima. Lido por `readSizePrices` em src/lib/actions/service.ts.
 */
export default function SizePriceFields({ kind, current }: { kind: AssetKind; current?: unknown }) {
  const prices = parseSizePrices(current);
  return (
    <Stack spacing={1.25}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        Preço por porte (opcional)
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Deixe em branco o porte que cobra o preço base.
      </Typography>
      {ASSET_SIZES.map((size) => (
        <TextField
          key={size}
          name={`price_${size}`}
          label={`${ASSET_SIZE_LABEL[kind][size]} (R$)`}
          type="number"
          size="small"
          inputProps={{ step: "0.01", min: 0 }}
          defaultValue={prices[size] !== undefined ? (prices[size]! / 100).toFixed(2) : ""}
        />
      ))}
    </Stack>
  );
}
