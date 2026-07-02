import { promises as fs } from "node:fs";
import parseTorrent from "parse-torrent";
import { buildMagnet, type ParsedMagnet } from "./magnet";

export async function magnetFromTorrentBuffer(
  bytes: Uint8Array,
  fallbackName?: string,
): Promise<ParsedMagnet | null> {
  try {
    const parsed = await parseTorrent(bytes);
    const infoHash = parsed?.infoHash?.toLowerCase();
    if (!infoHash) return null;
    const name = parsed.name || fallbackName || infoHash;
    return { infoHash, name, magnet: buildMagnet(infoHash, name) };
  } catch {
    return null;
  }
}

export async function magnetFromTorrentFile(path: string): Promise<ParsedMagnet | null> {
  try {
    const buf = await fs.readFile(path);
    return await magnetFromTorrentBuffer(new Uint8Array(buf));
  } catch {
    return null;
  }
}
