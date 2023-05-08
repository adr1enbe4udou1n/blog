---
title: "Setup a HA Kubernetes cluster for less than $60 / month"
date: 2023-06-08
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes"]
draft: true
---

{{< lead >}}
Build your self-hosted Kubernetes cluster and be free from any SaaS solutions by following this opinionated guide 🎉
{{< /lead >}}

## For who

This guide is mainly intended for any developers or some SRE who want a Kubernetes cluster that respect following conditions :

1. On-Premise management (The Hard Way), no managed Kubernetes provider
2. Follow the GitOps principles
3. High availability with cloud Load Balancer and resilient storage and DB
4. Fully monitored
5. Complete CI/CD pipeline
6. Not too much expensive (from $30 to $70 /month depending on your needs)

### You may don't need Kubernetes

If you prefer to stay away of all overwhelming Kubernetes features, but just interested in a very simple self-hosted orchestration platform (as 99% of any personal usage), keep in mind that **Docker Swarm** is probably the best solution for you. Don't listen people that say it's outdated, because [it's not](https://dockerlabs.collabnix.com/intermediate/swarm/difference-between-docker-swarm-vs-swarm-mode-vs-swarmkit.html) and will always be supported as long as Docker CE live, as it's built in into the Docker Engine, and it's far easier and cheaper to maintain it than K8S. The downside is that there is no longer any new features added to Swarm.

I wrote a [complete dedicated guide here]({{< ref "/posts/02-build-your-own-docker-swarm-cluster" >}}) that explains all steps in order to have a production grade Swarm cluster.

### Cloud provider choice

As a HA Kubernetes cluster can be quickly expensive, a good cloud provider is an essential part.

After testing many providers, as Digital Ocean, Vultr, Linode, Civo , OVH, Scaleway, it seems like **Hetzner** is very well suited **in my opinion** :

* Very competitive price for middle-range performance (plan only around **$6** for 2CPU/4GB for each node)
* No frills, just the basics, VMs, block volumes, load balancer, DNS, firewall, and that's it
* Simple nice UI + CLI tool
* Official [Terraform support](https://registry.terraform.io/providers/hetznercloud/hcloud/latest), so GitOps ready
* cert-manager [DSN01 challenge support](https://github.com/vadimkim/cert-manager-webhook-hetzner)

Please let me know in below comments if you have other better suggestions !

## Cluster Architecture 🏘️

Note as this cluster will be intended for developer user with complete self-hosted CI/CD solution. So for a good cluster architecture starting point, we can imagine the following nodes :

| server          | description                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `controller-0x` | The control planes nodes, use at least 3 or any greater odd number (when etcd) for HA kube API server |
| `worker-0x`     | Workers for your production/staging apps, at least 3 for running Longhorn for resilient storage       |
| `data-0x`       | Data nodes for any DB / critical statefulset pods                                                     |
| `monitor-0x`    | Workers dedicated to monitoring                                                                       |
| `runner-0x`     | Workers dedicated to CI/CD pipelines execution                                                        |

```mermaid
flowchart TD
lb((Load Balancer))
subgraph worker-01
    traefik-01([Traefik])
    apps-01[Apps]
    longhorn-01[/Longhorn/]

    traefik-01 --> apps-01
    longhorn-01 --> apps-01
end
subgraph worker-02
    traefik-02([Traefik])
    apps-02[Apps]
    longhorn-02[/Longhorn/]

    traefik-02 --> apps-02
    longhorn-02 --> apps-02
end
subgraph worker-03
    traefik-03([Traefik])
    apps-03[Apps]
    longhorn-03[/Longhorn/]

    traefik-03 --> apps-03
    longhorn-03 --> apps-03
end
lb --> traefik-01
lb --> traefik-02
lb --> traefik-03
subgraph data-01
    postgresql[(PostgreSQL Primary)]
end
subgraph data-02
    postgresql-replica[(PostgreSQL Replica)]
end
apps-01 --> postgresql
apps-02 --> postgresql
apps-03 --> postgresql
postgresql --> postgresql-replica
```

## Cheap solution with Hetzner VPS 🖥️

## Let’s party 🎉

Enough talk, [let's go Charles !]({{< ref "/posts/11-build-your-kubernetes-cluster-part-2" >}}).
