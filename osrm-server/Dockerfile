# OSRM Server for Turkey - Railway Deployment
# Multi-stage build to keep final image small

FROM ghcr.io/project-osrm/osrm-backend:latest AS builder

WORKDIR /data

# Download Turkey OSM data from Geofabrik (Alpine uses apk, not apt-get)
RUN apk add --no-cache wget && \
    wget -q https://download.geofabrik.de/europe/turkey-latest.osm.pbf -O turkey.osm.pbf

# Extract and prepare data for car routing
RUN osrm-extract -p /opt/car.lua turkey.osm.pbf && \
    osrm-partition turkey.osrm && \
    osrm-customize turkey.osrm

# Final runtime image
FROM ghcr.io/project-osrm/osrm-backend:latest

WORKDIR /data

# Copy processed data from builder
COPY --from=builder /data/turkey.osrm* ./

# Expose port
EXPOSE 5000

# Install curl for healthcheck
RUN apk add --no-cache curl

# Health check - OSRM doesn't have /health, use a simple route query
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD curl -sf "http://localhost:5000/route/v1/driving/32.8597,39.9334;29.0121,41.0082?overview=false" || exit 1

# Run OSRM with MLD algorithm (faster)
CMD ["osrm-routed", "--algorithm", "mld", "--max-table-size", "10000", "/data/turkey.osrm"]
