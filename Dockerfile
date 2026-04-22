# Multi-stage build for Google Cloud Run deployment
# Stage 1: Build the Vite React app
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json bun.lockb* ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run sets $PORT (default 8080); rewrite nginx to listen on it
RUN sed -i 's/listen       80;/listen       8080;/' /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
