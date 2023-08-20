---
title: "Setup a HA Kubernetes cluster Part III - Load Balancer & Ingress with SSL"
date: 2023-10-03
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "traefik", "cert-manager", "longhorn"]
draft: true
---

{{< lead >}}
Be free from AWS/Azure/GCP by building a production grade On-Premise Kubernetes cluster on cheap VPS provider, fully GitOps managed, and with complete CI/CD tools 🎉
{{< /lead >}}

This is the **Part III** of more global topic tutorial. [Back to first part]({{< ref "/posts/10-build-your-own-kubernetes-cluster" >}}) for intro.

## Kubernetes cluster initialization with Terraform

For this part let's create a new Terraform project that will be dedicated to Kubernetes infrastructure provisioning. Start from scratch with a new empty folder and the following `main.tf` file then `terraform init`.

{{< highlight file="main.tf" >}}

```tf
terraform {
  backend "local" {}
}
```

{{</ highlight >}}

Let's begin with automatic upgrades management.

### CRD prerequisites

Before we go next steps, we need to install critical monitoring CRDs that will be used by many components for monitoring.

```sh
kubectl apply --server-side -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/v0.67.1/example/prometheus-operator-crd/monitoring.coreos.com_servicemonitors.yaml
kubectl apply --server-side -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/v0.67.1/example/prometheus-operator-crd/monitoring.coreos.com_podmonitors.yaml
```

### Automatic reboot

When OS kernel is upgraded, the system needs to be rebooted to apply it. This is a critical operation for a Kubernetes cluster as can cause downtime. To avoid this, we'll use [kured](https://github.com/kubereboot/kured) that will take care of cordon & drains before rebooting nodes one by one.

{{< highlight file="kured.tf" >}}

```tf
resource "helm_release" "kubereboot" {
  chart      = "kured"
  version    = "5.1.0"
  repository = "https://kubereboot.github.io/charts"

  name = "kured"
  namespace = "kube-system"

  set {
    name  = "configuration.period"
    value = "1m"
  }

  set {
    name  = "tolerations[0].effect"
    value = "NoSchedule"
  }

  set {
    name  = "tolerations[0].operator"
    value = "Exists"
  }
  
  set {
    name  = "metrics.create"
    value = "true"
  }
}
```

{{</ highlight >}}

After applying this with `terraform apply`, ensure that the `daemonset` is running on all nodes with `kg ds -n kube-system`.

`tolerations` will ensure all tainted nodes will receive the daemonset.

`metrics.create` will create a `servicemonitor` custom k8s resource that allow Prometheus to scrape all kured metrics. You can check it with `kg smon  -n kube-system -o yaml`. The monitoring subject will be covered in a future post, but let's be monitoring ready from the start.

You can test it by exec `touch /var/run/reboot-required` to a specific node.

### Automatic K3s upgrade

