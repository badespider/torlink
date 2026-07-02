# Infinity search: connecting torlink to Jackett

torlink ships with a short, curated list of sources. This guide adds a firehose:
a single **Torznab** source that queries a [Jackett](https://github.com/Jackett/Jackett)
instance, which itself proxies **hundreds** of torrent indexers behind one API. Add
an indexer in Jackett and it's instantly searchable from torlink — no code changes,
no new releases.

[Prowlarr](https://github.com/Prowlarr/Prowlarr) works too; see [the note at the
bottom](#using-prowlarr-instead). The steps below use Jackett because its aggregate
"all indexers" feed is the simplest path to "search everything".

---

## 1. Run Jackett

Jackett is a small always-on service. Pick whichever install you prefer.

### Option A — Docker (recommended, cross-platform)

```sh
docker run -d \
  --name jackett \
  -p 9117:9117 \
  -v jackett-config:/config \
  --restart unless-stopped \
  lscr.io/linuxserver/jackett:latest
```

Then open <http://127.0.0.1:9117> in a browser.

### Option B — macOS (Homebrew)

```sh
brew install --cask jackett
open "/Applications/Jackett.app"
```

Jackett runs in the menu bar and serves its UI at <http://127.0.0.1:9117>.

### Option C — native binaries

Download the build for your OS from the
[Jackett releases page](https://github.com/Jackett/Jackett/releases) and run it.
On Linux the release includes an `install_service_systemd.sh` to keep it running.

---

## 2. Add some indexers

In the Jackett web UI (<http://127.0.0.1:9117>):

1. Click **+ Add indexer**.
2. Search the list and hit the **+** next to public trackers you want. Good
   starting points that don't need an account: **1337x**, **The Pirate Bay**,
   **TorrentGalaxy**, **EZTV**, **YTS**, **Nyaa**, **LimeTorrents**, **Torrent[CSV]**.
3. For each added indexer, click the wrench/**Test** to confirm it's reachable.
   (Some public trackers move domains often; a failing test means that one is down,
   not your setup.)
4. Private trackers work too — add them and fill in your credentials.

The more indexers you add here, the more torlink searches. That's the whole trick.

---

## 3. Get the URL and API key

Both are on the Jackett dashboard:

- **URL** — the address Jackett is served on, e.g. `http://127.0.0.1:9117`.
  If Jackett runs on another machine, use that host's IP instead of `127.0.0.1`.
- **API Key** — shown in the top-right of the Jackett UI (a ~32-character string).
  Copy it.

You do **not** need to hunt down the long "Torznab Feed" URL for a single indexer —
torlink builds the correct aggregate endpoint from the base URL automatically.

---

## 4. Tell torlink

Launch torlink and press **`J`**. In the prompt, type the base URL, a space, then
the API key:

```
http://127.0.0.1:9117  a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
```

Press **Enter**. torlink expands that into Jackett's aggregate Torznab feed
(`/api/v2.0/indexers/all/results/torznab/api`) and stores it in its config. To
change or remove it later, press `J` again (an empty submit clears it).

That's it. Search for anything: results from every indexer you added stream into the
**All** tab (tagged `JKT`, with the originating tracker shown in brackets) and onto a
dedicated **Jackett** tab.

---

## How it works

- torlink adds one source, `torznab`, that reads your saved endpoint and issues a
  single `t=search` Torznab query against Jackett's **all-indexers** feed. Jackett
  fans that out to every configured indexer server-side and returns a combined
  Torznab (RSS/XML) response.
- torlink parses each item for a magnet link (or an infohash, or — for feeds that
  only return a `.torrent` — resolves the file to an infohash), plus size, seeders,
  and leechers, then merges and de-duplicates them with the built-in sources by
  infohash, keeping the healthiest copy.
- Nothing is sent anywhere except your own Jackett instance and, on download, the
  torrent swarm. The API key is stored in torlink's local `config.json`, the same
  place your download folder and extra trackers live.

## Manual configuration

Prefer editing files? torlink's config lives at:

- macOS: `~/Library/Preferences/torlink/config.json`
- Linux: `~/.config/torlink/config.json`

Add a `torznab` array. Each entry is `{ name, url, apiKey }`. You can list more than
one endpoint (e.g. a Jackett box plus a native-Torznab private tracker) and torlink
queries them all:

```json
{
  "downloadDir": "/Users/you/Downloads/torlink",
  "trackers": [],
  "torznab": [
    {
      "name": "Jackett",
      "url": "http://127.0.0.1:9117/api/v2.0/indexers/all/results/torznab/api",
      "apiKey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
    }
  ]
}
```

## Using Prowlarr instead

Prowlarr also speaks Torznab. Point torlink at a Prowlarr Torznab feed URL (including
its `/api` path) and pass the matching API key — torlink leaves any URL that already
contains an API path untouched, so paste the full feed URL rather than a bare host.
Jackett's single aggregate feed is still the least-effort way to search everything at
once.

## Troubleshooting

- **"Jackett isn't connected yet"** on the Jackett tab — no endpoint saved yet. Press `J`.
- **The Jackett tab shows an error / "may be down"** — torlink reached the endpoint but
  it returned an error. Check the URL and API key (press `J` to re-enter), and confirm
  Jackett is running at that address.
- **Fewer results than expected** — open the Jackett UI and re-test your indexers; a
  public tracker may have moved domains or be temporarily offline. torlink only sees
  what Jackett can reach.
- **Nothing on an empty search** — the Jackett source only runs on an actual query, so
  it deliberately stays quiet when you're just browsing the curated library.
