# Headplane Helm Chart

## Overview
This Helm chart deploys [Headplane](https://github.com/tale/headplane) and [Headscale](https://github.com/juanfont/headscale) in a Kubernetes cluster. Headplane provides an interface to manage headscale instances, which is a Tailscale-compatible coordination server.

## Installation

### Prerequisites
- Kubernetes cluster
- Helm installed (`helm version`)

### Install the Chart
```sh
helm install headplane oci://harbor.lag0.com.br/library/headplane
```

### Upgrade the Chart
```sh
helm upgrade headplane oci://harbor.lag0.com.br/library/headplane
```

### Uninstall the Chart
```sh
helm uninstall headplane
```

## Configuration
This chart supports customization through the `values.yaml` file.

### Values

#### `headplane`
| Key | Description | Default |
|------|------------|---------|
| `image` | Headplane container image | `ghcr.io/tale/headplane:0.6.0` |
| `config.server.host` | Server host | `0.0.0.0` |
| `config.server.port` | Server port | `3000` |
| `config.server.cookie_secure` | Use secure cookies | `true` |
| `config.headscale.url` | Headscale URL | `https://vpn.example.com` |
| `config.headscale.config_path` | Path to Headscale config | `/etc/headscale/config.yaml` |
| `config.headscale.config_strict` | Enable strict config mode | `true` |
| `config.integration.kubernetes.enabled` | Enable Kubernetes integration | `true` |
| `config.integration.kubernetes.validate_manifest` | Validate Kubernetes manifest | `true` |
| `config.integration.kubernetes.pod_name` | Headplane pod name | `headplane-0` |
| `config.oidc.issuer` | OIDC issuer URL | `https://your-oidc-issuer-url.com` |
| `config.oidc.disable_api_key_login` | Disable API key login | `true` |
| `config.oidc.token_endpoint_auth_method` | OIDC token auth method | `client_secret_post` |
| `config.oidc.redirect_uri` | OIDC redirect URI | `https://your-headplane-admin-domain.com/admin/oidc/callback` |
| `config.oidc.client_id` | OIDC Client ID | `REPLACE_IT_WITH_YOUR_OIDC_CLIENT_ID_FOR_HEADPLANE` |

#### `headplane.secret`
| Key | Description | Default |
|------|------------|---------|
| `name` | Secret name | `headplane-secret` |
| `create` | Whether to create the secret | `true` |
| `server.cookie_secret` | Cookie secret (if not provided, wil be generated and added to secret) | `` | 
| `oidc.client_secret` | OIDC client secret (optional) | `` |
| `oidc.headscale_api_key` | Headscale API key (optional) | `` |

#### `headscale.acl`
| Key | Description | Default |
|------|------------|---------|
| `acl` | Access Control List configuration in JSON format. Only applicable if headscale.config.policy.mode is file | `see values.yaml` |

Example ACL configuration:
```yaml
headscale:
  acl: |
    {
      "acls": [
        {
          "action": "accept",
          "src": ["user1@example.com", "user2@example.com"],
          "dst": ["host1:80", "host1:443"]
        }
      ]
    }
  config:
    policy:
      mode: file
```


## Using the Chart
1. Modify `values.yaml` with your settings.
2. Install or upgrade the Helm chart.
3. Check logs with `kubectl logs -l app=headplane`.

For further customization, refer to the Kubernetes documentation on ConfigMaps and Secrets.

## License
Copyright © 2025 antoniolago

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at:

```
http://www.apache.org/licenses/LICENSE-2.0
```

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
