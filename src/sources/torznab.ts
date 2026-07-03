import { getLoadedConfig, loadConfig, type TorznabEndpoint } from "../config/config";
import { torznabSearchUrl } from "../config/torznab";
import { fetchResilient, HttpError, USER_AGENT } from "../util/net";
import { buildMagnet, isInfoHash, normalizeInfoHash } from "./magnet";
import { unescapeEntities } from "./rss";
import { magnetFromTorrentBuffer } from "./torrentFile";
import type { ContentKind, SearchOptions, Source, TorrentResult } from "./types";

// How many magnet-less results (private/native feeds that only hand back a
// .torrent link) we'll fetch-and-parse per endpoint to recover an infohash.
// Bounded so a firehose of link-only results can't stall the whole search.
const RESOLVE_CAP = 25;

interface RawItem {
  name: string;
  sizeBytes: number;
  seeders: number;
  leechers: number;
  kind: ContentKind;
  added?: number;
  infoHash?: string;
  magnet?: string;
  torrentUrl?: string;
}

function innerTag(item: string, name: string): string | null {
  const m = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  const inner = m[1] ?? "";
  const cdata = inner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return (cdata ? cdata[1]! : inner).trim();
}

// Torznab extends each <item> with <torznab:attr name="..." value="..."/> pairs.
// Attribute order varies across indexers, so try both name-first and value-first;
// quotes may be single or double, so capture the opening quote and match it.
function torznabAttr(item: string, name: string): string | null {
  const nameFirst = item.match(
    new RegExp(
      `<(?:[\\w-]+:)?attr\\b[^>]*\\bname=["']${name}["'][^>]*\\bvalue=(["'])(.*?)\\1`,
      "i",
    ),
  );
  if (nameFirst) return nameFirst[2]!;
  const valueFirst = item.match(
    new RegExp(
      `<(?:[\\w-]+:)?attr\\b[^>]*\\bvalue=(["'])(.*?)\\1[^>]*\\bname=["']${name}["']`,
      "i",
    ),
  );
  return valueFirst ? valueFirst[2]! : null;
}

