import { test } from "@playwright/test";

// As páginas em src/app/(public) e src/app/(dashboard) ainda são placeholders
// (`return null` — ver README.md). Esses testes descrevem o fluxo alvo e ficam
// `skip` até a UI existir de verdade, pra não reportar falso-positivo/negativo.
// Tirar o `.skip` conforme cada tela for implementada (ver mui-exemplos.html
// pra referência visual de cada uma).

test.describe("fluxo de agendamento self-service (spec seção 8.4)", () => {
  test.skip("cliente agenda um horário disponível", async ({ page }) => {
    await page.goto("/salao-exemplo");
    await page.getByRole("button", { name: /agendar/i }).click();
    // profissional -> serviço -> dia -> horário -> dados -> confirmar
  });
});

test.describe("gestão de agendamento via link único (spec seção 8.6/8.7)", () => {
  test.skip("cliente cancela o próprio agendamento pelo token", async ({ page }) => {
    await page.goto("/salao-exemplo/agendamento/algum-access-token");
    await page.getByRole("button", { name: /cancelar/i }).click();
  });

  test.skip("cliente confirma presença pelo token", async ({ page }) => {
    await page.goto("/salao-exemplo/agendamento/algum-access-token");
    await page.getByRole("button", { name: /confirmar presença/i }).click();
  });
});

test.describe("agenda do dono (spec 8.10, P0.13)", () => {
  test.skip("dono vê os agendamentos do dia por profissional", async ({ page }) => {
    await page.goto("/dashboard/agenda");
  });
});
