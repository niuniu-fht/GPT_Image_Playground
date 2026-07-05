# ---- Build stage ----
ARG NODE_IMAGE=node:20-alpine
ARG NGINX_IMAGE=nginx:alpine
FROM ${NODE_IMAGE} AS build

WORKDIR /app

ENV VITE_DEFAULT_API_URL=__VITE_DEFAULT_API_URL_PLACEHOLDER__

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production stage ----
FROM ${NGINX_IMAGE}

COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/inject-api-url.sh /docker-entrypoint.d/40-inject-api-url.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-inject-api-url.sh && chmod +x /docker-entrypoint.d/40-inject-api-url.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
