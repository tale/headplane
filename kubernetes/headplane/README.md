# Headplane Helm Chart

Official Helm chart for deploying Headplane into Kubernetes. Distributed as an OCI artifact via GitHub Container Registry.

Headplane connects to an external Headscale instance. Deploy Headscale separately using its upstream chart or your own method.

## Getting Started

1. Fetch the default values:

```bash
helm show values oci://ghcr.io/tale/headplane > my-values.yaml
```

2. Set `headscale.url` to point to your Headscale service, configure OIDC if needed, and adjust any other overrides.

3. Install:

```bash
helm install headplane oci://ghcr.io/tale/headplane -f my-values.yaml -n headplane --create-namespace
```

## Features

- Dynamic naming via `_helpers.tpl` for multi-instance deployments
- Standard `app.kubernetes.io/*` labels on all resources
- `existingSecret` support for GitOps-managed credentials
- Toggleable ServiceAccount and RBAC creation
- HPA with CPU/memory utilization targets
- Liveness and readiness probes
- Resource requests/limits, nodeSelector, tolerations, affinity, topologySpreadConstraints

## Configuration

The following table lists the configurable parameters of the Headplane chart and their default values.

### General

| Parameter          | Description                                    | Default |
| ------------------ | ---------------------------------------------- | ------- |
| `nameOverride`     | Override the chart name used in resource names | `""`    |
| `fullnameOverride` | Override the fully qualified release name      | `""`    |
| `debug`            | Enable debug logging                           | `false` |

### Image

| Parameter          | Description                                | Default                  |
| ------------------ | ------------------------------------------ | ------------------------ |
| `image.repository` | Container image repository                 | `ghcr.io/tale/headplane` |
| `image.pullPolicy` | Image pull policy                          | `IfNotPresent`           |
| `image.tag`        | Image tag (defaults to chart `appVersion`) | `""`                     |
| `imagePullSecrets` | Docker registry secret names as an array   | `[]`                     |

### Headscale

| Parameter             | Description                                                    | Default |
| --------------------- | -------------------------------------------------------------- | ------- |
| `headscale.url`       | **Required.** Internal URL of your Headscale gRPC/API endpoint | `""`    |
| `headscale.publicUrl` | Public-facing Headscale URL shown in the UI                    | `""`    |

### Server

| Parameter                            | Description                                                  | Default           |
| ------------------------------------ | ------------------------------------------------------------ | ----------------- |
| `server.host`                        | Address the Headplane server binds to                        | `"0.0.0.0"`       |
| `server.port`                        | Port the Headplane server listens on                         | `3000`            |
| `server.cookieSecure`                | Set the `Secure` flag on session cookies                     | `true`            |
| `server.cookieSecret.value`          | Plaintext cookie signing secret (not recommended for GitOps) | `""`              |
| `server.cookieSecret.existingSecret` | Name of an existing Secret containing the cookie secret      | `""`              |
| `server.cookieSecret.secretKey`      | Key within the existing Secret                               | `"cookie-secret"` |

### Kubernetes Integration

| Parameter                                 | Description                                             | Default |
| ----------------------------------------- | ------------------------------------------------------- | ------- |
| `integration.kubernetes.enabled`          | Enable the Kubernetes integration in Headplane's config | `true`  |
| `integration.kubernetes.validateManifest` | Validate Kubernetes manifests on startup                | `true`  |

### OIDC Authentication

| Parameter                             | Description                                     | Default              |
| ------------------------------------- | ----------------------------------------------- | -------------------- |
| `oidc.enabled`                        | Enable OIDC authentication                      | `false`              |
| `oidc.issuerUrl`                      | OIDC issuer URL                                 | `""`                 |
| `oidc.clientId`                       | OIDC client ID                                  | `""`                 |
| `oidc.disableApiKeyLogin`             | Disable API key login when OIDC is enabled      | `false`              |
| `oidc.tokenEndpointAuthMethod`        | Token endpoint auth method                      | `client_secret_post` |
| `oidc.redirectUri`                    | OIDC redirect URI                               | `""`                 |
| `oidc.clientSecret.value`             | Plaintext OIDC client secret                    | `""`                 |
| `oidc.clientSecret.existingSecret`    | Existing Secret name for the OIDC client secret | `""`                 |
| `oidc.clientSecret.secretKey`         | Key within the existing Secret                  | `"client-secret"`    |
| `oidc.headscaleApiKey.value`          | Plaintext Headscale API key for OIDC flows      | `""`                 |
| `oidc.headscaleApiKey.existingSecret` | Existing Secret name for the Headscale API key  | `""`                 |
| `oidc.headscaleApiKey.secretKey`      | Key within the existing Secret                  | `"api-key"`          |

### Persistence

