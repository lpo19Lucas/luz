import { Box, Typography } from "@mui/material";
import { BRAND_NAME } from "@/lib/brand";

/** Emblema da DLJ Innovations (+ nome, opcional). Imagem em /public/dlj-icon-192.png. */
export default function BrandLogo({
  size = 32,
  showName = true,
  nameSize = 17,
  color = "text.primary",
}: {
  size?: number;
  showName?: boolean;
  nameSize?: number;
  color?: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <Box
        component="img"
        src="/dlj-icon-192.png"
        alt={showName ? "" : BRAND_NAME}
        width={size}
        height={size}
        sx={{ borderRadius: `${Math.round(size * 0.28)}px`, flexShrink: 0, display: "block" }}
      />
      {showName && (
        <Typography sx={{ fontWeight: 800, fontSize: nameSize, letterSpacing: ".01em", color, lineHeight: 1.1 }}>
          {BRAND_NAME}
        </Typography>
      )}
    </Box>
  );
}
