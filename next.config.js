/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use static export for Capacitor/CI builds, but NOT on Vercel
  // so that API routes (/api/auth, /api/coach, etc.) work as serverless functions.
  // Vercel sets the VERCEL env var automatically.
  ...(process.env.VERCEL ? {} : { output: 'export' }),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
