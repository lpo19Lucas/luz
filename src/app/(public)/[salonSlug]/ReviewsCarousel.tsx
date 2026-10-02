"use client";

import { useState } from "react";
import { Box, Typography, Rating, IconButton } from "@mui/material";

type ReviewItem = { id: string; rating: number; comment: string | null; clientName: string };

/** Carrossel de depoimentos (Fase G) — troca o item em destaque com setas e
 * bolinhas de navegação, no lugar da lista estática anterior. */
export default function ReviewsCarousel({ reviews }: { reviews: ReviewItem[] }) {
  const [index, setIndex] = useState(0);
  if (reviews.length === 0) return null;
  const current = reviews[index];

  function go(i: number) {
    setIndex((i + reviews.length) % reviews.length);
  }

  return (
    <Box
      sx={{
        bgcolor: "#fff",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 4,
        p: { xs: 3, sm: 5 },
        textAlign: "center",
        boxShadow: "0 20px 50px rgba(27,42,74,.08)",
      }}
    >
      <Rating value={current.rating} readOnly sx={{ color: "secondary.main", mb: 2 }} />
      {current.comment && (
        <Typography
          sx={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: { xs: 17, sm: 19 },
            lineHeight: 1.6,
            color: "#2A3658",
            mb: 2.5,
          }}
        >
          &ldquo;{current.comment}&rdquo;
        </Typography>
      )}
      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{current.clientName}</Typography>

      {reviews.length > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1.25, mt: 3.5 }}>
          <IconButton
            onClick={() => go(index - 1)}
            aria-label="Depoimento anterior"
            sx={{ bgcolor: "#F4EFE3", color: "primary.main", width: 38, height: 38 }}
          >
            ‹
          </IconButton>
          {reviews.map((r, i) => (
            <Box
              key={r.id}
              component="button"
              onClick={() => go(i)}
              aria-label={`Ir para depoimento ${i + 1}`}
              sx={{
                width: 9,
                height: 9,
                p: 0,
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                bgcolor: i === index ? "secondary.main" : "#E3D7B8",
              }}
            />
          ))}
          <IconButton
            onClick={() => go(index + 1)}
            aria-label="Próximo depoimento"
            sx={{ bgcolor: "#F4EFE3", color: "primary.main", width: 38, height: 38 }}
          >
            ›
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
