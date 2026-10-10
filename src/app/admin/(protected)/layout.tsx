import BrandLogo from "@/components/BrandLogo";
import { redirect } from "next/navigation";
import { AppBar, Toolbar, Typography, Box, Button } from "@mui/material";
import { getAdminSession } from "@/lib/auth";
import { adminLogoutAction } from "@/lib/actions/admin";
import AdminNav from "./AdminNav";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    redirect("/admin/login");
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ gap: 2, flexWrap: "wrap", py: { xs: 1, sm: 0 } }}>
          <Box sx={{ mr: 2 }}><BrandLogo size={30} nameSize={15} color="inherit" /></Box>
          <Typography variant="h6" sx={{ fontWeight: 600, mr: 2 }}>
            Admin
          </Typography>
          <AdminNav />
          <Box sx={{ flexGrow: 1 }} />
          <Box component="form" action={adminLogoutAction}>
            <Button type="submit" size="small" sx={{ color: "inherit" }}>
              Sair
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>{children}</Box>
    </Box>
  );
}
