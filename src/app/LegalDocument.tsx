// Layout comum dos documentos jurídicos (/termos, /privacidade, /contrato).
import { Box, Typography, Stack } from "@mui/material";
import Link from "next/link";
import { LEGAL_VERSION_LABEL, type LegalSection } from "@/lib/legal";

const DOCS = [
  { href: "/termos", label: "Termos de Uso" },
  { href: "/privacidade", label: "Política de Privacidade" },
  { href: "/contrato", label: "Contrato de Licença" },
];

export default function LegalDocument({
  title,
  intro,
  sections,
  current,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
  current: string;
}) {
  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh", py: { xs: 4, md: 7 } }}>
      <Box component="article" sx={{ maxWidth: 760, mx: "auto", px: 2.5 }}>
        <Typography
          component={Link}
          href="/"
          sx={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "primary.main", textDecoration: "none" }}
        >
          Luz
        </Typography>

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 3, mb: 4 }}>
          {DOCS.map((doc) => (
            <Box
              key={doc.href}
              component={Link}
              href={doc.href}
              aria-current={doc.href === current ? "page" : undefined}
              sx={{
                px: 1.75,
                py: 0.75,
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                border: "1px solid",
                borderColor: doc.href === current ? "primary.main" : "divider",
                bgcolor: doc.href === current ? "primary.main" : "transparent",
                color: doc.href === current ? "#FAF7F2" : "text.primary",
              }}
            >
              {doc.label}
            </Box>
          ))}
        </Stack>

        <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: 28, md: 34 } }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          Versão de {LEGAL_VERSION_LABEL}
        </Typography>
        <Typography sx={{ lineHeight: 1.7, mb: 4 }}>{intro}</Typography>

        {sections.map((section, i) => (
          <Box component="section" key={section.title} sx={{ mb: 3.5 }}>
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: 18, mb: 1.25 }}>
              {i + 1}. {section.title}
            </Typography>
            {section.paragraphs.map((p, j) => (
              <Typography key={j} sx={{ lineHeight: 1.7, mb: 1.25, color: "text.secondary", fontSize: 15 }}>
                {p}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
