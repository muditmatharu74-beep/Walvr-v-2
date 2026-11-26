// Checkout returns must use trusted deployment configuration, never a client
// Origin or Host header. Preview sessions stay on the deployment they tested.
export function checkoutOrigin(): string {
  if (process.env.VERCEL_ENV === "preview") {
    const hostname = process.env.VERCEL_URL;
    if (!hostname || !/^[a-z0-9-]+\.vercel\.app$/i.test(hostname)) {
      throw new Error("Preview checkout deployment URL is missing or invalid");
    }
    return `https://${hostname}`;
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new Error("Checkout app URL is missing");
  const url = new URL(configured);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new Error("Checkout app URL is invalid");
  }
  return url.origin;
}
