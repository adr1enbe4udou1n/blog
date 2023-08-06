---
title: "Setup a HA Kubernetes cluster Part III - HA storage & DB"
date: 2023-06-10
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "traefik", "cert-manager", "longhorn"]
draft: true
---

{{< lead >}}
Build your self-hosted Kubernetes cluster and be free from any SaaS solutions by following this opinionated guide 🎉
{{< /lead >}}

## Resilient Storage with Longhorn

## PostgreSQL with replication

## Redis cluster

## Test with PgAdmin (valid both ingress and storage)

## Test some nocode tools

n8n + nocodb

## Backups (dumps + longhorn snapshots)

## 2nd check ✅

Our cluster is now perfectly securely accessible from outside with minimal setup needed for any new apps. Persistence is insured by Longhorn with replicated storage and Minio for S3 needs. The next important part is now to have a [working database for real world apps]({{< ref "/posts/13-build-your-kubernetes-cluster-part-4" >}}).
