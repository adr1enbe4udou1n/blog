---
title: "Setup a HA Kubernetes cluster Part II - Cluster initialization, GitOps way"
date: 2022-12-09
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "terraform", "hetzner", "k3s", "gitops"]
draft: true
---

{{< lead >}}
Build your self-hosted Kubernetes cluster and be free from any SaaS solutions by following this opinionated guide 🎉
{{< /lead >}}

1. Terraform
2. K3S usage

## 1st check ✅

We now have a working cluster, let's install [a load balanced ingress controller for external access through SSL]({{< ref "/posts/12-build-your-kubernetes-cluster-part-3" >}}).
