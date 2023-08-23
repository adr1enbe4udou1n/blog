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

You have 2 choices to install it, are we using Flux or Terraform ? Flux include a full documentation of [how to install it with](https://fluxcd.io/flux/guides/monitoring/).

But remember previous chapter with the house analogies. I personally consider monitoring as part of my infrastructure. And I prefer to keep all my infrastructure configuration in Terraform, and only use Flux for apps. Moreover, the Prometheus stack is a pretty big Helm chart, and upgrading it can be a bit tricky. So I prefer to have a full control of it with Terraform.

Go back to 2nd Terraform project and let's apply this pretty big boy:

{{< highlight host="demo-kube-k3s" file="prometheus.tf" >}}

```tf
resource "kubernetes_namespace_v1" "monitoring" {
  metadata {
    name = "monitoring"
  }
}

resource "helm_release" "kube_prometheus_stack" {
  chart      = "kube-prometheus-stack"
  version    = "48.3.3"
  repository = "https://prometheus-community.github.io/helm-charts"

  name      = "kube-prometheus-stack"
  namespace = kubernetes_namespace_v1.monitoring.metadata[0].name

  set {
    name  = "prometheus.prometheusSpec.retention"
    value = "15d"
  }

  set {
    name  = "prometheus.prometheusSpec.retentionSize"
    value = "5GB"
  }

  set {
    name  = "prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues"
    value = "false"
  }

  set {
    name  = "prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues"
    value = "false"
  }

  set {
    name  = "prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.accessModes[0]"
    value = "ReadWriteOnce"
  }

  set {
    name  = "prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage"
    value = "8Gi"
  }

  set {
    name  = "prometheus.prometheusSpec.tolerations[0].key"
    value = "node-role.kubernetes.io/storage"
  }

  set {
    name  = "prometheus.prometheusSpec.tolerations[0].operator"
    value = "Exists"
  }

  set {
    name  = "prometheus.prometheusSpec.nodeSelector\\.node-role\\.kubernetes\\.io/storage"
    type  = "string"
    value = "true"
  }

  set {
    name  = "alertmanager.enabled"
    value = "false"
  }

  set {
    name  = "grafana.enabled"
    value = "false"
  }

  set {
    name  = "grafana.forceDeployDatasources"
    value = "true"
  }

  set {
    name  = "grafana.forceDeployDashboards"
    value = "true"
  }
}
```

{{< /highlight >}}

The application is deployed in `monitoring` namespace. It can takes a few minutes to be fully up and running. You can check the status with `kgpo -n monitoring`.

Important notes :

* We set a retention of **15 days** and **5GB** of storage for Prometheus. Set this according to your needs.
* As we don't set any storage class, the default one will be used, which is `local-path` when using K3s. If you want to use longhorn instead and benefit of automatic monitoring backup, you can set it with `...volumeClaimTemplate.spec.storageClassName`. But don't forget to deploy Longhorn manager by adding monitor toleration.
* As it's a huge chart, I want to minimize dependencies by disabling Grafana, as I prefer manage it separately. However, in this case we must set `grafana.forceDeployDatasources` and `grafana.forceDeployDashboards` to `true` in order to benefit of all included Kubernetes dashboards and automatic Prometheus datasource injection, and deploy them to config maps that can be used for next Grafana install by provisioning.

And finally the ingress for external access:

{{< highlight host="demo-kube-k3s" file="prometheus.tf" >}}

```tf
//...

resource "kubernetes_manifest" "prometheus_ingress" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "IngressRoute"
    metadata = {
      name      = "prometheus"
      namespace = kubernetes_namespace_v1.monitoring.metadata[0].name
    }
    spec = {
      entryPoints = ["websecure"]
      routes = [
        {
          match = "Host(`prometheus.${var.domain}`)"
          kind  = "Rule"
          middlewares = [
            {
              name      = "middleware-ip"
              namespace = "traefik"
            },
            {
              name      = "middleware-auth"
              namespace = "traefik"
            }
          ]
          services = [
            {
              name = "prometheus-operated"
              port = 9090
            }
          ]
        }
      ]
    }
  }
}
```

{{< /highlight >}}

No go to `prometheus.kube.rocks`, after login you should access the Prometheus UI. Check under `/targets` that all targets are up and running. In previous chapters, because we have enabled monitoring for all our apps supporting metrics, you should see following available targets:

* 1 instance of Traefik
* 1 instance of cert-manager
* 1 instance of each PostgreSQL primary and read
* 2 instances of Redis
* 5 instances of Longhorn manager
* 1 instance of n8n

This is exactly how it works, the `ServiceMonitor` custom resource is responsible to discover and centralize all metrics for prometheus, allowing automatic discovery without touch the Prometheus config. Use `kg smon -A` to list them all.

### Monitoring Flux

There is one missing however, let's add monitoring for flux. Go back to flux project and push following manifests:

{{< highlight host="demo-kube-flux" file="clusters/demo/flux-add-ons/flux-monitoring.yaml" >}}

```yaml
---
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: flux-monitoring
  namespace: flux-system
spec:
  interval: 30m0s
  ref:
    branch: main
  url: https://github.com/fluxcd/flux2
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: monitoring-config
  namespace: flux-system
spec:
  interval: 1h0m0s
  path: ./manifests/monitoring/monitoring-config
  prune: true
  sourceRef:
    kind: GitRepository
    name: flux-monitoring
```

{{< /highlight >}}

The `spec.path` under `Kustomization` tells Flux to scrape [remote monitoring manifests](https://github.com/fluxcd/flux2/tree/main/manifests/monitoring/monitoring-config), avoiding us to write all of them manually. It includes the `PodMonitor` as well as Grafana dashboards.

{{< highlight host="demo-kube-flux" file="clusters/demo/flux-add-ons/kustomization.yaml" >}}

```yaml
# ...
resources:
  # ...
  - flux-monitoring.yaml
```

{{< /highlight >}}

After some minutes, flux should be appearing in Prometheus targets.

[![Prometheus targets](prometheus-targets.png)](prometheus-targets.png)

### Grafana

We have the basement of our monitoring stack, it's time to get a UI to visualize all these metrics. Grafana is the most popular tool for that, and it's also available as Helm chart. Prepare some variables:

{{< highlight host="demo-kube-k3s" file="main.tf" >}}

```tf
variable "smtp_host" {
  sensitive = true
}

variable "smtp_port" {
  type = string
}

variable "smtp_user" {
  type      = string
  sensitive = true
}

variable "smtp_password" {
  type      = string
  sensitive = true
}

variable "grafana_db_password" {
  type      = string
  sensitive = true
}
```

{{< /highlight >}}

Create `grafana` database through pgAdmin with same user and according `grafana_db_password`.

{{< highlight host="demo-kube-k3s" file="terraform.tfvars" >}}

```tf
smtp_host            = "smtp.mailgun.org"
smtp_port            = "587"
smtp_user            = "xxx"
smtp_password        = "xxx"
```

{{< /highlight >}}

Apply next configuration to Terraform project:

{{< highlight host="demo-kube-k3s" file="grafana.tf" >}}

```tf
resource "helm_release" "grafana" {
  chart      = "grafana"
  version    = "6.58.9"
  repository = "https://grafana.github.io/helm-charts"

  name      = "grafana"
  namespace = kubernetes_namespace_v1.monitoring.metadata[0].name

  set {
    name  = "serviceMonitor.enabled"
    value = "true"
  }

  set {
    name  = "sidecar.datasources.enabled"
    value = "true"
  }

  set {
    name  = "sidecar.dashboards.enabled"
    value = "true"
  }

  set {
    name  = "env.GF_SERVER_DOMAIN"
    value = var.domain
  }

  set {
    name  = "env.GF_SERVER_ROOT_URL"
    value = "https://grafana.${var.domain}"
  }

  set {
    name  = "env.GF_SMTP_ENABLED"
    value = "true"
  }

  set {
    name  = "env.GF_SMTP_HOST"
    value = "${var.smtp_host}:${var.smtp_port}"
  }

  set {
    name  = "env.GF_SMTP_USER"
    value = var.smtp_user
  }

  set {
    name  = "env.GF_SMTP_PASSWORD"
    value = var.smtp_password
  }

  set {
    name  = "env.GF_SMTP_FROM_ADDRESS"
    value = "grafana@${var.domain}"
  }

  set {
    name  = "env.GF_DATABASE_TYPE"
    value = "postgres"
  }

  set {
    name  = "env.GF_DATABASE_HOST"
    value = "postgresql-primary.postgres"
  }

  set {
    name  = "env.GF_DATABASE_NAME"
    value = "grafana"
  }

  set {
    name  = "env.GF_DATABASE_USER"
    value = "grafana"
  }

  set {
    name  = "env.GF_DATABASE_PASSWORD"
    value = var.grafana_db_password
  }
}

resource "kubernetes_manifest" "grafana_ingress" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "IngressRoute"
    metadata = {
      name      = "grafana"
      namespace = kubernetes_namespace_v1.monitoring.metadata[0].name
    }
    spec = {
      entryPoints = ["websecure"]
      routes = [
        {
          match = "Host(`grafana.${var.domain}`)"
          kind  = "Rule"
          services = [
            {
              name = "grafana"
              port = 80
            }
          ]
        }
      ]
    }
  }
}
```

{{< /highlight >}}

We enable both data source and dashboard sidecars by setting `sidecar.datasources.enabled` and `sidecar.dashboards.enabled`. These sidecars will automatically inject all dashboards and data sources from `ConfigMap`, like those provided by Prometheus stack and Flux. `serviceMonitor.enabled` will create a `ServiceMonitor` for Prometheus to scrape Grafana metrics.

Grafana should be deploying and migrate database successfully. Let's log in immediately after in `https://grafana.kube.rocks/login` with admin account. You can get the password with `kg secret -n monitoring grafana -o jsonpath='{.data.admin-password}' | base64 -d`.

### Native dashboards

If you go to `https://grafana.kube.rocks/dashboards`, you should see a many dashboards available that should already perfectly work, giving you a complete vision of :

* Some core components of K8s, like coredns, kube api server, all kubelets
* Detail of pods, namespace, workloads
* Nodes thanks to Node exporter
* Prometheus and Grafana itself stats
* Flux stats

{{< alert >}}
Some other core components like etcd, scheduler, proxy, and controller manager need to have metrics enabled to be scraped. See K3s docs or [this issue](https://github.com/k3s-io/k3s/issues/3619)
{{< /alert >}}

#### Prometheus

[![Prometheus](dashboards-prometheus.png)](dashboards-prometheus.png)

#### Nodes

[![Nodes](dashboards-nodes.png)](dashboards-nodes.png)

#### Cluster

[![Cluster compute](dashboards-cluster-compute.png)](dashboards-cluster-compute.png)
[![Cluster networks](dashboards-cluster-network.png)](dashboards-cluster-network.png)
[![Pods](dashboards-pods.png)](dashboards-pods.png)

#### Kube components

[![Kube API Server](dashboards-api-server.png)](dashboards-api-server.png)
[![Kubelets](dashboards-kubelets.png)](dashboards-kubelets.png)
[![CoreDNS](dashboards-coredns.png)](dashboards-coredns.png)

#### Flux

[![Flux](dashboards-flux.png)](dashboards-flux.png)

### Additional dashboards

You can easily import some additional dashboards by importing them from Grafana marketplace or include them in `ConfigMap` for automatic provisioning.

#### Traefik

[Link](https://grafana.com/grafana/dashboards/17346-traefik-official-standalone-dashboard/)

[![Traefik](dashboards-traefik.png)](dashboards-traefik.png)

#### cert-manager

[Link](https://github.com/monitoring-mixins/website/blob/master/assets/cert-manager/dashboards/cert-manager.json)

[![cert-manager](dashboards-cert-manager.png)](dashboards-cert-manager.png)

#### Longhorn

[Link](https://grafana.com/grafana/dashboards/16888-longhorn/)

[![Longhorn](dashboards-longhorn.png)](dashboards-longhorn.png)

## Logging with Loki

...

## 5th check ✅

We now have a full monitoring suite ! Go [next part]({{< ref "/posts/16-build-your-own-kubernetes-cluster-part-7" >}}) to add continuous integration stack.
