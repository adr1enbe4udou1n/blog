---
title: "Setup a HA Kubernetes cluster Part III - Ingress & HA storage"
date: 2022-12-10
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "traefik", "cert-manager", "longhorn", "minio", "s3"]
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

Our cluster is now perfectly securely accessible from outside with minimal setup needed for any new apps. Persistence is insured by Longhorn with replicated storage and Minio for S3 needs. The next important part is now to have a [working database for real world apps]({{< ref "/posts/13-build-your-kubernetes-cluster-part-4" >}}).
