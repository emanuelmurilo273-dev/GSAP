/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs", "nodemailer"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
      // Bibliotecas e modelos 3D públicos (licenças MIT/CC0) usados pelos sites publicados, que rodam
      // em origem isolada: precisam de CORS para o WebGL usar as texturas.
      ...["/vendor/:path*", "/models/:path*"].map((source) => ({
        source,
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Cache-Control", value: "public, max-age=604800" },
        ],
      })),
    ];
  },
};
export default nextConfig;
