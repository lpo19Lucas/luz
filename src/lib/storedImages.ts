import { prisma } from "@/lib/prisma";

/**
 * Fotos de profissional e de serviço (tabela stored_images). A imagem chega
 * do navegador já redimensionada (src/lib/imageResize.ts) como data URL; aqui
 * só valida tipo/tamanho e guarda os bytes. Cada troca cria um registro novo
 * e apaga o anterior — o id muda, então a URL muda e a rota de servir pode
 * usar cache "immutable" sem risco de mostrar foto velha.
 */

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Depois do redimensionamento (640px, JPEG 0.82) uma foto fica em ~50-150 KB;
// o limite é folgado mas impede guardar um arquivo enorme por engano.
export const MAX_IMAGE_BYTES = 1_500_000;

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function storedImageUrl(id: string | null | undefined) {
  return id ? `/api/images/${id}` : null;
}

export function parseImageDataUrl(dataUrl: string): { contentType: string; bytes: Buffer } {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !ALLOWED_TYPES.includes(match[1])) {
    throw new ImageError("Formato de imagem não suportado (use JPG, PNG ou WebP).");
  }
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) throw new ImageError("Imagem vazia.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new ImageError("Imagem grande demais.");
  return { contentType: match[1], bytes };
}

/**
 * Lê os campos do componente ImageUploadField: `imageData` (data URL nova,
 * vazio = não mexeu) e `removeImage` ("on" = tirar a foto).
 * Devolve undefined (manter), null (remover) ou a data URL nova.
 */
export function readImageField(formData: FormData): string | null | undefined {
  if (formData.get("removeImage") === "on") return null;
  const data = String(formData.get("imageData") ?? "").trim();
  return data ? data : undefined;
}

type Target = { kind: "professional" | "service"; id: string };

/**
 * Troca (ou remove, com `dataUrl` null) a foto de um profissional/serviço do
 * salão. Confere que o registro é do salão antes de mexer.
 */
export async function setEntityImage(salonId: string, target: Target, dataUrl: string | null) {
  const parsed = dataUrl ? parseImageDataUrl(dataUrl) : null;

  return prisma.$transaction(async (tx) => {
    const current =
      target.kind === "professional"
        ? await tx.professional.findFirst({ where: { id: target.id, salonId }, select: { photoImageId: true } })
        : await tx.service.findFirst({ where: { id: target.id, salonId }, select: { imageId: true } });
    if (!current) throw new ImageError("Registro não encontrado.");
    const oldId = "photoImageId" in current ? current.photoImageId : current.imageId;

    const created = parsed
      ? await tx.storedImage.create({ data: { salonId, contentType: parsed.contentType, data: parsed.bytes } })
      : null;
    const newId = created?.id ?? null;

    if (target.kind === "professional") {
      await tx.professional.update({ where: { id: target.id }, data: { photoImageId: newId } });
    } else {
      await tx.service.update({ where: { id: target.id }, data: { imageId: newId } });
    }
    if (oldId) await tx.storedImage.deleteMany({ where: { id: oldId, salonId } });
    return newId;
  });
}

/** Apaga a imagem de um registro que foi excluído (evita órfã). */
export async function deleteStoredImage(salonId: string, id: string | null | undefined) {
  if (id) await prisma.storedImage.deleteMany({ where: { id, salonId } });
}

export async function getStoredImage(id: string) {
  return prisma.storedImage.findUnique({ where: { id }, select: { contentType: true, data: true } });
}
