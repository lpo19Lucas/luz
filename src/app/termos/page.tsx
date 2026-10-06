import type { Metadata } from "next";
import LegalDocument from "../LegalDocument";
import { termsOfUse } from "@/lib/legalTexts";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function Page() {
  const doc = termsOfUse();
  return <LegalDocument {...doc} current="/termos" />;
}
