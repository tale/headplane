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
RUN mkdir -p /var/lib/headplane

WORKDIR /app
COPY --from=build /app/build /app/build
CMD [ "node", "./build/server/index.js" ]
