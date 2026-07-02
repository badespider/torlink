export type SourceId =
  | "fitgirl"
  | "yts"
  | "eztv"
  | "nyaa"
  | "subsplease"
  | "tpb-movies"
  | "tpb-tv"
  | "x1337-movies"
  | "x1337-tv"
  | "torznab";

export type SourceGroup = "Games" | "Movies" | "TV" | "Anime" | "Jackett";

// The content type of a result, derived from Torznab/newznab category codes.
// Only aggregator (Torznab) results carry this; built-in sources are grouped by
// their SourceGroup instead. Used to drive the content-type tabs.
export type ContentKind =
  | "movie"
  | "tv"
  | "anime"
  | "game"
  | "music"
  | "audiobook"
  | "ebook"
  | "software"
  | "xxx"
  | "other";

export interface TorrentResult {
  infoHash: string;
  name: string;
  sizeBytes: number;
  seeders: number;
  leechers: number;
  numFiles?: number;
  source: SourceId;
  kind?: ContentKind;
  magnet: string;
  added?: number;
}

export interface SearchOptions {
  signal?: AbortSignal;
}

export interface Source {
  id: SourceId;
  label: string;
  group: SourceGroup;
  homepage: string;
  search(query: string, opts?: SearchOptions): Promise<TorrentResult[]>;
}
