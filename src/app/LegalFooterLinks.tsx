// Links pros documentos jurídicos — rodapé da landing e da página do salão.
import { Box, Stack } from "@mui/material";
import Link from "next/link";

export default function LegalFooterLinks({ color = "text.secondary" }: { color?: string }) {
  return (
    <Stack direction="row" justifyContent="center" sx={{ flexWrap: "wrap", columnGap: 2, rowGap: 0.5 }}>
      {[
        { href: "/termos", label: "Termos de Uso" },
        { href: "/privacidade", label: "Privacidade" },
        { href: "/contrato", label: "Contrato" },
      ].map((l) => (
        <Box key={l.href} component={Link} href={l.href} sx={{ color, fontSize: 12.5, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
          {l.label}
        </Box>
      ))}
    </Stack>
  );
}
