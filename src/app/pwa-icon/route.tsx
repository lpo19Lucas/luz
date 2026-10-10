import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { iconColors, iconInitial } from "@/lib/pwa";

/**
 * GET /pwa-icon?salon=<slug> (sem salon: redireciona pro emblema da plataforma)&size=192|512[&maskable=1]
 *
 * Ícone dos apps instaláveis, gerado na hora: a inicial do nome sobre a cor
 * do salão (ou o navy/dourado da DLJ Innovations) — o dono não precisa enviar logo.
 * "maskable" deixa margem de segurança (Android recorta em círculo/squircle).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const size = params.get("size") === "512" ? 512 : 192;
  const maskable = params.get("maskable") === "1";
  const slug = params.get("salon");

  // App da plataforma (sem negócio): o emblema oficial da DLJ Innovations.
  if (!slug) {
    const file = maskable ? "/dlj-icon-maskable-512.png" : size === 512 ? "/dlj-icon-512.png" : "/dlj-icon-192.png";
    return NextResponse.redirect(new URL(file, req.url), { status: 308, headers: { "Cache-Control": "public, max-age=86400" } });
  }

  let name = "DLJ Innovations";
  let colors = iconColors(null, null);
  if (slug) {
    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { name: true, primaryColor: true, accentColor: true },
    });
    if (salon) {
      name = salon.name;
      colors = iconColors(salon.primaryColor, salon.accentColor);
    }
  }

  const fontSize = Math.round(size * (maskable ? 0.42 : 0.56));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.background,
          color: colors.foreground,
          fontSize,
          fontWeight: 700,
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        {iconInitial(name)}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
