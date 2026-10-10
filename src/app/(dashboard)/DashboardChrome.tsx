"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import InstallAppPrompt from "../InstallAppPrompt";
import EnableNotifications from "../EnableNotifications";
import {
  Box,
  Typography,
  Stack,
  Button,
  Divider,
  Drawer,
  AppBar,
  Toolbar,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";

type NavItem = { href: string; label: string; icon: string };

const SIDEBAR_WIDTH = 240;

/** Fase G — barra lateral do dashboard virou componente de cliente pra
 * poder colapsar num Drawer com hambúrguer no mobile (antes era sempre
 * visível, mesmo em telas pequenas). Server actions (ex. logoutAction)
 * continuam vindo de fora como prop — funcionam normalmente num form
 * dentro de um client component. */
export default function DashboardChrome({
  salonName,
  salonSlug,
  supportPhone,
  supportHref,
  logoutAction,
  banners,
  navItems,
  children,
}: {
  salonName: string;
  salonSlug: string;
  supportPhone?: string | null;
  supportHref?: string | null;
  logoutAction: (formData: FormData) => void | Promise<void>;
  banners?: React.ReactNode;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const navContent = (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        minHeight: "100%",
        bgcolor: "primary.main",
        color: "#FAF7F2",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ p: 2.5, pb: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box component="img" src="/dlj-icon-192.png" alt="" width={34} height={34} sx={{ borderRadius: "10px", flexShrink: 0 }} />
        <Typography variant="body1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
          {salonName}
        </Typography>
      </Box>

      <Stack component="ul" sx={{ listStyle: "none", m: 0, p: "6px 10px", flexGrow: 1, gap: 0.25 }}>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Box component="li" key={item.href}>
              <Typography
                component={Link}
                href={item.href}
                onClick={() => setOpen(false)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  color: active ? "#3AA6FF" : "#C3CAE0",
                  textDecoration: "none",
                  fontSize: 13.5,
                  fontWeight: active ? 700 : 500,
                  px: 1.5,
                  py: 1.1,
                  borderRadius: "10px",
                  bgcolor: active ? "rgba(58,166,255,.16)" : "transparent",
                  transition: "background .15s ease, color .15s ease",
                  "&:hover": { bgcolor: active ? "rgba(58,166,255,.16)" : "rgba(255,255,255,0.06)" },
                }}
              >
                <Box component="span" sx={{ width: 18, textAlign: "center", flexShrink: 0 }}>
                  {item.icon}
                </Box>
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Stack>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />
      <Box sx={{ p: 1.5 }}>
        <InstallAppPrompt appName="DLJ Innovations" variant="sidebar" />
        <EnableNotifications variant="sidebar" />
        <Typography
          component={Link}
          href={`/${salonSlug}`}
          sx={{ display: "block", color: "#3AA6FF", textDecoration: "none", fontSize: 13, px: 1, py: 1 }}
        >
          Ver site público ↗
        </Typography>
        {supportPhone && supportHref && (
          <Typography
            component="a"
            href={supportHref}
            target="_blank"
            rel="noreferrer"
            sx={{ display: "block", color: "#C3CAE0", textDecoration: "none", fontSize: 13, px: 1, py: 1 }}
          >
            Falar com o suporte
          </Typography>
        )}
        <Box component="form" action={logoutAction}>
          <Button type="submit" size="small" fullWidth sx={{ color: "#C3CAE0", justifyContent: "flex-start", px: 1 }}>
            Sair
          </Button>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex" }}>
      {isMobile ? (
        <>
          <AppBar
            position="fixed"
            elevation={0}
            sx={{ bgcolor: "primary.main", backgroundImage: "linear-gradient(135deg,#071126,#16346A)" }}
          >
            <Toolbar sx={{ gap: 1.5 }}>
              <IconButton
                edge="start"
                onClick={() => setOpen(true)}
                sx={{ color: "#FAF7F2", fontSize: 20 }}
                aria-label="Abrir menu"
              >
                ☰
              </IconButton>
              <Typography variant="body1" sx={{ color: "#FAF7F2", fontWeight: 600 }}>
                {salonName}
              </Typography>
            </Toolbar>
          </AppBar>
          <Drawer open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { bgcolor: "primary.main" } }}>
            <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
              <IconButton onClick={() => setOpen(false)} sx={{ color: "#FAF7F2", fontSize: 18 }} aria-label="Fechar menu">
                ✕
              </IconButton>
            </Box>
            {navContent}
          </Drawer>
        </>
      ) : (
        <Box
          component="nav"
          sx={{ flexShrink: 0, minHeight: "100vh", position: "sticky", top: 0, alignSelf: "flex-start" }}
        >
          {navContent}
        </Box>
      )}

      <Box sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, sm: 3 }, pt: { xs: 9, md: 3 }, maxWidth: 1100 }}>
        {banners}
        {children}
      </Box>
    </Box>
  );
}
