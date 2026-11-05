/** Pure policy shared by server guards and negative security tests. */
export function localDemoAllowed(
  request: Request,
  env: Record<string, string | undefined>,
  developmentBuild: boolean,
) {
  if (
    !developmentBuild ||
    env.NODE_ENV === "production" ||
    env.LAUNCHPAD_LOCAL_PREVIEW !== "true" ||
    env.VERCEL ||
    env.NETLIFY ||
    env.CF_PAGES
  )
    return false;
  if (
    env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:3302" ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== "synthetic-preview-publishable"
  )
    return false;
  if (
    env.META_API_ENABLED !== "false" ||
    env.NOTIFICATIONS_ENABLED !== "false" ||
    env.SMS_ENABLED !== "false"
  )
    return false;
  try {
    const url = new URL(request.url),
      host = new URL("http://" + request.headers.get("host"));
    const loopback = (u: URL) =>
      u.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) &&
      u.port === "3301";
    return loopback(url) && loopback(host);
  } catch {
    return false;
  }
}
export function localDemoSameOrigin(request: Request) {
  if (
    ["cross-site", "none"].includes(request.headers.get("sec-fetch-site") ?? "")
  )
    return false;
  return (
    request.headers.get("origin") === `http://${request.headers.get("host")}`
  );
}
