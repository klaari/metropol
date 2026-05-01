FROM oven/bun:1 AS base
WORKDIR /app

# System deps + Node.js 20 (for bgutil PO Token provider) + yt-dlp + bgutil plugin
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 python3-pip ffmpeg curl gnupg git && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y --no-install-recommends nodejs && curl -L https://github.com/yt-dlp/yt-dlp/releases/download/2026.03.17/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp && python3 -m pip install --break-system-packages -U bgutil-ytdlp-pot-provider && git clone --depth 1 --single-branch --branch 1.3.1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil && cd /opt/bgutil/server && npm ci && npx tsc && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY package.json turbo.json ./
COPY packages/db/ packages/db/
COPY packages/types/ packages/types/
COPY apps/api/ apps/api/

RUN bun install

RUN mkdir -p /tmp/metropol-downloads

EXPOSE 3000

CMD ["bun", "run", "apps/api/src/index.ts"]
