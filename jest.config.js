const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

// Dois "projetos" Jest, porque as duas suítes têm ambiente e propósito diferentes:
// - unit: componentes React (jsdom), nada de banco. Roda rápido, roda sempre.
// - integration: rotas de API contra o Postgres real do serviço `postgres_test`
//   do docker-compose. Não roda em jsdom, roda em node, precisa do banco de pé.
const commonConfig = {
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@tests/(.*)$": "<rootDir>/tests/$1",
  },
};

module.exports = async () => {
  const unitConfig = await createJestConfig({
    ...commonConfig,
    displayName: "unit",
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/", "\\.integration\\.test\\.ts$"],
  })();

  const integrationConfig = await createJestConfig({
    ...commonConfig,
    displayName: "integration",
    testEnvironment: "node",
    setupFiles: ["<rootDir>/tests/integration/env.ts"],
    testMatch: ["<rootDir>/**/*.integration.test.ts"],
    testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
  })();

  return { projects: [unitConfig, integrationConfig] };
};
