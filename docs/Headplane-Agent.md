# Headplane Agent

The Headplane agent is a lightweight service that runs alongside the Headscale server.
It's used to interface with devices on your network locally, unlocking the following:

- **Node Information/Status**: View Tailscale versions, OS versions, and connection details.
- **SSH via Web (Soon)**: Connect to devices via SSH directly from the Headplane UI.

It's built on top of [tsnet](https://tailscale.com/kb/1244/tsnet), the official
set of libraries published by Tailscale for creating local services that can
join the tailnet.
While it isn't required to run the agent, it's highly recommended to get the
closest experience to the SaaS version of Tailscale. This is paired with the
integrations provided by Headplane to manage DNS and Headscale settings.

### Installation
The agent can either be ran as a standalone binary or as a Docker container.
Agent binaries are available on the [releases](https://github.com/tale/headplane/releases) page.
The Docker image is available through the `ghcr.io/tale/headplane-agent` tag.

The agent requires the following environment variables to be set:
- **`HP_AGENT_HOSTNAME`**: A hostname you want to use for the agent.
- **`HP_AGENT_TS_SERVER`**: The URL to your Headscale instance.
- **`HP_AGENT_TS_AUTHKEY`**: An authorization key to authenticate with Headscale (see below).
- **`HP_AGENT_HP_SERVER`**: The URL to your Headplane instance.
- **`HP_AGENT_HP_AUTHKEY`**: The generated auth key to authenticate with Headplane.

If you already have Headplane setup, you can generate all of these values within
the Headplane UI. Navigate to the `Settings` page and click `Agent` to get started.

HP_AGENT_HOSTNAME=headplane-agent
HP_AGENT_TS_SERVER=http://localhost:8080
#HP_AGENT_AUTH_KEY=3e0cd749021e5984267cde4b0a5a2ac32c1859e56f7911aa
HP_AGENT_TS_AUTHKEY=a4dab065c735cb4eae4f12804cf7e111206f9c7c9247c629
HP_AGENT_HP_SERVER=http://localhost:3000/admin
