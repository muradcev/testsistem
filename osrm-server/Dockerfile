# OSRM Server for Turkey - Railway Deployment
# Multi-stage build to keep final image small

FROM ghcr.io/project-osrm/osrm-backend:latest as builder

WORKDIR /data

# Download Turkey OSM data from Geofabrik
RUN apt-get update && apt-get install -y wget && \
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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run OSRM with MLD algorithm (faster)
CMD ["osrm-routed", "--algorithm", "mld", "--max-table-size", "10000", "/data/turkey.osrm"]
