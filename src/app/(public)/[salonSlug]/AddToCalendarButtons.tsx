"use client";

// "Adicionar à agenda" do cliente: Google Agenda (link preenchido) e .ics
// (iPhone, Outlook e outras). Os links vêm prontos da API
// (src/lib/calendarLinks.ts).
import { Box, Button, Stack, Typography } from "@mui/material";

export type CalendarLinks = { googleUrl: string; icsUrl: string };

export default function AddToCalendarButtons({ links, note }: { links: CalendarLinks; note?: string }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
        Adicionar à sua agenda
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button
          component="a"
          href={links.googleUrl}
          target="_blank"
          rel="noopener"
          variant="outlined"
          fullWidth
          sx={{ borderRadius: 2, py: 1.1 }}
        >
          Google Agenda
        </Button>
        <Button component="a" href={links.icsUrl} download="agendamento.ics" variant="outlined" fullWidth sx={{ borderRadius: 2, py: 1.1 }}>
          iPhone / Outlook (.ics)
        </Button>
      </Stack>
      {note && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          {note}
        </Typography>
      )}
    </Box>
  );
}
