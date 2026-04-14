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
};

module.exports = nextConfig;
