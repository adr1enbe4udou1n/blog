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

### Automatic reboot

When OS kernel is upgraded, the system needs to be rebooted to apply it. This is a critical operation for a Kubernetes cluster as can cause downtime. To avoid this, we'll use [kured](https://github.com/kubereboot/kured) that will take care of cordon & drains before rebooting nodes one by one.

{{< highlight file="reboot.tf" >}}

```tf
resource "helm_release" "kubereboot" {
  chart      = "kured"
  version    = "5.1.0"
  repository = "https://kubereboot.github.io/charts"

  name = "kured"

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
}
```

{{</ highlight >}}

After applying this, you can check that the daemonset is running on all nodes with `kg ds`.

### Automatic K3s upgrade

kubectl apply -k github.com/rancher/system-upgrade-controller

## HTTP access

* Traefik + cert-manager
* DNS configuration
* Dashboard traefik access
* Middlewares IP and auth

## 2nd check ✅

Our cluster is now perfectly securely accessible from outside with minimal setup needed for any new apps. Persistence is insured by Longhorn with replicated storage and Minio for S3 needs. The next important part is now to have a [working database for real world apps]({{< ref "/posts/13-build-your-own-kubernetes-cluster-part-4" >}}).
