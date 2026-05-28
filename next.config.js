/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // ESLint and TypeScript run as part of `next build` again. They were
  // previously suppressed; tsconfig + .eslintrc.json now keep the codebase
  // building cleanly. Run `npm run typecheck` and `npm run lint` locally.
  reactStrictMode: true,
  // Serve the static brand hub (public/brand/) at /brand. This is the only
  // route affected; the rest of the app is untouched.
  async rewrites() {
    return [
      { source: '/brand', destination: '/brand/index.html' },
      { source: '/brand/', destination: '/brand/index.html' },
    ];
  },
};

module.exports = nextConfig;
