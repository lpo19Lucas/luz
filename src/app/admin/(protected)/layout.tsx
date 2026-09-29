import { redirect } from "next/navigation";
import { AppBar, Toolbar, Typography, Box, Button } from "@mui/material";
import { getAdminSession } from "@/lib/auth";
import { adminLogoutAction } from "@/lib/actions/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    redirect("/admin/login");
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ gap: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 500, flexGrow: 1 }}>
            Administração da plataforma
          </Typography>
          <Box component="form" action={adminLogoutAction}>
            <Button type="submit" size="small" sx={{ color: "inherit" }}>
              Sair
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 3, maxWidth: 1000, mx: "auto" }}>{children}</Box>
    </Box>
  );
}
