# Multi-stage: build estático vía `expo export -p web` (app.json ya tiene
# "web": {"output": "static"}), servido en runtime por nginx (estático + reverse
# proxy a backend/martin — ver nginx.conf, son los únicos otros dos contenedores
# de la red docker `gota`, ninguno publica puerto propio).

FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Horneadas en el bundle en build-time (Expo no las lee en runtime) — mismo origin
# que sirve nginx, por eso son rutas relativas, no un dominio.
ARG EXPO_PUBLIC_API_BASE_URL=/api
ARG EXPO_PUBLIC_MAP_STYLE_URL=/map-style.production.json
ENV EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL} \
    EXPO_PUBLIC_MAP_STYLE_URL=${EXPO_PUBLIC_MAP_STYLE_URL}

RUN npx expo export -p web


FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
