import { versions } from "@/lib/versions";

// Compose examples for the configuration pages. They live here rather than
// inline because MDX strips indentation from multi-line expressions.

export const dockerCompose = `services:
  headplane:
    image: ghcr.io/tale/headplane:latest
    container_name: headplane
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - "/path/to/headplane/config.yaml:/etc/headplane/config.yaml"
      - "/path/to/data/storage:/var/lib/headplane"

      # Headscale's config file. The path inside this container must match
      # \`headscale.config_path\` in Headplane's config.
      - "/path/to/headscale/config.yaml:/etc/headscale/config.yaml"

      # To edit DNS records, mount the file from Headscale's
      # dns.extra_records_path too. If the path in this container differs,
      # set \`headscale.dns_records_path\` in Headplane's config.
      - "/path/to/headscale/dns_records.json:/etc/headscale/dns_records.json"

      # The Docker socket (or a socket proxy), used to restart Headscale
      - "/var/run/docker.sock:/var/run/docker.sock"
  headscale:
    image: headscale/headscale:${versions.headscale.example}
    container_name: headscale
    restart: unless-stopped
    command: serve
    labels:
      # How Headplane finds the Headscale container
      me.tale.headplane.target: headscale
    ports:
      - "8080:8080"
    volumes:
      # The same files, at the same paths, as in Headplane's container
      - "/path/to/headscale/config.yaml:/etc/headscale/config.yaml"
      - "/path/to/headscale/dns_records.json:/etc/headscale/dns_records.json"

      - "/path/to/headscale/data/storage:/var/lib/headscale"
`;

export const traefikCompose = `services:
  headplane:
    image: ghcr.io/tale/headplane:latest
    container_name: headplane
    restart: unless-stopped
    volumes:
      - "/path/to/headplane/config.yaml:/etc/headplane/config.yaml"
      - "/path/to/data/storage:/var/lib/headplane"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.headplane.rule=Host(\`headscale.example.com\`) && PathPrefix(\`/admin\`)"
      - "traefik.http.routers.headplane.entrypoints=websecure"
      - "traefik.http.routers.headplane.tls=true"
      - "traefik.http.services.headplane.loadbalancer.server.port=3000"

  headscale:
    image: headscale/headscale:${versions.headscale.example}
    container_name: headscale
    restart: unless-stopped
    command: serve
    volumes:
      - "/path/to/headscale/config.yaml:/etc/headscale/config.yaml"
      - "/path/to/headscale/data/storage:/var/lib/headscale"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.headscale.rule=Host(\`headscale.example.com\`)"
      - "traefik.http.routers.headscale.entrypoints=websecure"
      - "traefik.http.routers.headscale.tls=true"
      - "traefik.http.services.headscale.loadbalancer.server.port=8080"

      # Optional: send visitors at / to Headplane
      - "traefik.http.routers.root.rule=Host(\`headscale.example.com\`) && Path(\`/\`)"
      - "traefik.http.routers.root.entrypoints=websecure"
      - "traefik.http.routers.root.tls=true"
      - "traefik.http.routers.root.middlewares=to-admin"
      - "traefik.http.middlewares.to-admin.redirectregex.regex=^(https?://[^/]+)/$$"
      - "traefik.http.middlewares.to-admin.redirectregex.replacement=$\${1}/admin/"

  traefik:
    image: traefik:v3.0
    container_name: traefik
    restart: unless-stopped
    command:
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.websecure.address=:443"
    ports:
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
`;
