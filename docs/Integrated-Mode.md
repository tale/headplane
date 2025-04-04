# Integrated Mode

<picture>
    <source
        media="(prefers-color-scheme: dark)"
        srcset="../assets/dns-dark.png"
    >
    <source
        media="(prefers-color-scheme: light)"
        srcset="../assets/dns-light.png"
    >
    <img
        alt="Integration Preview"
        src="../assets/dns-dark.png"
    >
</picture>

Integrated mode is a deployment method that allows you to deploy Headplane with
automatic management of DNS and Headplane settings. This is the recommended
deployment method for most users, as it provides a more feature-complete
experience.

## Deployment
> If you are not looking to deploy with Docker, follow the [**Bare-Metal**](/docs/Bare-Metal.md) deployment guide.
> Refer to the `Integrated Mode` section at the bottom for caveats.

Requirements:
- Docker and Docker Compose
- Headscale 0.25 or newer
- A finished configuration file (config.yaml)

Here is what a sample Docker Compose deployment would look like:
```yaml
services:
  headplane:
    # I recommend you pin the version to a specific release
    image: ghcr.io/tale/headplane0.5.10:
    container_name: headplane
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - './config.yaml:/etc/headplane/config.yaml'
      # This should match headscale.config_path in your config.yaml
      - './headscale-config/config.yaml:/etc/headscale/config.yaml'

      # Headplane stores its data in this directory
      - './headplane-data:/var/lib/headplane'

      # If you are using the Docker integration, mount the Docker socket
      - '/var/run/docker.sock:/var/run/docker.sock:ro'
  headscale:
    image: headscale/headscale:0.25.1
    container_name: headscale
    restart: unless-stopped
    command: serve
    ports:
      - '8080:8080'
    volumes:
      - './headscale-data:/var/lib/headscale'
      - './headscale-config:/etc/headscale'

```

This will result in the Headplane UI being available at the `/admin` path of the
server you deployed it on. The `/admin` path is currently not configurable unless
you build the container yourself or run Headplane in Bare-Metal mode.

> Refer to the [**Configuration**](/docs/Configuration.md) guide for help with
> setting up your `config.yaml` file to the appropriate values.

## Docker Integration
The Docker integration is the easiest to setup, as it only requires the Docker socket
to be mounted into the container along with some configuration. As long as Headplane
has access to the Docker socket and the name of the Headscale container, it will
automatically propagate config and DNS changes to Headscale without any additional
configuration.

## Native Linux (/proc) Integration
The `proc` integration is used when you are running Headscale and Headplane on
non-Docker environments. Headplane will attempt to locate the Headscale process
PID through the `/proc` filesystem and communicate with it directly. In order for
this to work, the Headplane process must have permission to do the following:

- Read the `/proc` filesystem
- Send signals to the Headscale process (`SIGTERM`)

The best way to ensure this is to run Headplane as the same user as Headscale
(or optionally just run them both as `root`). Due to the way the integration is
currently configured, Headplane will not re-check the Headscale process PID if
it changes. This means that if you restart Headscale manually, you will need to
restart Headplane as well.

## Kubernetes Integration
The Kubernetes integration is the most complex to setup, as it requires a
service account with the appropriate permissions to be created. The service
account must have the following permissions and looks like this:
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: headplane-agent
  namespace: default # Adjust namespace as needed
rules:
- apiGroups: ['']
  resources: ['pods']
  verbs: ['get', 'list']
- apiGroups: ['apps']
  resources: ['deployments']
  verbs: ['get', 'list']
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: headplane-agent
  namespace: default # Adjust namespace as needed
roleRef:
    apiGroup: rbac.authorization.k8s.io
    kind: Role
    name: headplane-agent
subjects:
- kind: ServiceAccount
  name: default # If you use a different service account, change this
  namespace: default # Adjust namespace as needed
```

To successfully deploy Headplane in Kubernetes, you will need to run both the
Headplane and Headscale containers in the same pod. This is because Headplane
needs access to Headscale's PID in order to communicate with it. Here is an
example, note the **`shareProcessNamespace: true`** field:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: headplane
  namespace: default # Adjust namespace as needed
  labels:
    app: headplane
spec:
  replicas: 1
  selector:
    matchLabels:
      app: headplane
  template:
    metadata:
      labels:
        app: headplane
    spec:
      shareProcessNamespace: true
      serviceAccountName: default
      containers:
      - name: headplane
        image: ghcr.io/tale/headplane0.5.10:
        env:
        # Set these if the pod name for Headscale is not static
        # We will use the downward API to get the pod name instead
        - name: HEADPLANE_LOAD_ENV_OVERRIDES
          value: 'true'
        - name: 'HEADPLANE_INTEGRATION__KUBERNETES__POD_NAME'
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        volumeMounts:
        - name: headscale-config
          mountPath: /etc/headscale
        - name: headplane-data
          mountPath: /var/lib/headplane

      - name: headscale
        image: headscale/headscale:0.25.1
        command: ['serve']
        volumeMounts:
        - name: headscale-data
          mountPath: /var/lib/headscale
        - name: headscale-config
          mountPath: /etc/headscale

      volumes:
        - name: headscale-data
          persistentVolumeClaim:
            claimName: headscale-data
        - name: headplane-data
          persistentVolumeClaim:
            claimName: headplane-data
        - name: headscale-config
          persistentVolumeClaim:
            claimName: headscale-config
```
