import type { Metadata } from "next";
import LegalDocument from "../LegalDocument";
import { privacyPolicy } from "@/lib/legalTexts";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function Page() {
  const doc = privacyPolicy();
  return <LegalDocument {...doc} current="/privacidade" />;
}
