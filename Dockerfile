FROM --platform=$BUILDPLATFORM jdxcode/mise:latest AS mise-context
COPY mise.toml .tool-versions ./

ARG MISE_GITHUB_TOKEN
ENV MISE_GITHUB_TOKEN=${MISE_GITHUB_TOKEN:-}
RUN mise install

FROM --platform=$BUILDPLATFORM mise-context AS go-build
WORKDIR /build/

COPY go.mod go.sum ./
RUN go mod download

COPY cmd/ ./cmd/
COPY internal/ ./internal/

ARG TARGETOS
ARG TARGETARCH
ARG IMAGE_TAG
RUN mkdir -p /build/app/ && \
	GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 IMAGE_TAG=$IMAGE_TAG \
	mise run wasm ::: agent ::: fake-shell

RUN chmod +x /build/build/hp_agent
RUN chmod +x /build/build/sh

FROM --platform=$BUILDPLATFORM mise-context AS js-build
WORKDIR /build
COPY patches ./patches
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN mise trust
COPY --from=go-build /build/app/hp_ssh.wasm /build/app/hp_ssh.wasm
COPY --from=go-build /build/app/wasm_exec.js /build/app/wasm_exec.js
RUN pnpm run build
RUN mkdir -p /var/lib/headplane/agent

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS final
COPY --from=js-build --chown=nonroot:nonroot /build/build/ /app/build/
COPY --from=js-build --chown=nonroot:nonroot /build/drizzle /app/drizzle/
COPY --from=js-build --chown=nonroot:nonroot /var/lib/headplane /var/lib/headplane
COPY --from=js-build --chown=nonroot:nonroot /build/node_modules/ /app/node_modules/
COPY --from=go-build --chown=nonroot:nonroot /build/build/hp_agent /usr/libexec/headplane/agent

# Fake shell to inform the user that they should use the debug image
COPY --from=go-build --chown=nonroot:nonroot /build/build/sh /bin/sh
COPY --from=go-build --chown=nonroot:nonroot /build/build/sh /bin/bash

WORKDIR /app
CMD [ "/app/build/server/index.js" ]

FROM node:22-alpine AS debug-shell
RUN apk add --no-cache bash curl git

COPY --from=js-build --chown=nonroot:nonroot /build/build/ /app/build/
COPY --from=js-build --chown=nonroot:nonroot /build/drizzle /app/drizzle/
COPY --from=js-build --chown=nonroot:nonroot /var/lib/headplane /var/lib/headplane
COPY --from=js-build --chown=nonroot:nonroot /build/node_modules/ /app/node_modules/
COPY --from=go-build --chown=nonroot:nonroot /build/build/hp_agent /usr/libexec/headplane/agent

WORKDIR /app
CMD [ "node", "/app/build/server/index.js" ]
