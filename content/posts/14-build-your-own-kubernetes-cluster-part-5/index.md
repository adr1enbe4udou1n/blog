---
title: "Setup a HA Kubernetes cluster Part V - CD with Flux"
date: 2023-10-05
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "cd", "flux", "nocode", "n8n", "nocodb"]
draft: true
---

{{< lead >}}
Be free from AWS/Azure/GCP by building a production grade On-Premise Kubernetes cluster on cheap VPS provider, fully GitOps managed, and with complete CI/CD tools 🎉
{{< /lead >}}

This is the **Part V** of more global topic tutorial. [Back to first part]({{< ref "/posts/10-build-your-own-kubernetes-cluster" >}}) for intro.

## Flux

In GitOps world, 2 tools are in lead for CD in k8s : Flux and ArgoCD. As Flux is CLI first and more lightweight, it's my personal goto. You may ask why don't continue with actual k8s Terraform project ?

You already noted that by adding more and more Helm dependencies to terraform, the plan time is increasing, as well as the state file. So not very scalable.

It's the perfect moment to draw a clear line between **IaC** and **CD**. IaC is for infrastructure, CD is for application. So to resume our GitOps stack :

1. IaC for Hcloud cluster initialization (*the basement*) : **Terraform**
2. IaC for cluster configuration (*the walls*) : **Helm** through **Terraform**
3. CD for application deployment (*the furniture*) : **Flux**

{{< alert >}}
You can probably eliminate with some efforts the 2nd stack by using both `Kube-Hetzner`, which take care of ingress and storage, and using Flux directly for the remaining helms like database cluster. Or maybe you can also add custom helms to `Kube-Hetzner` ?  
But as it's increase complexity and dependencies problem, I prefer personally to keep a clear separation between the middle part and the rest, as it's more straightforward for me. Just a matter of taste 🥮
{{< /alert >}}

### Flux bootstrap

Create a dedicated Git repository for Flux somewhere, I'm using Github, which is just a matter of:

```sh
gh repo create demo-kube-flux --private --add-readme
gh repo clone demo-kube-flux
```

{{< alert >}}
Put `--add-readme` option to have a non-empty repo, otherwise Flux bootstrap will give you an error.
{{< /alert >}}

Let's back to `demo-kube-k3s` terraform project and add Flux bootstrap connected to above repository:

{{< highlight host="demo-kube-k3s" file="main.tf" >}}

```tf
terraform {
  //...

  required_providers {
    flux = {
      source = "fluxcd/flux"
    }
    github = {
      source = "integrations/github"
    }
  }
}

//...

variable "github_token" {
  sensitive = true
  type      = string
}

variable "github_org" {
  type = string
}

variable "github_repository" {
  type = string
}
```

{{< /highlight >}}

{{< highlight host="demo-kube-k3s" file="flux.tf" >}}

```tf
github_org           = "mykuberocks"
github_repository    = "demo-kube-flux"
github_token         = "xxx"
```

{{< /highlight >}}

{{< alert >}}
Create a [Github token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) with repo permissions and add it to `github_token` variable.
{{< /alert >}}

{{< highlight host="demo-kube-k3s" file="flux.tf" >}}

```tf
provider "github" {
  owner = var.github_org
  token = var.github_token
}

resource "tls_private_key" "flux" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "github_repository_deploy_key" "this" {
  title      = "Flux"
  repository = var.github_repository
  key        = tls_private_key.flux.public_key_openssh
  read_only  = false
}

provider "flux" {
  kubernetes = {
    config_path = "~/.kube/config"
  }
  git = {
    url = "ssh://git@github.com/${var.github_org}/${var.github_repository}.git"
    ssh = {
      username    = "git"
      private_key = tls_private_key.flux.private_key_pem
    }
  }
}

resource "flux_bootstrap_git" "this" {
  path = "clusters/demo"

  components_extra = [
    "image-reflector-controller",
    "image-automation-controller"
  ]

  depends_on = [github_repository_deploy_key.this]
}
```

