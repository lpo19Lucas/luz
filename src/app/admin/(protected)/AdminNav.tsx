"use client";

import { Stack, Button } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Visão geral", exact: true },
  { href: "/admin/saloes", label: "Salões", exact: false },
  { href: "/admin/saloes/novo", label: "Novo salão", exact: true },
  { href: "/admin/planos", label: "Planos", exact: true },
];

export default function AdminNav() {
  const pathname = usePathname() ?? "";
  // "/admin/saloes/novo" também começa com "/admin/saloes" — o item mais
  // específico que casar ganha.
  const active = ITEMS.filter((i) => (i.exact ? pathname === i.href : pathname.startsWith(i.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
      {ITEMS.map((item) => (
        <Button
          key={item.href}
          component={Link}
          href={item.href}
          size="small"
          aria-current={active === item.href ? "page" : undefined}
          sx={{
            color: "inherit",
            opacity: active === item.href ? 1 : 0.75,
            borderBottom: "2px solid",
            borderColor: active === item.href ? "secondary.main" : "transparent",
            borderRadius: 0,
          }}
        >
          {item.label}
        </Button>
      ))}
    </Stack>
  );
}
