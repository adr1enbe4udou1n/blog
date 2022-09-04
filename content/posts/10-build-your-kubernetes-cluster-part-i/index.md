---
title: "Setup a HA Kubernetes cluster for less than $50 / month"
date: 2022-09-02
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes"]
draft: true
---

{{< lead >}}
Build your self-hosted Kubernetes cluster and be free from any SaaS solutions by following this opinionated guide 🎉
{{< /lead >}}

## For who

This guide is mainly intended for any developers or some SRE who want a Kubernetes cluster that respect following conditions :

1. Free from any big cloud providers (AWS, GCP, Azure) which offers managed Kubernetes
2. Completely bare-metal and self-hosted, with some GitOps way steps
3. High availability with cloud Load Balancer
4. Not too much expensive (targeting between $30 and $50 depending on your needs).

I will not risk saying that it's production ready, but I think it's at least a very good way to build your own bare-metal Kubernetes platform and quick learning all his ecosystem with practice.

### You may don't need Kubernetes

If you prefer to stay away of all overwhelming Kubernetes features, but always interested in a very simple self-hosted orchestration platform, keep in mind that **Docker Swarm** is probably the best solution for you. It should be always supported as long as Docker CE live, as it's built in into the Docker Engine, and it's far easier and cheaper to maintain it than K8S.

I wrote a [complete dedicated guide here]({{< ref "/posts/02-build-your-own-docker-swarm-cluster" >}}) that explains all steps in order to have a production grade Swarm cluster.

### Cloud provider choice

As a HA Kubernetes cluster can be quickly expensive, a good cloud provider is an essential part.

After testing Digital Ocean, Vultr, Linode, Civo (which is completly optimized for Kubernetes), OVH, Scaleway, it becomes very clear that nothing can really compete with Hetzner in terms of QoS for that price **in my opinion** :

* Very competitive price for middle-range performance (plan only around **$6** for 2CPU/4GB for each node)
* Cloud Load Balancer, VPC and Firewall support, so no need to reinvent the wheel for these cases
* Very good UI, and with dark mode support which of course absolutely mandatory for my taste
* Perfect CLI tool
* cert-manager [DSN01 challenge support](https://github.com/vadimkim/cert-manager-webhook-hetzner) (but not official)
* Official [Terraform support](https://registry.terraform.io/providers/hetznercloud/hcloud/latest), so GitOps ready

Please let me know in below comments if you have other better suggestions !

### Requirements

## Final goal 🎯

TODO

### 1. Cluster & routing 🌍

Cluster + Traefik

### 3. Databases & testing with some apps 💾

### 5. Monitoring 📈

### 6. CI/CD setup 💻

Concourse / FluxCD

## Cluster Architecture 🏘️

## Cheap solution with Hetzner VPS 🖥️

## Let’s party 🎉

Enough talk, [let's go Charles !]({{< ref "/posts/11-build-your-kubernetes-cluster-part-ii" >}}).
