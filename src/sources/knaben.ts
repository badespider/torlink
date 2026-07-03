import { fetchResilient, HttpError, USER_AGENT } from "../util/net";
import { buildMagnet, isInfoHash, normalizeInfoHash } from "./magnet";
import type { ContentKind, SearchOptions, Source, TorrentResult } from "./types";

// Knaben is a meta-search that indexes dozens of trackers behind one JSON API,
// which is what lets torlink cover ebooks, audiobooks, music, and software out
// of the box with no Jackett setup.
const API = "https://api.knaben.org/v1";

const PAGE_SIZE = 100;

interface KnabenHit {
  title?: string;
  hash?: string;
  magnetUrl?: string;
  bytes?: number;
  seeders?: number;
  peers?: number;
  date?: string;
  categoryId?: number[];
}

interface KnabenResponse {
  hits?: KnabenHit[];
}

// Knaben category ids are X00Y000: X000000 is the family, X00Y000 a child.
// Specific children first (audiobooks, PC games), then by family.
export function kindFromCategories(ids: number[]): ContentKind {
  if (ids.includes(1003000)) return "audiobook";
  if (ids.includes(4001000)) return "game";
  const families = new Set(ids.map((id) => Math.floor(id / 1000000)));
  if (families.has(9)) return "ebook";
  if (families.has(1)) return "music";
  if (families.has(3)) return "movie";
  if (families.has(6)) return "anime";
  if (families.has(2)) return "tv";
  if (families.has(5)) return "xxx";
  if (families.has(7)) return "game";
  if (families.has(4)) return "software";
  return "other";
}

async function search(query: string, opts: SearchOptions = {}): Promise<TorrentResult[]> {
  const q = query.trim();
  // Knaben is search-only for us: with no query its top-seeded feed is mostly
  // spam, so browsing stays with the curated sources.
  if (!q) return [];

  const res = await fetchResilient(API, {
    method: "POST",
    headers: { "User-Agent": USER_AGENT, "Content-Type": "application/json" },
    body: JSON.stringify({
      search_type: "100%",
      search_field: "title",
      query: q,
      order_by: "seeders",
      order_direction: "desc",
      from: 0,
      size: PAGE_SIZE,
      hide_unsafe: true,
    }),
    signal: opts.signal,
    retries: 1,
  });
  if (!res.ok) throw new HttpError(res.status, `Knaben returned ${res.status}`);

  const json = (await res.json()) as KnabenResponse;
  const out: TorrentResult[] = [];
  for (const hit of json.hits ?? []) {
    const raw = (hit.hash ?? "").trim();
    if (!isInfoHash(raw)) continue;
    // Normalize to hex so cross-source dedupe (which compares infoHash strings)
    // matches a base32 copy of the same torrent from another source.
    const hash = normalizeInfoHash(raw);
    const name = hit.title || hash;
    const addedMs = hit.date ? Date.parse(hit.date) : NaN;
    out.push({
      infoHash: hash,
      name,
      sizeBytes: hit.bytes && hit.bytes > 0 ? hit.bytes : 0,
      seeders: Math.max(0, hit.seeders ?? 0),
      // Knaben's "peers" field counts leechers, not seeders + leechers.
      leechers: Math.max(0, hit.peers ?? 0),
      source: "knaben",
      kind: kindFromCategories(hit.categoryId ?? []),
      magnet: hit.magnetUrl || buildMagnet(hash, name),
      added: Number.isNaN(addedMs) ? undefined : Math.floor(addedMs / 1000),
    });
  }
  return out;
}

export const knaben: Source = {
  id: "knaben",
  label: "Knaben",
  group: "Everything",
  classifies: true,
  homepage: "https://knaben.org",
  search,
};
