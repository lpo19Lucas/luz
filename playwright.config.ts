import { defineConfig } from "@playwright/test";

// O chromium baixado pelo Playwright não roda em Alpine (musl) — usamos o
// pacote `chromium` do apk (ver app/Dockerfile) via executablePath em vez de
// `npx playwright install`. Rodando dentro do container `app` (docker compose
// exec), http://localhost:3000 já é o próprio dev server (processo principal
// do container) — não precisa de `webServer` aqui.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  workers: 1, // os specs criam/usam estado via UI real — evita corrida entre eles
  // Next dev compila cada rota sob demanda na primeira visita — bem mais
  // lento que produção. Timeout maior evita falso negativo por isso.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
});
