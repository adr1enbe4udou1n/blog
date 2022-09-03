---
title: "Setup a HA Kubernetes cluster Part III - Ingress & storages with NFS & S3"
date: 2022-09-02
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "traefik", "cert-manager", "nfs", "minio"]
draft: true
---

{{< lead >}}
Build your self-hosted Kubernetes cluster and be free from any SaaS solutions by following this opinionated guide 🎉
{{< /lead >}}

1. Traefik & cert-manager
2. NFS subdirectory provisioner
3. Portainer
4. Minio

## 2nd check ✅

Our cluster is now perfectly securely accessible from outside with minimal setup needed for any new apps. Persistence is insured by NFS provisioner and S3 app. The next important part is now to have a [working database for real world apps]({{< ref "/posts/13-build-your-kubernetes-cluster-part-iv" >}}).