| Parameter                       | Description                                        | Default             |
| ------------------------------- | -------------------------------------------------- | ------------------- |
| `persistence.enabled`           | Enable persistent storage                          | `false`             |
| `persistence.accessModes`       | PVC access modes                                   | `["ReadWriteOnce"]` |
| `persistence.storage`           | PVC size                                           | `1Gi`               |
| `persistence.storageClassName`  | StorageClass name (empty uses cluster default)     | `""`                |
| `persistence.annotations`       | Additional PVC annotations                         | `{}`                |
| `persistence.emptyDirSizeLimit` | Size limit when persistence is disabled (emptyDir) | `500Mi`             |

### ServiceAccount & RBAC

| Parameter                    | Description                                            | Default |
| ---------------------------- | ------------------------------------------------------ | ------- |
| `serviceAccount.create`      | Create a ServiceAccount                                | `true`  |
| `serviceAccount.name`        | ServiceAccount name (generated from fullname if empty) | `""`    |
| `serviceAccount.annotations` | ServiceAccount annotations                             | `{}`    |
| `rbac.create`                | Create Role and RoleBinding for the ServiceAccount     | `true`  |

### Security Context

| Parameter                                | Description                            | Default   |
| ---------------------------------------- | -------------------------------------- | --------- |
| `securityContext.capabilities.drop`      | Linux capabilities to drop             | `["ALL"]` |
| `securityContext.readOnlyRootFilesystem` | Mount the root filesystem as read-only | `true`    |
| `podSecurityContext`                     | Pod-level security context             | `{}`      |

### Resources & Autoscaling

| Parameter                                    | Description                        | Default |
| -------------------------------------------- | ---------------------------------- | ------- |
| `resources`                                  | CPU/memory requests and limits     | `{}`    |
| `autoscaling.enabled`                        | Enable Horizontal Pod Autoscaler   | `false` |
| `autoscaling.minReplicas`                    | Minimum replica count              | `1`     |
| `autoscaling.maxReplicas`                    | Maximum replica count              | `5`     |
| `autoscaling.targetCPUUtilizationPercentage` | Target CPU utilization for scaling | `80`    |

### Probes

| Parameter                              | Description                                 | Default          |
| -------------------------------------- | ------------------------------------------- | ---------------- |
| `probes.liveness.enabled`              | Enable liveness probe                       | `true`           |
| `probes.liveness.path`                 | HTTP path for liveness checks               | `/admin/healthz` |
| `probes.liveness.port`                 | Named port for liveness checks              | `app`            |
| `probes.liveness.initialDelaySeconds`  | Delay before first liveness check           | `10`             |
| `probes.liveness.periodSeconds`        | Interval between liveness checks            | `30`             |
| `probes.liveness.timeoutSeconds`       | Timeout for each liveness check             | `5`              |
| `probes.liveness.failureThreshold`     | Consecutive failures before restart         | `3`              |
| `probes.readiness.enabled`             | Enable readiness probe                      | `true`           |
| `probes.readiness.path`                | HTTP path for readiness checks              | `/admin/healthz` |
| `probes.readiness.port`                | Named port for readiness checks             | `app`            |
| `probes.readiness.initialDelaySeconds` | Delay before first readiness check          | `5`              |
| `probes.readiness.periodSeconds`       | Interval between readiness checks           | `10`             |
| `probes.readiness.timeoutSeconds`      | Timeout for each readiness check            | `3`              |
| `probes.readiness.failureThreshold`    | Consecutive failures before marking unready | `3`              |

### Scheduling

| Parameter                   | Description                                      | Default |
| --------------------------- | ------------------------------------------------ | ------- |
| `nodeSelector`              | Node labels for pod assignment                   | `{}`    |
| `tolerations`               | Tolerations for pod scheduling                   | `[]`    |
| `affinity`                  | Affinity rules for pod scheduling                | `{}`    |
| `topologySpreadConstraints` | Topology spread constraints for pod distribution | `[]`    |

### Ingress

| Parameter             | Description                      | Default |
| --------------------- | -------------------------------- | ------- |
| `ingress.enabled`     | Enable Ingress resource creation | `false` |
| `ingress.className`   | IngressClass name                | `""`    |
| `ingress.annotations` | Ingress annotations              | `{}`    |
| `ingress.hosts`       | Ingress host rules               | `[]`    |
| `ingress.tls`         | Ingress TLS configuration        | `[]`    |

### Miscellaneous

| Parameter        | Description                                                        | Default |
| ---------------- | ------------------------------------------------------------------ | ------- |
| `podAnnotations` | Additional annotations added to pods                               | `{}`    |
| `hostAliases`    | Host aliases injected into the pod's `/etc/hosts`                  | `[]`    |
| `extraObjects`   | Arbitrary extra Kubernetes manifests to deploy alongside the chart | `[]`    |

## Storage

Persistent storage is disabled by default. Enable `persistence.enabled` in your values for production environments to avoid data loss on pod restarts.

## Testing

After installation, verify the deployment with:

```bash
helm test headplane -n headplane
```
