import { createContext, useContext, useEffect, useState } from "react";
import type { Config } from "../config/config";
import type { DownloadQueue } from "../download/queue";
import type { HistoryItem } from "../download/history";
import type { QueueItem, SeedItem } from "../download/types";
import type { ContentKind, SourceGroup, SourceId } from "../sources/types";

export type View = "splash" | "browser";

export type Category =
  | "all"
  | "games"
  | "movies"
  | "tv"
  | "anime"
  | "music"
  | "ebooks"
  | "audiobooks"
  | "software"
  | "jackett";

export type Section = Category | "downloads" | "seeding";

export interface CategoryDef {
  key: Category;
  label: string;
  // A result matches this tab if its source's group is `group` (built-in
  // sources) OR its content kind is `kind` (aggregator results). "All" has
  // neither and shows everything.
  group?: SourceGroup;
  kind?: ContentKind;
  // Content-only kinds that nothing built-in provides: hidden from the sidebar
  // until a Jackett/Torznab endpoint is configured.
  jackettOnly?: boolean;
}

export const CATEGORIES: CategoryDef[] = [
  { key: "all", label: "All" },
  { key: "games", label: "Games", group: "Games", kind: "game" },
  { key: "movies", label: "Movies", group: "Movies", kind: "movie" },
  { key: "tv", label: "TV", group: "TV", kind: "tv" },
  { key: "anime", label: "Anime", group: "Anime", kind: "anime" },
  { key: "music", label: "Music", kind: "music", jackettOnly: true },
  { key: "ebooks", label: "Ebooks", kind: "ebook", jackettOnly: true },
  { key: "audiobooks", label: "Audiobooks", kind: "audiobook", jackettOnly: true },
  { key: "software", label: "Software", kind: "software", jackettOnly: true },
  { key: "jackett", label: "Jackett", group: "Jackett" },
];

export type Region = "sidebar" | "content" | "help";

export type CaptureMode = "none" | "text" | "esc";

export type DownloadFocus = "downloading" | "paused" | "failed" | "recent";

export type SeedFocus = "seeding" | "paused" | "missing" | "idle";

export interface Store {
  config: Config;
  setConfig: (c: Config) => void;
  queue: DownloadQueue;

  view: View;
  setView: (v: View) => void;
  query: string;
  submitQuery: (q: string) => void;

  section: Section;
  setSection: (s: Section) => void;
  region: Region;
  setRegion: (r: Region) => void;
  captureMode: CaptureMode;
  setCaptureMode: (m: CaptureMode) => void;

  downloadFocus: DownloadFocus | null;
  setDownloadFocus: (f: DownloadFocus | null) => void;
  seedFocus: SeedFocus | null;
  setSeedFocus: (f: SeedFocus | null) => void;

  startDownload: (input: {
    id: string;
    name: string;
    magnet: string;
    source?: SourceId;
    sizeBytes?: number;
  }) => void;
  copyMagnet: (input: { name: string; magnet: string }) => void;

  notice: string | null;
  setNotice: (s: string | null) => void;

  quitAll: () => void;

  listRows: number;
  compact: boolean;
  contentWidth: number;
  cols: number;
  rows: number;
}

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("Store not available");
  return s;
}

export function useQueueItems(queue: DownloadQueue): QueueItem[] {
  const [items, setItems] = useState<QueueItem[]>(() => queue.getItems());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = (): void => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        setItems(queue.getItems());
      }, 200);
    };
    queue.on("update", onUpdate);
    onUpdate();
    return () => {
      queue.off("update", onUpdate);
      if (timer) clearTimeout(timer);
    };
  }, [queue]);
  return items;
}

export function useQueueHistory(queue: DownloadQueue): HistoryItem[] {
  const [items, setItems] = useState<HistoryItem[]>(() => queue.getHistory());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = (): void => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        setItems(queue.getHistory());
      }, 200);
    };
    queue.on("update", onUpdate);
    onUpdate();
    return () => {
      queue.off("update", onUpdate);
      if (timer) clearTimeout(timer);
    };
  }, [queue]);
  return items;
}

export function useSeeds(queue: DownloadQueue): Map<string, SeedItem> {
  const [seeds, setSeeds] = useState<Map<string, SeedItem>>(
    () => new Map(queue.getSeeds().map((s) => [s.id, s])),
  );
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = (): void => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        setSeeds(new Map(queue.getSeeds().map((s) => [s.id, s])));
      }, 200);
    };
    queue.on("update", onUpdate);
    onUpdate();
    return () => {
      queue.off("update", onUpdate);
      if (timer) clearTimeout(timer);
    };
  }, [queue]);
  return seeds;
}
