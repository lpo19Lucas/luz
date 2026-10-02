import { Page, expect } from "@playwright/test";

/**
 * Infra de e2e nunca foi exercitada de verdade neste projeto (todos os specs
 * antigos eram `test.skip`) — não existe seed de e2e, então cada spec sobe um
 * salão do zero pela própria UI (cadastro -> serviço -> profissional -> publicar).
 */
export async function signupSalon(page: Page, label: string) {
  const unique = `${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const email = `${unique}@teste.com`;
  const password = "senha123";
  const salonName = `Salão E2E ${unique}`;

  await page.goto("/cadastro");
  await page.getByLabel("Nome do salão").fill(salonName);
  await page.getByLabel("Seu nome").fill("Dono Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await page.waitForURL("**/inicio");

  return { email, password, salonName };
}

export async function createService(page: Page, params: { name: string; durationMinutes: number; priceReais: number }) {
  await page.goto("/servicos");
  await page.getByLabel("Nome").fill(params.name);
  await page.getByLabel("Duração (min)").fill(String(params.durationMinutes));
  await page.getByLabel("Preço (R$)").fill(String(params.priceReais));
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText(params.name)).toBeVisible();
}

/** Profissional com disponibilidade o dia inteiro em todos os dias (igual ao
 * `createTestSalon` dos testes de integração) — evita que o teste e2e dependa
 * de bater com a grade de horário certa. */
export async function createProfessionalFullWeek(page: Page, params: { name: string; serviceName: string }) {
  await page.goto("/profissionais");
  await page.getByLabel("Nome").fill(params.name);
  for (let weekday = 0; weekday <= 6; weekday++) {
    await page.locator(`input[name="avail_${weekday}_start"]`).fill("00:00");
    await page.locator(`input[name="avail_${weekday}_end"]`).fill("23:30");
  }
  await page.getByRole("checkbox", { name: params.serviceName }).check();
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText(params.name)).toBeVisible();
}

/** Publica o salão (F12) e devolve o slug, extraído do link público exibido em /inicio. */
export async function publishSalon(page: Page) {
  await page.goto("/inicio");
  await page.getByRole("button", { name: "Publicar meu link" }).click();
  await expect(page.getByText("Seu link já está publicado e aberto pra clientes.")).toBeVisible();

  const href = await page.locator('a[href*="/"]', { hasText: /localhost|http/ }).first().getAttribute("href");
  if (!href) throw new Error("Link público não encontrado em /inicio");
  const slug = new URL(href).pathname.replace(/^\//, "");
  return slug;
}
