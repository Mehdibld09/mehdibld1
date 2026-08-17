// IP ban + VPN detection utilities

// In-memory cache so we don't hammer ip-api.com (45 req/min limit)
const vpnCache = new Map<string, { isVpn: boolean; checkedAt: number }>();
const VPN_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// IPs that should never be blocked (local/Replit internal)
function isLocalIp(ip: string): boolean {
  return (
    ip === "unknown" ||
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.") ||
    ip.startsWith("::ffff:127.")
  );
}

export async function isVpnOrProxy(ip: string): Promise<boolean> {
  if (isLocalIp(ip)) return false;

  const cached = vpnCache.get(ip);
  if (cached && Date.now() - cached.checkedAt < VPN_CACHE_TTL_MS) {
    return cached.isVpn;
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,proxy,hosting`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return false;
    const data = await res.json() as { status: string; proxy?: boolean; hosting?: boolean };
    if (data.status !== "success") return false;
    const isVpn = !!(data.proxy || data.hosting);
    vpnCache.set(ip, { isVpn, checkedAt: Date.now() });
    return isVpn;
  } catch {
    // If check fails (timeout / rate limit), allow through — don't block legit users
    return false;
  }
}
