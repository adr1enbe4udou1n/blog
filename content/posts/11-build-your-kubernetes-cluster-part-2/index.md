---
title: "Setup a HA Kubernetes cluster Part II - Cluster initialization with Terraform"
date: 2023-06-09
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "terraform", "hetzner", "k3s", "gitops"]
draft: true
---

{{< lead >}}
Build your self-hosted Kubernetes cluster and be free from any SaaS solutions by following this opinionated guide 🎉
{{< /lead >}}

## K3s cluster building with Terraform

Begin with 1 master and 3 workers node with LB...

## K3s configuration and usage

* Local SSH + Kube apiserver access to the cluster
* Usage of salt
* K3s S3 backup

## Automatic upgrades

* OS reboot
* K3s upgrade

## HTTP access

* Traefik + cert-manager
* DNS configuration
* Dashboard traefik access
* Middlewares IP and auth

## 1st check ✅

We now have a working cluster, let's install [a load balanced ingress controller for external access through SSL]({{< ref "/posts/12-build-your-kubernetes-cluster-part-3" >}}) and proper HA storage.
