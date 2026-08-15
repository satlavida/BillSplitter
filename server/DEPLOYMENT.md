# Deploying the live-collaboration server

This is the optional Go backend behind BillSplitter's "Go Live" feature
(planv3.md Phase 3). The frontend is fully functional without it — nothing
here is required to use BillSplitter locally or as a static site. Deploy it
only if you want the live join/claim/settle flow to work for real users.

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
| `ADMIN_TOKEN` | *(empty)* | Bearer token gating `/admin` and `/admin/stats` (session list, purge, basic stats). Leaving it empty disables the admin panel entirely (`403` on every admin route) rather than leaving it open — **set a real value if you want the panel**, and treat it as a secret. |
| `CLEANUP_INTERVAL_MINUTES` | `30` | How often the background job purges settled/idle sessions past their 48h grace period (planv3.md 3.8). |

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
# Prefer an EnvironmentFile for secrets instead of inlining them here:
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

Point the frontend at the deployed server by setting `VITE_LIVE_SERVER_URL`
(read by `src/lib/liveApi.ts`) at build time, e.g.
`VITE_LIVE_SERVER_URL=https://billsplitter-api.example.com`.

## Health check

`GET /healthz` returns `200 ok` with no auth required — use it as the
liveness/readiness probe for whatever's supervising the process (systemd
doesn't need one; container orchestrators and load balancers do).

## Data and cleanup

Sessions and their images are purged automatically ~48h after settlement
(or after 48h of inactivity if never settled) by the background job started
in `cmd/server/main.go`. There's no manual retention configuration beyond
`CLEANUP_INTERVAL_MINUTES` (how often the job runs, not the retention
window itself, which is fixed at 48h — see `internal/store/store.go`'s
`PurgeStaleSessions`).
