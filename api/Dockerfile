# Contexto de build: raíz del repo (necesita db/ para migraciones y seeds).
FROM node:20-alpine
ENV NODE_ENV=production DB_DIR=/app/db
WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY api/src ./src
COPY db ./db
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
