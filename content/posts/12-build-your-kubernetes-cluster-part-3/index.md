---
title: "Setup a HA Kubernetes cluster Part III - Ingress & storages with NFS & S3"
date: 2022-12-10
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "traefik", "cert-manager", "nfs", "minio"]
draft: true
---

{{< lead >}}
Build your self-hosted Kubernetes cluster and be free from any SaaS solutions by following this opinionated guide 🎉
{{< /lead >}}

1. Traefik & cert-manager
2. Resilient Storage with Longhorn
3. Samples with Portainer & Minio
4. S3 Backup with longhorn

## 2nd check ✅

Our cluster is now perfectly securely accessible from outside with minimal setup needed for any new apps. Persistence is insured by NFS provisioner and S3 app. The next important part is now to have a [working database for real world apps]({{< ref "/posts/13-build-your-kubernetes-cluster-part-4" >}}).