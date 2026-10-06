import { NextResponse } from "next/server";
import { buildOwnerManifest } from "@/lib/pwa";

/** GET /app.webmanifest — app instalável do dono/profissional (abre na /agenda). */
export function GET() {
  return NextResponse.json(buildOwnerManifest(), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
