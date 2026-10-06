/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Capa do salão (F3) vai como data URL no body da server action —
    // já redimensionada no navegador, mas ainda passa dos 1MB padrão do
    // Next pra uma imagem JPEG de até 1280px.
    serverActions: { bodySizeLimit: "3mb" },
  },
  // PWA: o navegador precisa sempre buscar o service worker novo (senão uma
  // correção no sw.js demora até 24h pra chegar nos aparelhos).
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
