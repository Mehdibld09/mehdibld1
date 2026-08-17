import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const BUILTIN_BAD_WORDS = [
  "fuck", "f.u.c.k", "f**k", "fuk", "fvck",
  "shit", "sh1t", "sh!t",
  "asshole", "a**hole",
  "bitch", "b1tch", "b!tch", "btch",
  "bastard",
  "cunt", "c**t",
  "dick", "d1ck", "d!ck",
  "cock", "c0ck",
  "pussy",
  "prick",
  "slut", "sl*t",
  "whore", "wh0re",
  "nigger", "n1gger",
  "nigga",
  "faggot", "f*ggot",
  "retard", "ret*rd",
  "motherfucker", "motherf**ker",
  "bullshit", "bulls**t",
  "dumbass",
  "jackass",
  "dipshit",
  "douchebag",
  "wanker", "w*nker",
  "tosser",
  "twat",
  "arsehole",
  "shithead",
  "fucker",
  "pornhub", "p0rn",
  "xxx",
  "nudes",
  "s3x",
];

const SCAM_DOMAINS = [
  "bit\\.ly", "tinyurl\\.com", "t\\.co", "goo\\.gl", "ow\\.ly", "buff\\.ly",
  "adf\\.ly", "bc\\.vc", "j\\.mp", "cutt\\.ly", "shorturl\\.at",
  "steamcommunity\\-gift\\.com", "steam-gift\\.com", "steamgifts?\\.ru",
  "steam-wallet\\.com", "steamwallet\\.",
  "free-steam\\.", "freesteam\\.", "steamfree\\.",
  "free-robux\\.", "freerobux\\.",
  "discord\\.gift", "discordapp\\.gift", "discordnitro\\.",
  "nitro-discord\\.", "discord-nitro\\.",
  "crypto\\-giveaway\\.", "btc-free\\.", "bitcoin-giveaway\\.",
  "csgo-free\\.", "csgofree\\.", "cs-go-skins\\.",
  "verify-human\\.", "human-verification\\.",
  "getfreegames\\.", "freegame\\.",
  "account-verify\\.", "verify-account\\.",
  "survey-bypass\\.", "human-verify\\.",
];

const SUSPICIOUS_TLDS = /https?:\/\/[^\s]*\.(xyz|tk|ml|ga|cf|gq|top|click|work|link|win|bid|loan|accountant|stream|download|racing|party|review|trade|webcam|science|country|faith|men|date|cricket|space|press|website|site|fun|online|shop|store|live|icu|buzz|club|vip|pro|world|network|digital|media|solutions|today|news|info|biz|mobi)(\/[^\s]*)?/gi;

const URL_WITH_SCAM_DOMAIN = new RegExp(
  `https?:\\/\\/[^\\s]*(${SCAM_DOMAINS.join("|")})[^\\s]*`,
  "gi",
);

const IP_URL = /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}[^\s]*/gi;

function buildBadWordRegex(words: string[]): RegExp {
  const escaped = words
    .filter((w) => w.trim().length > 0)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escaped.length === 0) return /(?!)/;
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
}

let cachedCustomWords: string[] = [];
let cacheExpiry = 0;

async function getCustomWords(): Promise<string[]> {
  if (Date.now() < cacheExpiry) return cachedCustomWords;
  try {
    const [row] = await db
      .select()
      .from(siteSettingsTable)
      .where(eq(siteSettingsTable.key, "banned_words"));
    cachedCustomWords = row ? JSON.parse(row.value || "[]") : [];
  } catch {
    cachedCustomWords = [];
  }
  cacheExpiry = Date.now() + 60_000;
  return cachedCustomWords;
}

export function invalidateWordCache() {
  cacheExpiry = 0;
}

export async function filterContent(text: string): Promise<string> {
  if (!text) return text;

  let filtered = text;

  filtered = filtered.replace(URL_WITH_SCAM_DOMAIN, "[***]");
  filtered = filtered.replace(SUSPICIOUS_TLDS, "[***]");
  filtered = filtered.replace(IP_URL, "[***]");

  const customWords = await getCustomWords();
  const allWords = [...BUILTIN_BAD_WORDS, ...customWords];
  const regex = buildBadWordRegex(allWords);
  filtered = filtered.replace(regex, "[***]");

  return filtered;
}
