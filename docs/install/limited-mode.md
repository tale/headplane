---
title: Limited Mode
description: Install Headplane in Limited Mode.
---

# Limited Mode

::: warning
**Limited Mode is not recommended for production use.**
Please consider using one of the other installation methods for a production
deployment. Limited mode lacks advanced features such as network management,
remote web SSH, and more.
:::

Limited Mode is good for users who want to test out the *basic* functionality
provided by Headplane. It only interacts with the Headplane API and lacks all
advanced features, making it suitable for local testing and development.

## Prerequisites
- Docker (and optionally Docker Compose)
- Headscale version 0.26.0 or later installed and running
- A [completed configuration file](/index.md#configuration) for Headplane. 

## Installation
::: tip
If you want to test Limited Mode without Docker, you can follow the
[Native Mode](./native-mode.md) installation guide and simply avoid setting
up any of the advanced features.
:::

Running Headplane in Limited Mode is as simple as running 1 command:
```bash
docker run -d \
    -p 3000:3000 \
    -v /path/to/your/config.yaml:/etc/headplane/config.yaml \
    -v /path/to/data/storage:/var/lib/headplane \
    --name headplane
    --restart unless-stopped
    ghcr.io/tale/headplane:latest
```

It's important to mount your configuration file and also provide a persistent
storage location for Headplane to store its own data. You can also change the
port mapping if you want to run it on a different port.

<details>
<summary>Example Docker Compose configuration</summary>

```yaml
services:
  headplane:
    image: ghcr.io/tale/headplane:latest
    container_name: headplane
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - '/path/to/your/config.yaml:/etc/headplane/config.yaml'
      - '/path/to/data/storage:/var/lib/headplane'
```
</details>

## Accessing Headplane

After starting the container, you can access the Headplane web interface by
navigating to `http://localhost:3000/admin` in your web browser (replace
`localhost` with your server's IP address or domain name if not running locally).

In order to log in, you'll need to supply a Headscale API key. You can create
one by running the following command within your Headscale environment:

```bash
# You may want to tweak the expiration duration as needed
headscale apikeys create --expiration 90d
```

Limited Mode is intended for testing and development purposes, so please avoid
using it in a production environment. For production deployments, consider using
one of the other installation methods that will provide both the advanced
features of Headplane and a more robust deployment.

Limited Mode also technically supports
[Single Sign-On (SSO) authentication](../features/sso.md), but some parts of it
may not work as expected. For a full-featured experience with SSO, please use
one of the other installation methods.

