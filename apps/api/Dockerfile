FROM oven/bun:1 AS base
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 ffmpeg curl && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json turbo.json ./
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY apps/api/package.json apps/api/

RUN bun install --frozen-lockfile

COPY packages/db/ packages/db/
COPY packages/types/ packages/types/
COPY apps/api/ apps/api/

RUN mkdir -p /tmp/metropol-downloads

EXPOSE 3000

CMD ["bun", "run", "apps/api/src/index.ts"]
