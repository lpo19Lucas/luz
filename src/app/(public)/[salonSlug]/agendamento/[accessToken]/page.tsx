// Página de gestão de um agendamento específico, acessada só pelo link
// único do WhatsApp (spec seção 8.6/8.7). Sem login — o accessToken na URL
// é a autenticação. Ações: cancelar, confirmar presença.
import ManageClient from "./ManageClient";

export default async function ManageAppointmentPage({
  params,
}: {
  params: Promise<{ salonSlug: string; accessToken: string }>;
}) {
  const { accessToken } = await params;
  return <ManageClient accessToken={accessToken} />;
}
