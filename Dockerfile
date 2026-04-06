FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY README.md ./README.md
COPY .env.example ./.env.example

EXPOSE 3000

CMD ["node", "--no-warnings", "src/server.js"]
