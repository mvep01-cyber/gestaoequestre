export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host"))
    ?.split(",")[0]
    .trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = (forwardedProtocol ?? new URL(request.url).protocol.replace(":", ""))
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (!origin || !host || (protocol !== "http" && protocol !== "https")) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    const requestHost = new URL(`${protocol}://${host}`).host.toLowerCase();
    return originUrl.protocol === `${protocol}:` && originUrl.host.toLowerCase() === requestHost;
  } catch {
    return false;
  }
}
