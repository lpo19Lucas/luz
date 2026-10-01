/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Capa do salão (F3) vai como data URL no body da server action —
    // já redimensionada no navegador, mas ainda passa dos 1MB padrão do
    // Next pra uma imagem JPEG de até 1280px.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

module.exports = nextConfig;
