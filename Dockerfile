FROM jdxcode/mise:latest AS mise-context
COPY mise.toml .
RUN mise install

FROM mise-context AS go-build
WORKDIR /build/

COPY go.mod go.sum ./
COPY cmd/ ./cmd/
COPY internal/ ./internal/
RUN mkdir -p /build/app/ && mise run wasm ::: agent
RUN chmod +x /build/build/hp_agent

FROM mise-context AS js-build
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

FROM gcr.io/distroless/nodejs22-debian12:nonroot
COPY --from=js-build --chown=nonroot:nonroot /build/build/ /app/build/
COPY --from=js-build --chown=nonroot:nonroot /build/drizzle /app/drizzle/
COPY --from=js-build --chown=nonroot:nonroot /var/lib/headplane /var/lib/headplane
COPY --from=js-build --chown=nonroot:nonroot /build/node_modules/ /app/node_modules/
COPY --from=go-build --chown=nonroot:nonroot /build/build/hp_agent /usr/libexec/headplane/agent

WORKDIR /app
CMD [ "/app/build/server/index.js" ]
