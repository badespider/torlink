import type { SearchOptions, Source, TorrentResult } from "./types";

const TTL_MS = 5 * 60 * 1000;

interface Entry {
  at: number;
  results: TorrentResult[];
}

const cache = new Map<string, Entry>();

function key(sourceId: string, query: string): string {
  return `${sourceId}::${query.trim().toLowerCase()}`;
}

// Drop cached results for one source (all queries). Used when a source's config
// changes mid-session — e.g. the Jackett endpoint is edited — so stale hits from
// the old endpoint don't linger for the TTL.
export function invalidateSource(sourceId: string): void {
  const prefix = `${sourceId}::`;
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

export async function cachedSearch(
  source: Source,
  query: string,
  opts: SearchOptions = {},
): Promise<TorrentResult[]> {
  const k = key(source.id, query);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.results;

  const results = await source.search(query, opts);
  cache.set(k, { at: Date.now(), results });
  return results;
}
