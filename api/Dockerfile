# Contexto de build: raíz del repo (necesita db/ para migraciones y seeds).
FROM node:20-alpine
ENV NODE_ENV=production DB_DIR=/app/db FILES_DIR=/data/files
WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY api/src ./src
COPY db ./db
# Volumen de archivos subidos: el volumen nombrado hereda estos permisos al crearse.
RUN mkdir -p /data/files && chown -R node:node /data
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