{{< /highlight >}}

Note as we'll use `components_extra` to add `image-reflector-controller` and `image-automation-controller` to Flux, as it will serve us later for new image tag detection.

After applying this, use `kg deploy -n flux-system` to check that Flux is correctly installed and running.

### Managing secrets

As always with GitOps, a secured secrets management is critical. Nobody wants to expose sensitive data in a git repository. An easy to go solution is to use [Bitnami Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets), which will deploy a dedicated controller in your cluster that will automatically decrypt sealed secrets.

Open `demo-kube-flux` project and create helm deployment for sealed secret.

{{< highlight host="demo-kube-flux" file="clusters/demo/flux-add-ons/sealed-secrets.yaml" >}}

```yaml
---
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: HelmRepository
metadata:
  name: sealed-secrets
  namespace: flux-system
spec:
  interval: 1h0m0s
  url: https://bitnami-labs.github.io/sealed-secrets
---
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: sealed-secrets
  namespace: flux-system
spec:
  chart:
    spec:
      chart: sealed-secrets
      reconcileStrategy: ChartVersion
      sourceRef:
        kind: HelmRepository
        name: sealed-secrets
      version: ">=2.12.0"
  interval: 1m
  releaseName: sealed-secrets-controller
  targetNamespace: flux-system
  install:
    crds: Create
  upgrade:
    crds: CreateReplace
```

{{< /highlight >}}

{{< alert >}}
Don't touch manifests under `flux-system` folder, as it's managed by Flux itself and overload on each flux bootstrap.
{{< /alert >}}

Then push it and check that sealed secret controller is correctly deployed with `kg deploy sealed-secrets-controller -n flux-system`.

Private key is automatically generated, so last step is to fetch the public key. Type this in project root to include it in your git repository:

```sh
kpf svc/sealed-secrets-controller -n flux-system 8080
curl http://localhost:8080/v1/cert.pem > pub-sealed-secrets.pem
```

{{< alert >}}
By the way install the client with `brew install kubeseal` (Mac / Linux) or `scoop install kubeseal` (Windows).
{{< /alert >}}

## Install some tools

It's now finally time to install some tools to help us in our CD journey.

### pgAdmin

A 1st good example is typically pgAdmin, which is a web UI for Postgres. We'll use it to manage our database cluster. It requires a local PVC to store its data user and settings.

{{< highlight host="demo-kube-flux" file="clusters/demo/postgres/deploy-pgadmin.yaml" >}}

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgadmin
  namespace: postgres
spec:
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: pgadmin
  template:
    metadata:
      labels:
        app: pgadmin
    spec:
      securityContext:
        runAsUser: 5050
        runAsGroup: 5050
        fsGroup: 5050
        fsGroupChangePolicy: "OnRootMismatch"
      containers:
        - name: pgadmin
          image: dpage/pgadmin4:latest
          ports:
            - containerPort: 80
          env:
            - name: PGADMIN_DEFAULT_EMAIL
              valueFrom:
                secretKeyRef:
                  name: pgadmin-auth
                  key: default-email
            - name: PGADMIN_DEFAULT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: pgadmin-auth
                  key: default-password
          volumeMounts:
            - name: pgadmin-data
              mountPath: /var/lib/pgadmin
      volumes:
        - name: pgadmin-data
          persistentVolumeClaim:
            claimName: pgadmin-data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pgadmin-data
  namespace: postgres
spec:
  resources:
    requests:
      storage: 128Mi
  volumeMode: Filesystem
  storageClassName: longhorn
  accessModes:
    - ReadWriteOnce
---
apiVersion: v1
kind: Service
metadata:
  name: pgadmin
  namespace: postgres
spec:
  selector:
    app: pgadmin
  ports:
    - port: 80
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: pgadmin
  namespace: postgres
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`pgadmin.kube.rocks`)
      kind: Rule
      middlewares:
        - name: middleware-ip
          namespace: traefik
      services:
        - name: pgadmin
          port: 80
