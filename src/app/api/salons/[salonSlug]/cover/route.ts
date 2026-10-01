import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/salons/:salonSlug/cover
 *
 * Serve a capa do salão (F3) a partir de `Salon.coverImageData` (data URL
 * JPEG, redimensionada no navegador — ver src/lib/imageResize.ts). Guardar
 * a imagem como binário na resposta em vez de embutir a data URL inteira no
 * HTML da página pública deixa o documento mais leve e permite cache no
 * navegador/CDN, usando `coverImageUpdatedAt` pra invalidar.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ salonSlug: string }> }
) {
  const { salonSlug } = await params;
  const salon = await prisma.salon.findUnique({
    where: { slug: salonSlug },
    select: { coverImageData: true, coverImageUpdatedAt: true },
  });

  if (!salon?.coverImageData) {
    return NextResponse.json({ error: "Sem capa" }, { status: 404 });
  }

  const match = salon.coverImageData.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Capa inválida" }, { status: 500 });
  }
  const [, contentType, base64] = match;

  return new NextResponse(Buffer.from(base64, "base64"), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
