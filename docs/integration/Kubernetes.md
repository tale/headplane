## Kubernetes Integration

The Kubernetes integration allows you to run Headplane and Headscale together
in a cluster. It allows you to unlock full functionality such as automatic
reloading of ACLs, DNS management, and Headscale configuration management.

Currently there are a few limitations to the Kubernetes integration:
- Headplane and Headscale need to run in the same Pod and share the same
  process space for the integration to work correctly due to a limitation in
  the Kubernetes API.

- The only supported methods of deploying the integration are through a
  `Deployment` or `Pod` (more coming soon). You can still get around this with
  the `HEADSCALE_INTEGRATION_UNSTRICT` variable, but it's not recommended.

- The integration will assume that the Headscale container will always restart
  because the integration relies on a system call that will exit the container.

### Deployment

In order to ensure Headplane can read Kubernetes resources, you'll need to
grant additional RBAC permissions to the default `ServiceAccount` in the
namespace. This can be done with the following:
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

Keep in mind you'll need to make `PersistentVolumeClaim`s for the data and that
they need to be either `ReadWriteOnce` or `ReadWriteMany` depending on your
topology. Additionally, you can abstract environment variables and configuration
away into a `ConfigMap` or `Secret` for easier management.

The important parts of this deployment are the `HEADSCALE_INTEGRATION` and
`DEPLOYMENT_NAME` environment variables. The `HEADSCALE_INTEGRATION` variable
should be set to `kubernetes` and the `POST_NAME` variable should be set
to the name of the pod (done using the Downward API below).

> If you are having issues with validating `shareProcessNamespace`, you can
set `HEADSCALE_INTEGRATION_UNSTRICT` to `true` to disable the strict checks.

A basic deployment of the integration would look like this. Keep in mind that
you are responsible for setting up a reverse-proxy via an `Ingress` or `Service`
otherwise Headplane will not work:
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
        image: ghcr.io/tale/headplane:0.3.7
        env:
        - name: COOKIE_SECRET
          value: 'abcdefghijklmnopqrstuvwxyz'
        - name: HEADSCALE_INTEGRATION
          value: 'kubernetes'
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name

          # Only set this to false if you aren't behind a reverse proxy
        - name: COOKIE_SECURE
          value: 'false'
        volumeMounts:
        - name: headscale-config
          mountPath: /etc/headscale

      - name: headscale
        image: headscale/headscale:0.23.0
        command: ['serve']
        env:
        - name: TZ
          value: 'America/New_York'
        volumeMounts:
        - name: headscale-data
          mountPath: /var/lib/headscale
        - name: headscale-config
          mountPath: /etc/headscale

      volumes:
        - name: headscale-data
          persistentVolumeClaim:
            claimName: headscale-data
        - name: headscale-config
          persistentVolumeClaim:
            claimName: headscale-config
```

> For a breakdown of each configuration variable, please refer to the
[Configuration](/docs/Configuration.md) guide. 
> It explains what each variable does, how to configure them, and what the
default values are.
