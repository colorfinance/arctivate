/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Capacitor mobile builds
  // Set NEXT_PUBLIC_CAPACITOR=true to enable static export
  ...(process.env.NEXT_PUBLIC_CAPACITOR === 'true' ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  // Trailing slashes help with static file routing in Capacitor
  trailingSlash: true,
}

module.exports = nextConfig
