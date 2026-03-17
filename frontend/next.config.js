/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    domains: ["image.tmdb.org"],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://backend:8000"}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
