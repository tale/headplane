FROM golang:1.24 AS agent-build
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY agent/ ./agent
RUN CGO_ENABLED=0 GOOS=linux go build \
	-trimpath \
	-ldflags "-s -w" \
	-o /app/hp_agent ./agent/cmd/hp_agent

FROM node:22-alpine AS build
WORKDIR /app

RUN npm install -g pnpm@10
RUN apk add --no-cache git
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM node:22-alpine
RUN apk add --no-cache ca-certificates
RUN mkdir -p /var/lib/headplane
RUN mkdir -p /usr/libexec/headplane
RUN mkdir -p /var/lib/headplane/agent

WORKDIR /app
COPY --from=build /app/build /app/build
COPY --from=agent-build /app/hp_agent /usr/libexec/headplane/agent
RUN chmod +x /usr/libexec/headplane/agent
CMD [ "node", "./build/server/index.js" ]
