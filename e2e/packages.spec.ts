import { test, expect } from "@playwright/test";
import { signupSalon, createService, createProfessionalFullWeek, publishSalon } from "./helpers";

test("dono cria pacote, cliente reserva pelo link público, dono confirma pagamento", async ({ page }) => {
  await signupSalon(page, "pacotes");
  await createService(page, { name: "Corte", durationMinutes: 30, priceReais: 50 });
  await createProfessionalFullWeek(page, { name: "Barbeiro", serviceName: "Corte" });
  const slug = await publishSalon(page);

  // Dono cria o pacote.
  await page.goto("/pacotes");
  await page.getByLabel("Nome").fill("4 cortes no mês");
  // MUI Select renderiza um <div role="combobox">, não um <select> nativo.
  await page.getByLabel("Serviço (se for créditos por serviço)").click();
  await page.getByRole("option", { name: "Corte" }).click();
  await page.getByLabel("Créditos (se por serviço)").fill("4");
  await page.getByLabel("Preço de venda (R$)").fill("150");
  await page.getByLabel("Validade (dias)").fill("30");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("4 cortes no mês")).toBeVisible();

  // Cliente (mesma aba, agora navegando pro link público — não precisa de sessão) reserva.
  const clientPhone = `1199988${String(Date.now()).slice(-4)}`;
  await page.goto(`/${slug}`);
  await expect(page.getByText("Pacotes", { exact: true })).toBeVisible();
  const packageCard = page.locator("form", { has: page.locator('input[name="packageDefinitionId"]') });
  await packageCard.getByLabel("Nome").fill("Cliente Pacote");
  await packageCard.getByLabel("Telefone").fill(clientPhone);
  await packageCard.getByRole("button", { name: "Reservar" }).click();
  await page.waitForURL(`**/${slug}?pacoteReservado=1`);

  // Dono confirma o pagamento em /clientes/[id].
  await page.goto("/clientes");
  await page.getByRole("link", { name: "Cliente Pacote" }).click();
  await page.waitForURL(/\/clientes\/[^/]+$/, { timeout: 60_000 }); // dev compila a rota na primeira visita
  await expect(page.getByText("Aguardando pagamento")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar pagamento" }).click();
  await expect(page.getByText("Ativo")).toBeVisible();
  await expect(page.getByText("4 crédito(s) restante(s)")).toBeVisible();
});
