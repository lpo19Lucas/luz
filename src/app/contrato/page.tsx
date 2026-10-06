import type { Metadata } from "next";
import LegalDocument from "../LegalDocument";
import { licenseAgreement } from "@/lib/legalTexts";

export const metadata: Metadata = { title: "Contrato de Licença de Uso" };

export default function Page() {
  const doc = licenseAgreement();
  return <LegalDocument {...doc} current="/contrato" />;
}
