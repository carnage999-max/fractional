export function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const explicitUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  const vercelUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
  }

  const renderUrl = process.env.URL;
  if (renderUrl) {
    return renderUrl;
  }

  return "http://localhost:3000";
}
