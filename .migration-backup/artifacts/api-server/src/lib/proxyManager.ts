// @ts-nocheck
import { SocksProxyAgent } from "socks-proxy-agent";
import { logger } from "./logger";

const PROXY_SOURCES: Array<{ url: string; protocol: "socks4" | "socks5" }> = [
  { url: "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt", protocol: "socks4" },
  { url: "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt", protocol: "socks5" },
];

// Refresh once per day — these lists are updated daily
const PROXY_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface Proxy {
  host: string;
  port: number;
  url: string;
}

let cachedProxies: Proxy[] = [];
let lastFetchTime = 0;

/**
 * Fetch and parse a single proxy list URL.
 */
async function fetchOneList(url: string, protocol: "socks4" | "socks5"): Promise<Proxy[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      logger.warn({ status: res.status, url }, "Failed to fetch proxy list");
      return [];
    }
    const text = await res.text();
    const proxies: Proxy[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const parts = trimmed.split(":");
      if (parts.length === 2) {
        const host = parts[0].trim();
        const port = parseInt(parts[1].trim(), 10);
        if (host && port > 0 && port < 65536) {
          proxies.push({ host, port, url: `${protocol}://${host}:${port}` });
        }
      }
    }
    logger.info({ count: proxies.length, protocol, url }, "Fetched proxy list");
    return proxies;
  } catch (e) {
    logger.warn({ err: e, url }, "Error fetching proxy list");
    return [];
  }
}

/**
 * Fetch both SOCKS4 and SOCKS5 proxy lists and merge them.
 */
async function fetchProxyList(): Promise<Proxy[]> {
  const results = await Promise.all(
    PROXY_SOURCES.map((s) => fetchOneList(s.url, s.protocol)),
  );
  const all = results.flat();
  logger.info({ total: all.length }, "Total proxies loaded (socks4 + socks5)");
  return all;
}

/**
 * Get the current proxy list, fetching if stale or empty.
 */
async function getProxies(): Promise<Proxy[]> {
  const now = Date.now();
  if (cachedProxies.length === 0 || now - lastFetchTime > PROXY_REFRESH_INTERVAL_MS) {
    const fresh = await fetchProxyList();
    if (fresh.length > 0) {
      cachedProxies = fresh;
      lastFetchTime = now;
    } else if (cachedProxies.length === 0) {
      logger.warn("No proxies available and no cached fallback");
    }
  }
  return cachedProxies;
}

/**
 * Shuffle an array in-place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick a random subset of N proxies from the list, shuffled.
 */
export async function pickProxies(count: number = 3): Promise<Proxy[]> {
  const all = await getProxies();
  if (all.length === 0) return [];
  const shuffled = shuffle(all);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Create a fetch agent from a proxy.
 * If proxy is null, returns undefined (no proxy).
 */
export function proxyAgent(proxy: Proxy | null): SocksProxyAgent | undefined {
  if (!proxy) return undefined;
  return new SocksProxyAgent(proxy.url);
}

/**
 * Fetch through a proxy with the given proxy.
 * Returns null on proxy failure so the caller can retry with the next proxy.
 */
export async function fetchViaProxy(
  url: string,
  init: RequestInit,
  proxy: Proxy | null,
): Promise<Response | null> {
  const agent = proxyAgent(proxy);
  try {
    const res = await fetch(url, {
      ...init,
      agent: agent as any,
      signal: init.signal || AbortSignal.timeout(15_000),
    });
    return res;
  } catch (e) {
    logger.warn({ err: e, proxy: proxy?.url, url }, "Proxy request failed");
    return null;
  }
}
