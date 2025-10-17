---
title: Installation
description: Get started with Headplane.
---

# Installation

Headplane is designed to be deployed within several different environments to
ensure that it can seamlessly integrate into your existing infrastructure. First
set up your configuration file and then pick the installation method that best
suits your needs.

## Configuration
Headplane requires a configuration file to operate. A
[sample file](https://github.com/tale/headplane/blob/main/config.example.yaml)
is available to use as a starting point. Some of the important fields include:

| Field               | Description                                            |
|---------------------|--------------------------------------------------------|
| **`headscale.url`** | Point to your Headscale server (e.g., `http://headscale.example.com` or `http://headscale:8080` in Docker). |
| **`server.cookie_secret`** | Used to encrypt cookies. You can generate a random string using a command like `openssl rand -base64 32`. |
| **`server.data_path`** | Just a path to keep in mind, especially if you're using Docker. |
