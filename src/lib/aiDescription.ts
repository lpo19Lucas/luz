/**
 * F15 (AEO com IA): gera descrição + FAQ do salão via Vercel AI Gateway, a
 * partir do nome, serviços e profissionais já cadastrados — o dono sempre
 * pode editar depois. Sem AI_GATEWAY_API_KEY configurada, a feature fica
 * indisponível (ver isAiDescriptionAvailable).
 */
export function isAiDescriptionAvailable() {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
}

export interface GeneratedSalonCopy {
  description: string;
  faq: Array<{ q: string; a: string }>;
}

export async function generateSalonCopy(params: {
  salonName: string;
  serviceNames: string[];
  city: string | null;
}): Promise<GeneratedSalonCopy> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("AI_GATEWAY_API_KEY não configurada");

  const prompt = `Escreva, em português do Brasil, uma descrição curta (2-3 frases, tom
acolhedor e profissional, sem emojis) para a página pública de agendamento
de um salão/barbearia chamado "${params.salonName}"${params.city ? `, em ${params.city}` : ""}.
Os serviços oferecidos são: ${params.serviceNames.join(", ") || "não informado"}.
Depois, gere 3 perguntas frequentes (FAQ) curtas e genéricas que um cliente
faria antes de agendar, com respostas de 1 frase cada.

Responda só com um JSON no formato exato:
{"description": "...", "faq": [{"q": "...", "a": "..."}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}]}`;

  const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`AI Gateway respondeu ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta da IA sem conteúdo");

  const parsed = JSON.parse(content) as GeneratedSalonCopy;
  if (!parsed.description || !Array.isArray(parsed.faq)) {
    throw new Error("Resposta da IA em formato inesperado");
  }
  return parsed;
}
