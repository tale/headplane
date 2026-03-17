FROM mcr.microsoft.com/devcontainers/base:bookworm

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential libnss3-tools mkcert pkg-config && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
