/**
 * Envio de e-mail transacional (recuperação de senha, por enquanto) pela API
 * HTTP do Resend — só `fetch`, sem SDK. Escolhido pelo plano grátis (3 mil
 * e-mails/mês) e por não exigir servidor SMTP.
 *
 * Sem RESEND_API_KEY configurada, não envia: registra no log do servidor e
 * devolve `delivered: false`. Nesse modo o dono recupera o acesso por um link
 * gerado no painel admin (/admin/saloes/:id) e enviado manualmente.
 */

export type EmailMessage = { to: string; subject: string; html: string; text: string };

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function fromAddress() {
  return process.env.EMAIL_FROM?.trim() || "DLJ Innovations <onboarding@resend.dev>";
}

export async function sendEmail(message: EmailMessage): Promise<{ delivered: boolean }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    // Não loga o corpo (tem o link com token) — só o suficiente pra depurar.
    console.info(`[email] RESEND_API_KEY ausente — e-mail "${message.subject}" para ${message.to} não foi enviado.`);
    return { delivered: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress(), to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    if (!res.ok) {
      console.error(`[email] Resend respondeu ${res.status}: ${await res.text().catch(() => "")}`);
      return { delivered: false };
    }
    return { delivered: true };
  } catch (err) {
    console.error("[email] falha ao chamar o Resend", err);
    return { delivered: false };
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function passwordResetEmail(params: { name: string; link: string; expiresInLabel: string }): Omit<EmailMessage, "to"> {
  const name = escapeHtml(params.name.split(" ")[0] || params.name);
  return {
    subject: "Redefinir sua senha da DLJ Innovations",
    text: `Olá, ${params.name}!\n\nRecebemos um pedido para redefinir a senha da sua conta na DLJ Innovations. Para criar uma nova senha, acesse:\n\n${params.link}\n\nO link vale por ${params.expiresInLabel} e só pode ser usado uma vez. Se não foi você, ignore este e-mail — sua senha continua a mesma.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0A1730">
<h2 style="margin-bottom:8px">Redefinir senha</h2>
<p>Olá, ${name}! Recebemos um pedido para redefinir a senha da sua conta na DLJ Innovations.</p>
<p style="margin:28px 0"><a href="${escapeHtml(params.link)}" style="background:#D4AF37;color:#0A1730;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Criar nova senha</a></p>
<p style="font-size:13px;color:#555">O link vale por ${escapeHtml(params.expiresInLabel)} e só pode ser usado uma vez. Se não foi você, ignore este e-mail — sua senha continua a mesma.</p>
</div>`,
  };
}
