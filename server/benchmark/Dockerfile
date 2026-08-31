# Image for local resource-capped benchmarking (1 CPU / 512MB via `docker
# run --cpus --memory`, see scripts/setup.sh). Build context is
# server/ (docker build -f benchmark/Dockerfile server/), not this
# directory. Not used for real deployment — server/DEPLOYMENT.md's
# systemd/Docker instructions are unaffected by this file.
FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server
RUN mkdir -p /appdata/data/images

FROM gcr.io/distroless/static-debian12
WORKDIR /app
COPY --from=build /server /app/server
COPY --from=build /appdata/data /app/data
ENV PORT=8080
ENV DB_PATH=/app/data/billsplitter.db
ENV IMAGE_DIR=/app/data/images
EXPOSE 8080
ENTRYPOINT ["/app/server"]