Now let's take care of K3s upgrade. We'll use [system-upgrade-controller](https://github.com/rancher/system-upgrade-controller). It will take care of upgrading K3s binary automatically on all nodes one by one.

However, as Terraform doesn't offer a proper way to apply a remote multi-document Yaml file natively, the simplest way is to sacrifice some GitOps by installing system-upgrade-controller manually.

{{< alert >}}
Don't push yourself get fully 100% GitOps everywhere if the remedy give far more code complexity. Sometimes a simple documentation of manual steps in README is better.
{{</ alert >}}

```sh
ka https://github.com/rancher/system-upgrade-controller/releases/latest/download/system-upgrade-controller.yaml
kg deploy -n system-upgrade
```

Next apply the following upgrade plans for servers and agents.

{{< highlight file="plans.tf" >}}

```tf
resource "kubernetes_manifest" "server_plan" {
  manifest = {
    apiVersion = "upgrade.cattle.io/v1"
    kind       = "Plan"
    metadata = {
      name      = "server-plan"
      namespace = "system-upgrade"
    }
    spec = {
      concurrency = 1
      cordon      = true
      nodeSelector = {
        matchExpressions = [
          {
            key      = "node-role.kubernetes.io/control-plane"
            operator = "Exists"
          }
        ]
      }
      tolerations = [
        {
          operator = "Exists"
          effect   = "NoSchedule"
        }
      ]
      serviceAccountName = "system-upgrade"
      upgrade = {
        image = "rancher/k3s-upgrade"
      }
      channel = "https://update.k3s.io/v1-release/channels/stable"
    }
  }
}

resource "kubernetes_manifest" "agent_plan" {
  manifest = {
    apiVersion = "upgrade.cattle.io/v1"
    kind       = "Plan"
    metadata = {
      name      = "agent-plan"
      namespace = "system-upgrade"
    }
    spec = {
      concurrency = 1
      cordon      = true
      nodeSelector = {
        matchExpressions = [
          {
            key      = "node-role.kubernetes.io/control-plane"
            operator = "DoesNotExist"
          }
        ]
      }
      tolerations = [
        {
          operator = "Exists"
          effect   = "NoSchedule"
        }
      ]
      prepare = {
        args  = ["prepare", "server-plan"]
        image = "rancher/k3s-upgrade"
      }
      serviceAccountName = "system-upgrade"
      upgrade = {
        image = "rancher/k3s-upgrade"
      }
      channel = "https://update.k3s.io/v1-release/channels/stable"
    }
  }
}
```

{{</ highlight >}}

{{< alert >}}
You may set the same channel as previous step for hcloud cluster creation.
{{</ alert >}}

## External access

Now it's time to expose our cluster to the outside world. We'll use Traefik as ingress controller and cert-manager for SSL certificates management.

### cert-manager

First we need to install cert-manager for proper distributed SSL management. First install CRDs manually.

```sh
ka https://github.com/cert-manager/cert-manager/releases/download/v1.12.3/cert-manager.crds.yaml
```

Then apply the following Terraform code.

{{< highlight file="cert-manager.tf" >}}

```tf
resource "kubernetes_namespace_v1" "cert_manager" {
  metadata {
    name = "cert-manager"
  }
}

resource "helm_release" "cert_manager" {
  chart      = "cert-manager"
  version    = "v1.12.3"
  repository = "https://charts.jetstack.io"

  name      = "cert-manager"
  namespace = kubernetes_namespace_v1.cert_manager.metadata[0].name

  set {
    name  = "prometheus.servicemonitor.enabled"
    value = true
  }
}
```

{{</ highlight >}}

{{< alert >}}
You can use `installCRDs` option to install CRDs automatically. But uninstall cert-manager will delete all associated resources including generated certificates. That's why I generally prefer to install CRDs manually.  
As always we enable `prometheus.servicemonitor.enabled` to allow Prometheus to scrape cert-manager metrics.
{{</ alert >}}

All should be ok with `kg deploy -n cert-manager`.

#### Wildcard certificate via DNS01

We'll use [DNS01 challenge](https://cert-manager.io/docs/configuration/acme/dns01/) to get wildcard certificate for our domain. This is the most convenient way to get a certificate for a domain without having to expose it to the outside world.

{{< alert >}}
You may use a DNS provider that is supported by cert-manager. Check the [list of supported providers](https://cert-manager.io/docs/configuration/acme/dns01/#supported-dns01-providers). But cert-manager is highly extensible, and you can easily add your own provider if needed with some efforts. Check [available contrib webhooks](https://cert-manager.io/docs/configuration/acme/dns01/#webhook).
{{</ alert >}}

### Traefik

* Traefik + cert-manager
* DNS configuration
* Dashboard traefik access
* Middlewares IP and auth

## 2nd check ✅

Our cluster is now perfectly securely accessible from outside with minimal setup needed for any new apps. Persistence is insured by Longhorn with replicated storage and Minio for S3 needs. The next important part is now to have a [working database for real world apps]({{< ref "/posts/13-build-your-own-kubernetes-cluster-part-4" >}}).