```

{{< /highlight >}}

Here are the secrets to adapt to your needs:

{{< highlight host="demo-kube-flux" file="clusters/demo/postgres/secret-pgadmin.yaml" >}}

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: pgadmin-auth
  namespace: postgres
type: Opaque
data:
  default-email: YWRtaW5Aa3ViZS5yb2Nrcw==
  default-password: YWRtaW4=
```

{{< /highlight >}}

```sh
cat clusters/demo/postgres/secret-pgadmin.yaml | kubeseal --format=yaml --cert=pub-sealed-secrets.pem > clusters/demo/postgres/sealed-secret-pgadmin.yaml
rm clusters/demo/postgres/secret-pgadmin.yaml
```

{{< alert >}}
Don't forget to remove the original secret file before commit for obvious reason ! If too late, consider password leaked and regenerate a new one.  
You may use [VSCode extension](https://github.com/codecontemplator/vscode-kubeseal)
{{< /alert >}}

Wait few minutes, and go to `pgadmin.kube.rocks` and login with chosen credentials. Now try to register a new server with `postgresql-primary.postgres` as hostname, and the rest with your PostgreSQL credential on previous installation. It should work !

You can test the read replica too by register a new server using the hostname `postgresql-read.postgres`. Try to do some update on primary and check that it's replicated on read replica. Any modification on replicas should be rejected as well.

It's time to use some useful apps.

### n8n

Let's try some app that require a bit more configuration and real database connection with n8n, a workflow automation tool.

{{< highlight host="demo-kube-flux" file="clusters/demo/n8n/deploy-n8n.yaml" >}}

```yaml
apiVersion: apps/v1
kind: Namespace
metadata:
  name: n8n
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n8n
  namespace: n8n
spec:
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: n8n
  template:
    metadata:
      labels:
        app: n8n
    spec:
      containers:
        - name: n8n
          image: n8nio/n8n:latest
          ports:
            - containerPort: 5678
          env:
            - name: N8N_PROTOCOL
              value: https
            - name: N8N_HOST
              value: n8n.kube.rocks
            - name: N8N_PORT
              value: "5678"
            - name: NODE_ENV
              value: production
            - name: WEBHOOK_URL
              value: https://n8n.kube.rocks/
            - name: DB_TYPE
              value: postgresdb
            - name: DB_POSTGRESDB_DATABASE
              value: n8n
            - name: DB_POSTGRESDB_HOST
              value: postgresql-primary.postgres
            - name: DB_POSTGRESDB_USER
              value: n8n
            - name: DB_POSTGRESDB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: n8n-db
                  key: password
            - name: N8N_EMAIL_MODE
              value: smtp
            - name: N8N_SMTP_HOST
              value: smtp.mailgun.org
            - name: N8N_SMTP_PORT
              value: "587"
            - name: N8N_SMTP_USER
              valueFrom:
                secretKeyRef:
                  name: n8n-smtp
                  key: user
            - name: N8N_SMTP_PASS
              valueFrom:
                secretKeyRef:
                  name: n8n-smtp
                  key: password
            - name: N8N_SMTP_SENDER
              value: n8n@kube.rocks
          volumeMounts:
            - name: n8n-data
              mountPath: /home/node/.n8n
      volumes:
        - name: n8n-data
          persistentVolumeClaim:
            claimName: n8n-data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: n8n-data
  namespace: n8n
spec:
  resources:
    requests:
      storage: 1Gi
  volumeMode: Filesystem
  storageClassName: longhorn
  accessModes:
    - ReadWriteOnce
---
apiVersion: v1
kind: Service
metadata:
  name: n8n
  namespace: n8n
  labels:
    app: n8n
spec:
  selector:
    app: n8n
  ports:
    - port: 5678
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: n8n
  namespace: n8n
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`n8n.kube.rocks`)
      kind: Rule
      services:
        - name: n8n
          port: 5678
```

{{< /highlight >}}

Here are the secrets to adapt to your needs:

{{< highlight host="demo-kube-flux" file="clusters/demo/n8n/secret-n8n-db.yaml" >}}

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: n8n-db
  namespace: n8n
type: Opaque
data:
  password: YWRtaW4=
```

{{< /highlight >}}

{{< highlight host="demo-kube-flux" file="clusters/demo/n8n/secret-n8n-smtp.yaml" >}}

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: n8n-smtp
  namespace: n8n
type: Opaque
data:
  user: YWRtaW4=
  password: YWRtaW4=
```

{{< /highlight >}}

Before continue go to pgAdmin and create `n8n` DB and set `n8n` user with proper credentials as owner.

Then don't forget to seal secrets and remove original files the same way as pgAdmin. Once pushed, n8n should be deploying, automatically migrate the db, and soon after `n8n.kube.rocks` should be available, allowing you to create your 1st account.

### NocoDB

Let's try a final candidate with NocoDB, an Airtable-like generator for Postgres. It's very similar to n8n.

{{< highlight host="demo-kube-flux" file="clusters/demo/nocodb/deploy-nocodb.yaml" >}}

```yaml
apiVersion: apps/v1
kind: Namespace
metadata:
  name: nocodb
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nocodb
  namespace: nocodb
spec:
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: nocodb
  template:
    metadata:
      labels:
        app: nocodb
    spec:
      containers:
        - name: nocodb
          image: nocodb/nocodb:latest
          ports:
            - containerPort: 8080
          env:
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: nocodb-db
                  key: password
            - name: DATABASE_URL
              value: postgresql://nocodb:$(DB_PASSWORD)@postgresql-primary.postgres/nocodb
            - name: NC_AUTH_JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: nocodb-auth
                  key: jwt-secret
            - name: NC_SMTP_HOST
              value: smtp.mailgun.org
            - name: NC_SMTP_PORT
              value: "587"
            - name: NC_SMTP_USERNAME
              valueFrom:
                secretKeyRef:
                  name: nocodb-smtp
                  key: user
            - name: NC_SMTP_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: nocodb-smtp
                  key: password
            - name: NC_SMTP_FROM
              value: nocodb@kube.rocks
          volumeMounts:
            - name: nocodb-data
              mountPath: /usr/app/data
      volumes:
        - name: nocodb-data
          persistentVolumeClaim:
            claimName: nocodb-data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: nocodb-data
  namespace: nocodb
spec:
  resources:
    requests:
      storage: 1Gi
  volumeMode: Filesystem
  storageClassName: longhorn
  accessModes:
    - ReadWriteOnce
---
apiVersion: v1
kind: Service
metadata:
  name: nocodb
  namespace: nocodb
spec:
  selector:
    app: nocodb
  ports:
    - port: 8080
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: nocodb
  namespace: nocodb
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`nocodb.kube.rocks`)
      kind: Rule
      services:
        - name: nocodb
          port: 8080
```

{{< /highlight >}}

Here are the secrets to adapt to your needs:

{{< highlight host="demo-kube-flux" file="clusters/demo/nocodb/secret-nocodb-db.yaml" >}}

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nocodb-db
  namespace: nocodb
type: Opaque
data:
  password: YWRtaW4=
```

{{< /highlight >}}

{{< highlight host="demo-kube-flux" file="clusters/demo/nocodb/secret-nocodb-auth.yaml" >}}

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nocodb-auth
  namespace: nocodb
type: Opaque
data:
  jwt-secret: MDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAw
```

{{< /highlight >}}

{{< highlight host="demo-kube-flux" file="clusters/demo/nocodb/secret-nocodb-smtp.yaml" >}}

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nocodb-smtp
  namespace: nocodb
type: Opaque
data:
  user: YWRtaW4=
  password: YWRtaW4=
```

{{< /highlight >}}

The final process is identical to n8n.

## 4th check ✅

We now have a functional continuous delivery with some nice no-code tools to play with ! The final missing stack for a production grade cluster is to install a complete monitoring stack, this is the [next part]({{< ref "/posts/15-build-your-own-kubernetes-cluster-part-6" >}}).
