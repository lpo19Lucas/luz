import { Button } from "@mui/material";
import { whatsappLink } from "@/lib/phone";

/**
 * F10: SAC — "Falar com o suporte" abre o WhatsApp do Lucas. Some por
 * inteiro se a env não estiver configurada (sem suporte nenhum é melhor que
 * um botão quebrado).
 */
export default function SupportButton() {
  const phone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  if (!phone) return null;

  return (
    <Button
      href={whatsappLink(phone, "Olá! Preciso de ajuda com a Luz.")}
      target="_blank"
      rel="noreferrer"
      variant="outlined"
      color="success"
      size="small"
    >
      Falar com o suporte
    </Button>
  );
}
