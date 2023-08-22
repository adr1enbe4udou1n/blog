---
title: "Setup a HA Kubernetes cluster Part VI - Monitoring and Logging Stack"
date: 2023-10-06
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "monitoring", "logging", "prometheus", "loki", "grafana"]
draft: true
---

{{< lead >}}
Be free from AWS/Azure/GCP by building a production grade On-Premise Kubernetes cluster on cheap VPS provider, fully GitOps managed, and with complete CI/CD tools 🎉
{{< /lead >}}

This is the **Part VI** of more global topic tutorial. [Back to first part]({{< ref "/posts/10-build-your-own-kubernetes-cluster" >}}) for intro.

## Monitoring

Monitoring is a critical part of any production grade platform. It allows you to be proactive and react before your users are impacted. It also helps get a quick visualization of cluster architecture and current usage.

### Monitoring node pool

As well as storage pool, creating a dedicated node pool for monitoring stack is a good practice in order to scale it separately from the apps.

You now have a good understanding of how to create a node pool, so apply next configuration from our 1st Terraform project:

{{< highlight host="demo-kube-hcloud" file="kube.tf" >}}

```tf
module "hcloud_kube" {
  //...

  agent_nodepools = [
    //...
    {
      name              = "monitor"
      server_type       = "cx21"
      location          = "nbg1"
      count             = 1
      private_interface = "ens10"
      labels = [
        "node.kubernetes.io/server-usage=monitor"
      ]
      taints = [
        "node-role.kubernetes.io/monitor:NoSchedule"
      ]
    }
  ]
}
```

{{< /highlight >}}

### Prometheus Stack

When using k8s, the standard de facto is to install [Prometheus stack](https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack). It includes all necessary CRDs and element for a proper monitoring stack.

Go back to 2nd Terraform project and apply next configuration:

{{< highlight host="demo-kube-k3s" file="prometheus.tf" >}}

```tf

```

{{< /highlight >}}

### Grafana

...

### Some dashboards

## Logging with Loki

...

## 5th check ✅

We now have a full monitoring suite ! Go [next part]({{< ref "/posts/16-build-your-own-kubernetes-cluster-part-7" >}}) to add continuous integration stack.
