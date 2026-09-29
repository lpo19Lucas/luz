import { prisma } from "@/lib/prisma";

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Gera um slug único pro salão — acrescenta sufixo numérico se já existir. */
export async function generateUniqueSalonSlug(name: string) {
  const base = slugify(name) || "salao";
  let slug = base;
  let suffix = 1;
  while (await prisma.salon.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}
