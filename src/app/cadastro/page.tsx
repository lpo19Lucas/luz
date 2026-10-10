import CadastroForm from "./CadastroForm";
import { getSegment, isSegmentSlug } from "@/lib/segments";

/** `?segmento=manicure` (vindo das páginas /para/[segmento]) já deixa o nicho escolhido. */
export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ segmento?: string }> }) {
  const { segmento } = await searchParams;
  const initial = isSegmentSlug(segmento) && getSegment(segmento).available ? segmento : undefined;
  return <CadastroForm initialSegment={initial} />;
}
