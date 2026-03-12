/**
 * API client that handles routing for both web and Capacitor mobile builds.
 *
 * On web (Vercel), API routes are relative (/api/...).
 * On mobile (Capacitor), API calls must go to the deployed backend URL.
 *
 * Set NEXT_PUBLIC_API_BASE_URL to your deployed Vercel URL for mobile builds,
 * e.g. NEXT_PUBLIC_API_BASE_URL=https://arctivate.vercel.app
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export function apiUrl(path) {
  // If path already starts with http, return as-is
  if (path.startsWith('http')) return path;
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
