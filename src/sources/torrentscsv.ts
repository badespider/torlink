import { fetchResilient, HttpError, USER_AGENT } from "../util/net";
import { buildMagnet, isInfoHash } from "./magnet";
import type { SearchOptions, Source, TorrentResult } from "./types";

// Torrents-CSV is an open, self-hostable index of proven torrents with a plain
// JSON search API — no key, no scraping. It carries no category data, so its
// results have no content kind and only appear in the All tab.
const API = "https://torrents-csv.com/service/search";

const PAGE_SIZE = 100;

interface CsvTorrent {
  infohash?: string;
  name?: string;
  size_bytes?: number;
  seeders?: number;
  leechers?: number;
  created_unix?: number;
}

interface CsvResponse {
  torrents?: CsvTorrent[];
}

async function search(query: string, opts: SearchOptions = {}): Promise<TorrentResult[]> {
  const q = query.trim();
  // The API requires a query; browsing stays with the curated sources.
  if (!q) return [];

  const res = await fetchResilient(`${API}?q=${encodeURIComponent(q)}&size=${PAGE_SIZE}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: opts.signal,
    retries: 1,
  });
  if (!res.ok) throw new HttpError(res.status, `Torrents-CSV returned ${res.status}`);

  const json = (await res.json()) as CsvResponse;
  const out: TorrentResult[] = [];
  for (const t of json.torrents ?? []) {
    const hash = (t.infohash ?? "").toLowerCase();
    if (!isInfoHash(hash)) continue;
    const name = t.name || hash;
    out.push({
      infoHash: hash,
      name,
      sizeBytes: t.size_bytes && t.size_bytes > 0 ? t.size_bytes : 0,
      seeders: Math.max(0, t.seeders ?? 0),
      leechers: Math.max(0, t.leechers ?? 0),
      source: "torrentscsv",
      magnet: buildMagnet(hash, name),
      added: t.created_unix || undefined,
    });
  }
  return out;
}

export const torrentscsv: Source = {
  id: "torrentscsv",
  label: "Torrents-CSV",
  group: "Everything",
  homepage: "https://torrents-csv.com",
  search,
};
