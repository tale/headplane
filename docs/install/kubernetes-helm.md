# Helm Chart Installation

Headplane provides an official Helm chart distributed as an OCI artifact via GitHub Container Registry.

## Pre-requisites

- A Kubernetes cluster (K3s, Talos, vanilla Kubernetes, etc.)
- Helm 3.0+ installed locally
- A running Headscale instance (deploy it separately using the [upstream Headscale chart](https://github.com/juanfont/headscale) or your own method)

## Installation

Pull the default values and customize them for your environment:

```bash
helm show values oci://ghcr.io/tale/headplane > my-values.yaml
```

At minimum, set `headscale.url` to point to your Headscale instance:

```yaml
headscale:
  url: "http://headscale.headscale.svc.cluster.local:8080"
  publicUrl: "https://headscale.example.com"
```

Then install the chart:

```bash
helm install headplane oci://ghcr.io/tale/headplane -f my-values.yaml -n headplane --create-namespace
```

## Configuration

The `values.yaml` file includes grouped comments explaining each section. Key configuration areas:

- **headscale**: Connection URL to your existing Headscale instance (required)
- **server**: Bind address, port, and cookie settings
- **oidc**: Optional OIDC authentication provider configuration
- **persistence**: Toggle persistent storage for Headplane's data directory
- **serviceAccount / rbac**: Toggle creation of ServiceAccount and RBAC resources, or provide your own
- **probes**: Liveness and readiness probe configuration
- **autoscaling**: HPA with CPU/memory utilization targets
- **resources**: Container CPU/memory requests and limits
- **nodeSelector / tolerations / affinity**: Pod scheduling constraints
- **securityContext / podSecurityContext**: Container and pod security policies

### OIDC Example

```yaml
oidc:
  enabled: true
  issuerUrl: "https://your.oidc.issuer.url"
  clientId: "headplane-client"
  clientSecret:
    value: "my-oidc-secret"
```

### Using Existing Secrets (GitOps)

If you manage secrets externally (e.g., via Sealed Secrets, External Secrets Operator, or SOPS), reference them with `existingSecret` instead of providing plain values:

```yaml
server:
  cookieSecret:
    existingSecret: "my-cookie-secret"
    secretKey: "cookie-secret"

oidc:
  enabled: true
  clientSecret:
    existingSecret: "my-oidc-secret"
    secretKey: "client-secret"
  headscaleApiKey:
    existingSecret: "my-headscale-apikey"
    secretKey: "api-key"
```

### Autoscaling

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 75
```

## Upgrades

```bash
helm upgrade headplane oci://ghcr.io/tale/headplane -f my-values.yaml -n headplane
```

## Verification

After installation, verify the deployment with:

```bash
helm test headplane -n headplane
```
