FROM --platform=$BUILDPLATFORM golang:1.25.1 AS go-base
WORKDIR /run

COPY go.mod go.sum build.sh ./
RUN go mod download

COPY cmd/ ./cmd/
COPY internal/ ./internal/

ARG TARGETOS
ARG TARGETARCH
ARG IMAGE_TAG
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 IMAGE_TAG=$IMAGE_TAG \
	./build.sh --wasm --agent --fake-shell --healthcheck \
		--wasm-output /bin/hp_ssh.wasm \
		--agent-output /bin/hp_agent \
		--fake-shell-output /bin/fake-sh \
		--healthcheck-output /bin/hp_healthcheck

RUN chmod +x /bin/hp_ssh.wasm
RUN chmod +x /bin/hp_agent
RUN chmod +x /bin/fake-sh
RUN chmod +x /bin/hp_healthcheck

# Folder needs to exist for later stages
RUN mkdir -p /var/lib/headplane/agent

FROM --platform=$BUILDPLATFORM node:22.16-slim AS js-base
WORKDIR /run

RUN corepack enable
COPY patches ./patches
COPY package.json pnpm-lock.yaml build.sh ./

COPY --from=go-base /bin/hp_ssh.wasm /run/app/hp_ssh.wasm
COPY --from=go-base /bin/wasm_exec.js /run/app/wasm_exec.js
RUN ./build.sh --app --app-install-only

COPY . .
RUN ./build.sh --app

FROM gcr.io/distroless/nodejs22-debian12:latest AS final
COPY --from=js-base /run/build /app/build
COPY --from=js-base /run/drizzle /app/drizzle
COPY --from=js-base /run/node_modules /app/node_modules

COPY --from=go-base /bin/hp_agent /usr/libexec/headplane/agent
COPY --from=go-base /var/lib/headplane /var/lib/headplane

# Fake shell to inform the user that they should use the debug image
COPY --from=go-base /bin/fake-sh /bin/sh
COPY --from=go-base /bin/fake-sh /bin/bash

COPY --from=go-base /bin/hp_healthcheck /bin/hp_healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
	CMD ["/bin/hp_healthcheck"]

WORKDIR /app
CMD [ "/app/build/server/index.js" ]

FROM node:22-alpine AS debug-shell
RUN apk add --no-cache bash curl

COPY --from=js-base /run/build /app/build
COPY --from=js-base /run/drizzle /app/drizzle
COPY --from=js-base /run/node_modules /app/node_modules

COPY --from=go-base /bin/hp_agent /usr/libexec/headplane/agent
COPY --from=go-base /var/lib/headplane /var/lib/headplane
COPY --from=go-base /bin/hp_healthcheck /bin/hp_healthcheck

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
	CMD ["/bin/hp_healthcheck"]

WORKDIR /app
CMD [ "node", "/app/build/server/index.js" ]
