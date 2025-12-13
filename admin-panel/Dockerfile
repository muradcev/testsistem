# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Cache buster - forces rebuild
ARG CACHEBUST=1

# Build arguments for environment variables
ARG VITE_API_URL
ARG VITE_WS_URL

# Set as environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code - cache busted by timestamp
COPY . .

# Force rebuild with cache bust arg
RUN echo "Build timestamp: $(date)" && npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
