FROM golang:1.23 AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY agent/ ./agent
RUN CGO_ENABLED=0 GOOS=linux go build \
	-trimpath \
	-ldflags "-s -w" \
	-o /app/hp_agent ./agent/cmd/hp_agent

FROM scratch
COPY --from=builder /app/hp_agent /hp_agent
ENTRYPOINT ["/hp_agent"]
