# Deploying the live-collaboration server

This is the Go backend behind BillSplitter's "Go Live" feature (planv3.md
Phase 3) and, as of the bill-processor migration, receipt scanning as well.
The frontend's bill editor, splitting, and settlement flows are still fully
functional without it — nothing here is required for those. Deploy it if you
want the live join/claim/settle flow to work for real users, **or** if you
want "Scan Receipt" to work: scanning now calls `POST /api/scan` on this
server (it used to call an external Cloudflare Worker), so it's no longer
optional for that one feature.

Today it only runs via `go run ./cmd/server` with local defaults. This doc
covers what's needed to run it for real: a systemd unit, a Docker image, a
reverse-proxy/TLS note, and the full environment variable reference.

## Environment variables

All have working local-dev defaults (see `internal/config/config.go`); only
`ALLOWED_ORIGINS` and `ADMIN_TOKEN` need attention for a real deployment.

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8080` | The server listens on plain HTTP — put a TLS-terminating reverse proxy in front for anything public. |
| `DB_PATH` | `./data/billsplitter.db` | SQLite file. Needs a persistent volume in any containerized/ephemeral-filesystem deployment. |
| `IMAGE_DIR` | `./data/images` | Uploaded receipt images. Same persistence requirement as `DB_PATH`. |
| `ALLOWED_ORIGINS` | *(empty)* | Comma-separated list of origins allowed to call the API, e.g. `https://billsplitter.example.com,https://staging.example.com`. Requests from `localhost`/`127.0.0.1` are always allowed regardless (`internal/middleware/allowlist.go`), for local dev against a deployed server. **Set this in production** — an empty list still runs, but only localhost origins can reach it. |
| `ADMIN_TOKEN` | *(empty)* | Bearer token gating `/admin`, `/admin/stats`, and `/admin/bill-processor` (session list, purge, basic stats, scan usage analytics). Leaving it empty disables the admin panel entirely (`403` on every admin route) rather than leaving it open — **set a real value if you want the panel**, and treat it as a secret. |
| `CLEANUP_INTERVAL_MINUTES` | `30` | How often the background job purges settled/idle sessions past their 48h grace period (planv3.md 3.8). |
| `OPENROUTER_API_KEY` | *(empty)* | **Required for receipt scanning.** OpenRouter API key used to call the vision model for `POST /api/scan`. Without it, scan requests fail with a 500 (`OPENROUTER_API_KEY is not configured.`); everything else on the server still works. Treat as a secret — prefer an `EnvironmentFile`/secret store over inlining it. |
| `OPENROUTER_MODEL` | `google/gemini-3.1-flash-lite` | The OpenRouter model ID used for scanning. |

## Running as a systemd unit

Build a binary and run it directly on a host:

```bash
cd server
go build -o /opt/billsplitter/server ./cmd/server
```

`/etc/systemd/system/billsplitter-server.service`:

```ini
[Unit]
Description=BillSplitter live-collaboration server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/billsplitter
ExecStart=/opt/billsplitter/server
Restart=on-failure
RestartSec=5
Environment=PORT=8080
Environment=DB_PATH=/opt/billsplitter/data/billsplitter.db
Environment=IMAGE_DIR=/opt/billsplitter/data/images
Environment=ALLOWED_ORIGINS=https://billsplitter.example.com
Environment=ADMIN_TOKEN=change-me-to-a-real-secret
Environment=CLEANUP_INTERVAL_MINUTES=30
Environment=OPENROUTER_MODEL=google/gemini-3.1-flash-lite
# Secrets (OPENROUTER_API_KEY, ADMIN_TOKEN) belong in an EnvironmentFile,
# not inlined here:
# EnvironmentFile=/opt/billsplitter/server.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo mkdir -p /opt/billsplitter/data
sudo systemctl daemon-reload
sudo systemctl enable --now billsplitter-server
```

## Running with Docker

`server/Dockerfile` (not checked in — copy this if you want one):

```dockerfile
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# CGO_ENABLED=0: modernc.org/sqlite is a pure-Go driver, no CGO/musl needed.
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

FROM alpine:3.20
RUN adduser -D -H billsplitter
COPY --from=build /out/server /usr/local/bin/server
USER billsplitter
WORKDIR /data
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/server"]
```

```bash
docker build -t billsplitter-server -f server/Dockerfile server
docker run -d \
  -p 8080:8080 \
  -v billsplitter-data:/data \
  -e DB_PATH=/data/billsplitter.db \
  -e IMAGE_DIR=/data/images \
  -e ALLOWED_ORIGINS=https://billsplitter.example.com \
  -e ADMIN_TOKEN=change-me-to-a-real-secret \
  -e OPENROUTER_API_KEY=sk-or-v1-... \
  billsplitter-server
```

The `-v billsplitter-data:/data` volume is required — without it, both the
SQLite database and uploaded images vanish on every container recreate.

## Reverse proxy / TLS

The server only speaks plain HTTP. Terminate TLS in front of it — an nginx
example:

```nginx
server {
    listen 443 ssl;
    server_name billsplitter-api.example.com;

    ssl_certificate     /etc/letsencrypt/live/billsplitter-api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/billsplitter-api.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE (GET /api/sessions/{code}/events) needs buffering off and a
        # long-lived connection, or the stream will stall/hang.
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

### Caddy (recommended — automatic HTTPS)

Caddy gets you TLS with zero certbot/renewal setup. Install it from the
official apt repo (Ubuntu):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```caddyfile
billsplitter-api.example.com {
    reverse_proxy 127.0.0.1:8080 {
        # SSE (GET /api/sessions/{code}/events) needs the response streamed
        # as it's written, not buffered — Caddy's flush_interval -1 does
        # for the reverse proxy what nginx's proxy_buffering off does above.
        flush_interval -1
    }
}
```

```bash
sudo systemctl reload caddy
```

That's it — Caddy issues and renews the Let's Encrypt cert for you the
first time it sees a request for that hostname (it needs the DNS record
below to already resolve, and ports 80/443 open — see the firewall step).

Point the frontend at the deployed server by setting `VITE_LIVE_SERVER_URL`
(read by `src/lib/liveApi.ts` and `src/lib/receiptScan.ts`) at build time,
e.g. `VITE_LIVE_SERVER_URL=https://billsplitter-api.example.com`.

## Health check

`GET /healthz` returns `200 {"status":"ok","version":"..."}` with no auth
required — use it as the liveness/readiness probe for whatever's
supervising the process (systemd doesn't need one; container orchestrators
and load balancers do), and to check what build a running instance is on.

## Version

The binary embeds a version string, printed on startup (`log.Printf`) and
served at `GET /healthz`. It's `"dev"` unless set at build time via
`-ldflags`:

```bash
go build -ldflags "-X main.version=$(git describe --tags --always)" -o /opt/billsplitter/server ./cmd/server
```

Add the same `-ldflags` to the Docker build's `RUN CGO_ENABLED=0 go build ...`
step if you want versioned images.

## Data and cleanup

Sessions and their images are purged automatically ~48h after settlement
(or after 48h of inactivity if never settled) by the background job started
in `cmd/server/main.go`. There's no manual retention configuration beyond
`CLEANUP_INTERVAL_MINUTES` (how often the job runs, not the retention
window itself, which is fixed at 48h — see `internal/store/store.go`'s
`PurgeStaleSessions`).
