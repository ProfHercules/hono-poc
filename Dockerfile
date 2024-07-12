FROM oven/bun:latest AS builder

WORKDIR /app

COPY . .

RUN bun install && bun run build

FROM gcr.io/distroless/nodejs22-debian12 AS runner

WORKDIR /app

COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/dist/index.js /app/dist/index.js

ENV PORT=8080

CMD ["dist/index.js"]