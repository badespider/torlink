import { promises as fs } from "node:fs";
import { configFile, defaultDownloadDir } from "./paths";
import { serializeWrites, writeJsonAtomic } from "../util/atomic";

export interface TorznabEndpoint {
  name: string;
  url: string;
  apiKey: string;
}

export interface Config {
  downloadDir: string;
  trackers: string[];
  torznab: TorznabEndpoint[];
}

export const defaultConfig: Config = {
  downloadDir: defaultDownloadDir,
  trackers: [],
  torznab: [],
};

function sanitizeTorznab(raw: unknown): TorznabEndpoint[] {
  if (!Array.isArray(raw)) return [];
  const out: TorznabEndpoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const e = item as Partial<TorznabEndpoint>;
    if (typeof e.url !== "string" || !e.url) continue;
    out.push({
      name: typeof e.name === "string" && e.name ? e.name : "Torznab",
      url: e.url,
      apiKey: typeof e.apiKey === "string" ? e.apiKey : "",
    });
  }
  return out;
}

// The most recently loaded/saved config, kept in memory. Sources (e.g. the
// Torznab source) read this instead of re-reading the file, so an edit made via
// saveConfig is visible immediately — before the async disk write finishes —
// rather than racing it.
let liveConfig: Config | null = null;

export function getLoadedConfig(): Config | null {
  return liveConfig;
}

export async function loadConfig(): Promise<Config> {
  let raw: string;
  try {
    raw = await fs.readFile(configFile, "utf8");
  } catch {
    liveConfig = { ...defaultConfig, trackers: [], torznab: [] };
    return liveConfig;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Config>;
    const cfg: Config = {
      downloadDir:
        typeof parsed.downloadDir === "string" && parsed.downloadDir
          ? parsed.downloadDir
          : defaultDownloadDir,
      trackers: Array.isArray(parsed.trackers)
        ? parsed.trackers.filter((t): t is string => typeof t === "string" && t.length > 0)
        : [],
      torznab: sanitizeTorznab(parsed.torznab),
    };
    liveConfig = cfg;
    return cfg;
  } catch {
    liveConfig = { ...defaultConfig, trackers: [], torznab: [] };
    return liveConfig;
  }
}

const write = serializeWrites();

export function saveConfig(config: Config): Promise<void> {
  // Publish to memory synchronously so a search issued right after an edit sees
  // the new value even though the file write below is async.
  liveConfig = config;
  return write(() => writeJsonAtomic(configFile, config));
}
