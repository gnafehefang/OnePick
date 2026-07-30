FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
RUN apk add --no-cache python3 py3-pip ffmpeg ca-certificates chromium nss freetype harfbuzz ttf-freefont \
  && python3 -m venv /opt/yt-dlp \
  && /opt/yt-dlp/bin/pip install --no-cache-dir yt-dlp \
  && ln -s /opt/yt-dlp/bin/yt-dlp /usr/local/bin/yt-dlp
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
EXPOSE 3000
CMD ["npm", "start"]
