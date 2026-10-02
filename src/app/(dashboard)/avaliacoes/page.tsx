// Avaliações pós-atendimento (nota + comentário) — o dono pode ocultar da
// vitrine pública sem apagar o histórico.
import { Box, Typography, Paper, Stack, Rating, Button, Chip } from "@mui/material";
import { getCurrentSalon } from "@/lib/currentSalon";
import { getAllReviewsForOwner } from "@/lib/reviews";
import { toggleReviewVisibilityAction } from "@/lib/actions/review";
import { formatSalonDate } from "@/lib/timezone";

export default async function AvaliacoesPage() {
  const salon = await getCurrentSalon();
  const reviews = await getAllReviewsForOwner(salon.id);
  const visible = reviews.filter((r) => !r.hiddenByOwner);
  const average = visible.length > 0 ? visible.reduce((sum, r) => sum + r.rating, 0) / visible.length : null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 500 }}>
          {reviews.length} avaliação(ões)
        </Typography>
        {average !== null && (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Rating value={average} precision={0.1} readOnly size="small" />
            <Typography variant="body2" color="text.secondary">
              {average.toFixed(1)} de média ({visible.length} visíveis)
            </Typography>
          </Stack>
        )}
      </Stack>

      <Paper elevation={1}>
        {reviews.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            Nenhuma avaliação ainda.
          </Typography>
        )}
        {reviews.map((r) => (
          <Stack
            key={r.id}
            direction="row"
            alignItems="flex-start"
            spacing={1.5}
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Rating value={r.rating} readOnly size="small" />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {r.client.name}
                </Typography>
                {r.hiddenByOwner && <Chip label="Oculta" size="small" />}
              </Stack>
              {r.comment && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {r.comment}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {r.appointment.service.name} com {r.appointment.professional.name} ·{" "}
                {formatSalonDate(r.createdAt, { day: "2-digit", month: "2-digit", year: "numeric" })}
              </Typography>
            </Box>
            <form action={toggleReviewVisibilityAction}>
              <input type="hidden" name="id" value={r.id} />
              <Button type="submit" size="small">
                {r.hiddenByOwner ? "Reexibir" : "Ocultar"}
              </Button>
            </form>
          </Stack>
        ))}
      </Paper>
    </Box>
  );
}
