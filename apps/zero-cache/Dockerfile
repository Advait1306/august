# Pin the Zero version at build time (defaults to latest if not provided)
ARG ZERO_VERSION=0.24.2025100900
FROM registry.hub.docker.com/rocicorp/zero:${ZERO_VERSION}

# Persist replica DB and related files
VOLUME ["/data"]

# Zero listens on 4848
EXPOSE 4848