import type { TorznabEndpoint } from "./config";

// Jackett exposes an aggregate "all indexers" Torznab feed at this path: one
// query fans out to every indexer the user has configured. That single endpoint
// is what turns torlink's fixed source list into "every site you've added".
const JACKETT_ALL_PATH = "/api/v2.0/indexers/all/results/torznab/api";

const HAS_SCHEME = /^https?:\/\//i;

// A URL that already points at a Torznab/newznab API surface — leave it alone.
// Covers Jackett (/api/v2.0/...), Prowlarr (/1/api, /api/v1/...) and native
// tracker Torznab feeds, however they're shaped.
const LOOKS_LIKE_API = /\/api(\/|\b|$)|torznab/i;

/**
 * Turn whatever the user pasted into a full Torznab API URL.
 *
 * - A bare Jackett base (`http://127.0.0.1:9117`, optionally with a trailing
 *   slash) becomes the aggregate feed `.../api/v2.0/indexers/all/results/torznab/api`.
 * - Anything that already looks like an API URL is returned untouched (Prowlarr
 *   feeds, single-indexer Jackett feeds, native tracker Torznab endpoints).
 *
 * Any `apikey`/`apiKey` query parameter is stripped here; the key is stored and
 * re-applied separately at query time so it never gets double-encoded.
 */
export function normalizeTorznabUrl(input: string): string {
  let url = input.trim();
  if (!url) return "";
  if (!HAS_SCHEME.test(url)) url = `http://${url}`;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }
  parsed.searchParams.delete("apikey");
  parsed.searchParams.delete("apiKey");

  const path = parsed.pathname.replace(/\/+$/, "");
  if (!LOOKS_LIKE_API.test(parsed.pathname) && !LOOKS_LIKE_API.test(parsed.search)) {
    parsed.pathname = `${path}${JACKETT_ALL_PATH}`;
  } else {
    parsed.pathname = path || "/";
  }
  return parsed.toString();
}

/**
 * Parse the single-field Jackett prompt input. The user types a URL and,
 * optionally, an API key separated by whitespace:
 *
 *     http://127.0.0.1:9117 a1b2c3d4e5
 *
 * The key may also be embedded in the URL as `?apikey=...`, or omitted entirely
 * (some private-tracker Torznab feeds authenticate another way). Returns null
 * when there is no usable URL, so an empty submit clears the endpoint.
 */
export function parseTorznabInput(input: string, name = "Jackett"): TorznabEndpoint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Split once on the first run of whitespace: everything before is the URL,
  // everything after is the key (kept verbatim, so a key isn't mangled).
  const split = trimmed.search(/\s/);
  const rawUrl = split === -1 ? trimmed : trimmed.slice(0, split);
  let apiKey = split === -1 ? "" : trimmed.slice(split).trim();

  // Pull an inline apikey out of the URL if one wasn't given separately.
  if (!apiKey) {
    try {
      const withScheme = HAS_SCHEME.test(rawUrl) ? rawUrl : `http://${rawUrl}`;
      const embedded = new URL(withScheme).searchParams;
      apiKey = embedded.get("apikey") ?? embedded.get("apiKey") ?? "";
    } catch {
      // fall through to normalization, which reports a bad URL as ""
    }
  }

  const url = normalizeTorznabUrl(rawUrl);
  if (!url) return null;
  return { name, url, apiKey };
}

/** Render an endpoint back into the prompt's `url apikey` field format. */
export function formatTorznabInput(endpoints: TorznabEndpoint[]): string {
  const first = endpoints[0];
  if (!first) return "";
  return first.apiKey ? `${first.url} ${first.apiKey}` : first.url;
}

/** Build the Torznab search URL for a query against one endpoint. */
export function torznabSearchUrl(endpoint: TorznabEndpoint, query: string): string {
  const u = new URL(endpoint.url);
  if (endpoint.apiKey) u.searchParams.set("apikey", endpoint.apiKey);
  u.searchParams.set("t", "search");
  u.searchParams.set("q", query);
  return u.toString();
}
