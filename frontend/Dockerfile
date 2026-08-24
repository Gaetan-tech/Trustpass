# --- Build : bundle Vite -------------------------------------------------
FROM node:20-slim AS build
WORKDIR /app
# API servie par nginx sous /api (proxifié vers le service backend).
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Runtime : nginx sert le SPA + proxy /api ----------------------------
FROM nginx:1.31-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
