import { NextRequest, NextResponse } from "next/server";
import { getStoredImage } from "@/lib/storedImages";

/**
 * GET /api/images/:id
 *
 * Serve fotos de profissional/serviço (tabela stored_images). São imagens
 * públicas (aparecem na página do salão) e imutáveis — trocar a foto gera um
 * id novo —, então o cache pode ser longo e "immutable".
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = await getStoredImage(id);
  if (!image) {
    return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