// Every <enclosure url="..."> in the item, in document order. An item can carry
// more than one (e.g. a metadata file and the torrent), so callers pick the one
// they want rather than assuming the first is the download.
function enclosureUrls(item: string): string[] {
  const re = /<enclosure\b[^>]*\burl=(["'])(.*?)\1/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(item)) !== null) out.push(unescapeEntities(m[2]!));
  return out;
}

function toInt(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

// Only accept a real 40-char hex or 32-char base32 info hash, normalized to hex.
// Torznab feeds occasionally carry truncated or placeholder values; a bad hash
// would otherwise become a magnet no client can resolve.
function validInfoHash(raw: string): string | null {
  const trimmed = raw.trim();
  return isInfoHash(trimmed) ? normalizeInfoHash(trimmed) : null;
}

function infoHashFromMagnet(magnet: string): string | null {
  const raw = magnet.match(/urn:btih:([a-z0-9]+)/i)?.[1];
  return raw ? validInfoHash(raw) : null;
}

// Category codes for an item, from both <category>N</category> elements and
// <torznab:attr name="category" value="N"/>. Indexers also emit custom codes
// (> 99999); classification ignores those and uses the standard newznab ranges.
function categoryCodes(item: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  const el = /<category>(\d+)<\/category>/gi;
  while ((m = el.exec(item)) !== null) out.push(Number(m[1]));
  const attr = /<(?:[\w-]+:)?attr\b[^>]*\bname=["']category["'][^>]*\bvalue=["'](\d+)["']/gi;
  while ((m = attr.exec(item)) !== null) out.push(Number(m[1]));
  return out;
}

// Map newznab category codes (and a title hint for audiobooks, which indexers
// tag inconsistently) to a content kind. Order matters: the more specific /
// user-facing kinds win when an item carries several codes.
function classifyKind(codes: number[], title: string): ContentKind {
  const std = codes.filter((c) => c >= 1000 && c < 10000);
  const inRange = (lo: number, hi: number): boolean => std.some((c) => c >= lo && c < hi);
  // The title-based audiobook hint only applies when the category is actually a
  // book/audio family (or absent); otherwise "Audiobook Editor Pro" tagged as
  // software would wrongly land in Audiobooks.
  const bookOrAudio = std.length === 0 || inRange(3000, 4000) || inRange(7000, 8000);
  if (std.includes(3030) || (bookOrAudio && /audio\s?books?/i.test(title))) return "audiobook";
  if (inRange(7000, 8000)) return "ebook";
  if (inRange(3000, 4000)) return "music";
  if (inRange(2000, 3000)) return "movie";
  if (std.includes(5070)) return "anime";
  if (inRange(5000, 6000)) return "tv";
  if (inRange(6000, 7000)) return "xxx";
  if (inRange(1000, 2000)) return "game";
  if (inRange(4000, 5000)) return "software";
  return "other";
}

function parseItem(item: string): RawItem | null {
  const rawTitle = innerTag(item, "title");
  if (!rawTitle) return null;

  const indexer = innerTag(item, "jackettindexer") ?? innerTag(item, "prowlarrindexer");
  const title = unescapeEntities(rawTitle);
  const name = indexer ? `${title} [${unescapeEntities(indexer)}]` : title;

  const seeders = Math.max(0, toInt(torznabAttr(item, "seeders")) ?? 0);
  const peers = toInt(torznabAttr(item, "peers"));
  const leechAttr = toInt(torznabAttr(item, "leechers"));
  // Torznab's "peers" counts seeders + leechers; derive leechers when it's all
  // we're given, and clamp so a bogus/negative count can't inflate the total.
  const leechers = Math.max(0, leechAttr ?? (peers != null ? peers - seeders : 0));

  const sizeBytes =
    toInt(innerTag(item, "size")) ?? toInt(torznabAttr(item, "size")) ?? 0;

  const pub = innerTag(item, "pubDate");
  const pubMs = pub ? Date.parse(pub) : NaN;
  const added = Number.isNaN(pubMs) ? undefined : Math.floor(pubMs / 1000);

  const kind = classifyKind(categoryCodes(item), title);
  const raw: RawItem = { name, sizeBytes, seeders, leechers, kind, added };

  // Prefer an explicit magnet: the magneturl attr, then a magnet <link>, then a
  // magnet <enclosure>. Fall back to an infohash attr, then a .torrent link to
  // resolve later.
  const link = innerTag(item, "link");
  const enclosures = enclosureUrls(item);
  const magnetCandidate =
    torznabAttr(item, "magneturl") ??
    (link && /^magnet:\?/i.test(link) ? link : null) ??
    enclosures.find((u) => /^magnet:\?/i.test(u)) ??
    null;

  if (magnetCandidate) {
    const magnet = unescapeEntities(magnetCandidate);
    const infoHash = infoHashFromMagnet(magnet);
    if (infoHash) {
      raw.magnet = magnet;
      raw.infoHash = infoHash;
      return raw;
    }
  }

  const hashAttr = torznabAttr(item, "infohash");
  const attrHash = hashAttr ? validInfoHash(hashAttr) : null;
  if (attrHash) {
    raw.infoHash = attrHash;
    return raw;
  }

  const torrentUrl =
    enclosures.find((u) => /^https?:\/\//i.test(u)) ??
    (link && /^https?:\/\//i.test(link) ? unescapeEntities(link) : null);
  if (torrentUrl) {
    raw.torrentUrl = torrentUrl;
    return raw;
  }

  return null;
}

export function parseTorznab(xml: string): RawItem[] {
  // Split on the <item start tag however it's punctuated (`<item>`, `<item ...>`,
  // or a self-closing `<item/>`); \b sits between "item" and >, space, or /.
  const chunks = xml.split(/<item\b/i).slice(1);
  const out: RawItem[] = [];
  for (const chunk of chunks) {
    const end = chunk.indexOf("</item>");
    const item = end === -1 ? chunk : chunk.slice(0, end);
    const parsed = parseItem(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

function finalize(raw: RawItem): TorrentResult | null {
  const infoHash = raw.infoHash?.toLowerCase();
  if (!infoHash) return null;
  const magnet = raw.magnet ?? buildMagnet(infoHash, raw.name);
  return {
    infoHash,
    name: raw.name,
    sizeBytes: raw.sizeBytes,
    seeders: raw.seeders,
    leechers: raw.leechers,
    source: "torznab",
    kind: raw.kind,
    magnet,
    added: raw.added,
  };
}

async function resolveTorrent(
  raw: RawItem,
  opts: SearchOptions,
): Promise<TorrentResult | null> {
  try {
    const res = await fetchResilient(raw.torrentUrl!, {
      headers: { "User-Agent": USER_AGENT },
      signal: opts.signal,
      retries: 0,
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const parsed = await magnetFromTorrentBuffer(buf, raw.name);
    if (!parsed) return null;
    return finalize({ ...raw, infoHash: parsed.infoHash, magnet: parsed.magnet });
  } catch {
    return null;
  }
}

async function queryEndpoint(
  endpoint: TorznabEndpoint,
  query: string,
  opts: SearchOptions,
): Promise<TorrentResult[]> {
  let res: Response;
  try {
    res = await fetchResilient(torznabSearchUrl(endpoint, query), {
      headers: { "User-Agent": USER_AGENT },
      signal: opts.signal,
      retries: 1,
    });
  } catch (e) {
    // fetchResilient bakes the full request URL — which carries the apikey — into
    // its error messages. Re-throw a clean one so the key never reaches the UI.
    if (e instanceof Error && (e.name === "AbortError" || /aborted/i.test(e.message))) throw e;
    const status = e instanceof HttpError ? e.status : 0;
    throw new HttpError(status, `${endpoint.name} unreachable`);
  }
  if (!res.ok) throw new HttpError(res.status, `${endpoint.name} returned ${res.status}`);

  const raws = parseTorznab(await res.text());
  const out: TorrentResult[] = [];
  const pending: RawItem[] = [];
  for (const raw of raws) {
    if (raw.infoHash || raw.magnet) {
      const r = finalize(raw);
      if (r) out.push(r);
    } else if (raw.torrentUrl) {
      pending.push(raw);
    }
  }

  if (pending.length > 0) {
    const resolved = await Promise.all(
      pending.slice(0, RESOLVE_CAP).map((raw) => resolveTorrent(raw, opts)),
    );
    for (const r of resolved) if (r) out.push(r);
  }
  return out;
}

function dedupe(list: TorrentResult[]): TorrentResult[] {
  const byHash = new Map<string, TorrentResult>();
  for (const r of list) {
    const existing = byHash.get(r.infoHash);
    if (!existing || r.seeders > existing.seeders) byHash.set(r.infoHash, r);
  }
  return [...byHash.values()];
}

async function search(query: string, opts: SearchOptions = {}): Promise<TorrentResult[]> {
  const q = query.trim();
  // Torznab is a search firehose, not a browse feed: an empty query would spam
  // every configured indexer for nothing, so leave browsing to curated sources.
  if (!q) return [];

  // Prefer the in-memory config so an endpoint the user just saved is used
  // immediately, without racing its async write to disk.
  const cfg = getLoadedConfig() ?? (await loadConfig());
  const endpoints = cfg.torznab;
  if (endpoints.length === 0) return [];

  const settled = await Promise.all(
    endpoints.map((endpoint) =>
      queryEndpoint(endpoint, q, opts).then(
        (results) => ({ results }),
        (error: unknown) => ({ error }),
      ),
    ),
  );

  const all: TorrentResult[] = [];
  let firstError: unknown;
  for (const s of settled) {
    if ("results" in s) all.push(...s.results);
    else if (firstError === undefined) firstError = s.error;
  }
  // Surface an error only when nothing came back at all — a partial outage still
  // shows the results that did arrive.
  if (all.length === 0 && firstError !== undefined) throw firstError;
  return dedupe(all);
}

export const torznab: Source = {
  id: "torznab",
  label: "Jackett",
  group: "Jackett",
  classifies: true,
  homepage: "https://github.com/Jackett/Jackett",
  search,
};
