import type { NextConfig } from "next";

const PRODUCTION_URL = "https://pharma-quiz-app.vercel.app";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        destination: `${PRODUCTION_URL}/dashboard`,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
