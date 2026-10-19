import { versions } from "@/lib/versions";

export const quickstartFetch = `mkdir -p headscale headplane
curl -o headscale/config.yaml https://raw.githubusercontent.com/juanfont/headscale/v${versions.headscale.example}/config-example.yaml
echo '[]' > headscale/extra-records.json`;

export const quickstartCompose = `services:
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "./Caddyfile:/etc/caddy/Caddyfile"
      - "caddy-data:/data"

  headscale:
    image: headscale/headscale:${versions.headscale.example}
    container_name: headscale
    restart: unless-stopped
    command: serve
    labels:
      me.tale.headplane.target: headscale
    volumes:
      - "./headscale:/etc/headscale"
      - "headscale-data:/var/lib/headscale"

  headplane:
    image: ghcr.io/tale/headplane:latest
    container_name: headplane
    restart: unless-stopped
    volumes:
      - "./headplane/config.yaml:/etc/headplane/config.yaml"
      - "./headscale:/etc/headscale"
      - "headplane-data:/var/lib/headplane"
      - "/var/run/docker.sock:/var/run/docker.sock"

volumes:
  caddy-data:
  headscale-data:
  headplane-data:
`;
