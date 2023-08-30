---
title: "A beautiful GitOps day - Build your self-hosted Kubernetes cluster"
date: 2023-08-18
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes"]
---

{{< lead >}}
Use GitOps workflow for building a production grade on-premise Kubernetes cluster on cheap VPS provider, with complete CI/CD 🎉
{{< /lead >}}

## The goal 🎯

This guide is mainly intended for any developers or some SRE who want to build a Kubernetes cluster that respect following conditions:

1. **On-Premise management** (The Hard Way), so no vendor lock in to any managed Kubernetes provider (KaaS/CaaS)
2. Hosted on affordable VPS provider (**Hetzner**), with strong **Terraform support**, allowing **GitOps** principles
3. **High Availability** with cloud Load Balancer, resilient storage and DB with replication, allowing automatic upgrades or maintenance without any downtime for production apps
4. Include complete **monitoring**, **logging** and **tracing** stacks
5. Complete **CI/CD pipeline**
6. Budget target **~$60/month** for complete cluster with all above tools, can be far less if no need for HA, CI or monitoring features

### What you'll learn 📚

* Use Terraform to manage your infrastructure, for both cloud provider and Kubernetes, following the GitOps principles
* How to set up an On-Premise resilient Kubernetes cluster, from the ground up, with automatic upgrades and reboot
* Use [K3s](https://k3s.io/) as lightweight Kubernetes distribution
* Use [Traefik](https://traefik.io/) as ingress controller, combined to [cert-manager](https://cert-manager.io/) for distributed SSL certificates, and secured access attempt to our cluster through Hetzner Load Balancer
* Use [Longhorn](https://longhorn.io/) as resilient storage, installed to dedicated storage nodes pool and volumes, include PVC incremental backups to S3
* Install and configure data stateful components as **PostgreSQL** and **Redis** clusters to specific nodes pool via well-known [Bitnami Helms](https://bitnami.com/stacks/helm)
* Test our resilient storage with some No Code apps, as [n8n](https://n8n.io/) and [nocodb](https://nocodb.com/), managed by Flux
* Complete monitoring and logging stack with [Prometheus](https://prometheus.io/), [Grafana](https://grafana.com/), [Loki](https://grafana.com/oss/loki/)
* Mount a complete self-hosted CI pipeline with the lightweight [Gitea](https://gitea.io/) + [Concourse CI](https://concourse-ci.org/) combo
* Test above CI tools with a sample **.NET API app**, using database cluster, with automatic CD using Flux
* Integrate the app to our monitoring stack with [OpenTelemetry](https://opentelemetry.io/), and use [Tempo](https://grafana.com/oss/tempo/) for distributed tracing
* Go further with [SonarQube](https://www.sonarsource.com/products/sonarqube/) for Continuous Inspection on code quality, including automatic code coverage reports
* Do some load testing scenarios with [k6](https://k6.io/) and frontend SPA sample deployment using the .NET API.

### You probably don't need Kubernetes 🪧

All of this is of course overkill for any personal usage, and is only intended for learning purpose or getting a low-cost semi-pro grade K3s cluster.

**Docker Swarm** is probably the best solution for 99% of people that need a simple container orchestration system. Swarm stays an officially supported project, as it's built in into the Docker Engine, even if we shouldn't expect any new features.

I wrote a [complete dedicated 2022 guide here]({{< ref "/posts/02-build-your-own-docker-swarm-cluster" >}}) that explains all steps in order to have a semi-pro grade Swarm cluster (but no GitOps oriented, using only Portainer UI).

## Cluster Architecture 🏘️

Here are the node pools that we'll need for a complete self-hosted Kubernetes cluster, where each node pool is scalable independently:

| Node pool    | Description                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| `controller` | The control planes nodes, use at least 3 or any greater odd number (when etcd) for HA kube API server      |
| `worker`     | Workers for your production/staging stateless apps                                                         |
| `storage`    | Dedicated nodes for running Longhorn for resilient storage and DB, in case you won't use managed databases |
| `monitor`    | Workers dedicated for monitoring, optional                                                                 |
| `runner`     | Workers dedicated for CI/CD pipelines execution, optional                                                  |

Here a HA architecture sample with replicated storage (via Longhorn) and PostgreSQL DB (controllers, monitoring and runners are excluded for simplicity):

{{< mermaid >}}
flowchart TB
client((Client))
client -- Port 80 + 443 --> lb{LB}
lb{LB}
lb -- Port 80 --> worker-01
lb -- Port 80 --> worker-02
lb -- Port 80 --> worker-03
subgraph worker-01
  direction TB
  traefik-01{Traefik}
  app-01([My App replica 1])
  traefik-01 --> app-01
end
subgraph worker-02
  direction TB
  traefik-02{Traefik}
  app-02([My App replica 2])
  traefik-02 --> app-02
end
subgraph worker-03
  direction TB
  traefik-03{Traefik}
  app-03([My App replica 3])
  traefik-03 --> app-03
end
overlay(Overlay network)
worker-01 --> overlay
worker-02 --> overlay
worker-03 --> overlay
overlay --> db-primary
overlay --> db-read
db-primary((Primary SVC))
db-primary -- Port 5432 --> storage-01
db-read((Read SVC))
db-read -- Port 5432 --> storage-02
db-read -- Port 5432 --> storage-03
subgraph storage-01
  direction TB
  pg-primary([PostgreSQL primary])
  longhorn-01[(Longhorn<br>volume)]
  pg-primary --> longhorn-01
end
subgraph storage-02
  direction TB
  pg-replica-01([PostgreSQL replica 1])
  longhorn-02[(Longhorn<br>volume)]
  pg-replica-01 --> longhorn-02
end
subgraph storage-03
  direction TB
  pg-replica-02([PostgreSQL replica 2])
  longhorn-03[(Longhorn<br>volume)]
  pg-replica-02 --> longhorn-03
end
db-streaming(Streaming replication)
storage-01 --> db-streaming
storage-02 --> db-streaming
storage-03 --> db-streaming
{{</ mermaid >}}

### Cloud provider choice ☁️

As a HA Kubernetes cluster can be quickly expensive, a good cloud provider is an essential part.

After testing many providers, as Digital Ocean, Vultr, Linode, Civo, OVH, Scaleway, it seems like **Hetzner** is very well suited **in my opinion**:

* Very competitive price for middle-range performance (plan only around **$6** for 2 CPU/4 GB for each node)
* No frills, just the basics, VMs, block volumes, load balancer, firewall, and that's it
* Nice UI + efficient CLI tool
* Official strong [Terraform support](https://registry.terraform.io/providers/hetznercloud/hcloud/latest), so GitOps ready

Please let me know in below comments if you have other better suggestions !

### Final cost estimate 💰

| Server Name  | Type     | Quantity              | Unit Price |
| ------------ | -------- | --------------------- | ---------- |
| `worker`     | **LB1**  | 1                     | 5.39       |
| `manager-0x` | **CX21** | 1 or 3 for HA cluster | 0.5 + 4.85 |
| `worker-0x`  | **CX21** | 2 or 3                | 0.5 + 4.85 |
| `storage-0x` | **CX21** | 2 for HA database     | 0.5 + 4.85 |
| `monitor-0x` | **CX21** | 1                     | 0.5 + 4.85 |
| `runner-0x`  | **CX21** | 1                     | 0.5 + 4.85 |

**€0.5** is for primary IPs.

We will also need some expendable block volumes for our storage nodes. Let's start with **20 GB**, **2\*0.88**.

(5.39+**8**\*(0.5+4.85)+**2**\*0.88)\*1.2 = **€59.94** / month

We targeted **€60/month** for a minimal working CI/CD cluster, so we are good !

You can also prefer to take **2 larger** cx31 worker nodes (**8 GB** RAM) instead of **3 smaller** ones, which [will optimize resource usage](https://learnk8s.io/kubernetes-node-size), so:

(5.39+**7**\*0.5+**5**\*4.85+**2**\*9.2+**2**\*0.88)\*1.2 = **€63.96** / month

For an HA cluster, you'll need to put 2 more cx21 controllers, so **€72.78** (for 3 small workers option) or **€76.80** / month (for 2 big workers option).

## Let’s party 🎉

Enough talk, [let's go Charles !]({{< ref "/posts/11-a-beautiful-gitops-day-1" >}})
