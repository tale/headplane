import { versions } from "@/lib/versions";

// Compose examples for docker.mdx. They live here rather than inline because
// MDX strips indentation from multi-line expressions.

export const dockerCompose = `services:
  headplane:
    image: ghcr.io/tale/headplane:latest
    container_name: headplane
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      # Same as before
      - "/path/to/your/config.yaml:/etc/headplane/config.yaml"
      - "/path/to/data/storage:/var/lib/headplane"

      # A shared path to the Headscale config file. It is important that the
      # path you mount this on matches \`headscale.config_path\` in your
      # Headplane config.yaml file.
      - "/path/to/headscale/config.yaml:/etc/headscale/config.yaml"

      # If you are using dns.extra_records_path in Headscale (recommended),
      # also mount that file here so Headplane can read and write it. If the
      # in-container path differs from Headscale's dns.extra_records_path,
      # set \`headscale.dns_records_path\` in your Headplane config.yaml file.
      - "/path/to/headscale/dns_records.json:/etc/headscale/dns_records.json"

      # Read-only access to the Docker socket (or a proxy)
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
  headscale:
    image: headscale/headscale:${versions.headscale.example}
    container_name: headscale
    restart: unless-stopped
    command: serve
    labels:
      # This label is absolutely necessary to help Headplane find Headscale.
      me.tale.headplane.target: headscale
    ports:
      - "8080:8080"
    volumes:
      # Notice how these are on the exact same path as the host for both
      # Headscale and Headplane! This is very important.
      - "/path/to/headscale/config.yaml:/etc/headscale/config.yaml"
      - "/path/to/headscale/dns_records.json:/etc/headscale/dns_records.json"

      - "/path/to/headscale/data/storage:/var/lib/headscale"
`;

export const traefikCompose = `services:
  # Same as before
  headplane:
    image: ghcr.io/tale/headplane:latest
    container_name: headplane
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - "/path/to/your/config.yaml:/etc/headplane/config.yaml"
      - "/path/to/data/storage:/var/lib/headplane"
      - "/path/to/headscale/config.yaml:/etc/headscale/config.yaml"
      - "/path/to/headscale/dns_records.json:/etc/headscale/dns_records.json"
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
    labels:
      # Expose the admin UI at /admin
      - "traefik.enable=true"
      - "traefik.http.routers.headplane.rule=Host(\`headscale.example.com\`) && PathPrefix(\`/admin\`)"
      - "traefik.http.routers.headplane.entrypoints=websecure"
      - "traefik.http.routers.headplane.tls=true"
  headscale:
    image: headscale/headscale:${versions.headscale.example}
    container_name: headscale
    restart: unless-stopped
    command: serve
    ports:
      - "8080:8080"
    volumes:
      - "/path/to/headscale/config.yaml:/etc/headscale/config.yaml"
      - "/path/to/headscale/dns_records.json:/etc/headscale/dns_records.json"
      - "/path/to/headscale/data/storage:/var/lib/headscale"
    labels:
      - "me.tale.headplane.target=headscale"

      # Traefik labels to expose Headscale at headscale.example.com
      - "traefik.enable=true"
      - "traefik.http.routers.headscale.rule=Host(\`headscale.example.com\`)"
      - "traefik.http.routers.headscale.entrypoints=websecure"
      - "traefik.http.routers.headscale.tls=true"

      # This middleware is essential to ensuring Headplane works correctly
      - "traefik.http.routers.headscale.middlewares=cors"
      - "traefik.http.middlewares.cors.headers.accesscontrolallowheaders=*"
      - "traefik.http.middlewares.cors.headers.accesscontrolallowmethods=GET,POST,PUT"
      - "traefik.http.middlewares.cors.headers.accesscontrolalloworiginlist=https://headscale.example.com"
      - "traefik.http.middlewares.cors.headers.accesscontrolmaxage=100"
      - "traefik.http.middlewares.cors.headers.addvaryheader=true"

      # If you would optionally like to automatically redirect / to /admin
      - "traefik.http.routers.rewrite.rule=Host(\`headscale.example.com\`) && Path(\`/\`)"
      - "traefik.http.routers.rewrite.service=headscale"
      - "traefik.http.routers.rewrite.middlewares=rewrite"
      - "traefik.http.middlewares.rewrite.addprefix.prefix=/admin"

  traefik:
    image: traefik:v3.0
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      # Example volumes/setup, please configure Traefik as needed
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "/path/to/certs/storage:/certs"
`;
