// Página pública de agendamento self-service (spec seção 8.4).
// Referência visual: mui-exemplos.html (Exemplo 1), paleta Classic Navy & Gold.
import BookingClient from "./BookingClient";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ salonSlug: string }>;
}) {
  const { salonSlug } = await params;
  return <BookingClient salonSlug={salonSlug} />;
}
