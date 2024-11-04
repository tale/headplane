FROM node:20-alpine AS build
WORKDIR /app

RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build
RUN pnpm prune --prod

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/build /app/build
COPY --from=build /app/server.mjs /app/server.mjs
COPY --from=build /app/node_modules /app/node_modules
RUN echo '{"type":"module"}' > /app/package.json

EXPOSE 3000
ENV NODE_ENV=production
ENV HOST=0.0.0.0
CMD [ "./server.mjs" ]
