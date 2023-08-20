---
title: "Setup a HA Kubernetes cluster Part IV - HA storage & DB"
date: 2023-10-04
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "traefik", "cert-manager", "longhorn"]
draft: true
---

{{< lead >}}
Be free from AWS/Azure/GCP by building a production grade On-Premise Kubernetes cluster on cheap VPS provider, fully GitOps managed, and with complete CI/CD tools 🎉
{{< /lead >}}

This is the **Part IV** of more global topic tutorial. [Back to first part]({{< ref "/posts/10-build-your-own-kubernetes-cluster" >}}) for intro.

## Resilient Storage with Longhorn

## PostgreSQL with replication

## Redis cluster

## Test with PgAdmin (valid both ingress and storage)

## Test some nocode tools

n8n + nocodb

## Backups (dumps + longhorn snapshots)

## 2nd check ✅

Our cluster is now perfectly securely accessible from outside with minimal setup needed for any new apps. Persistence is insured by Longhorn with replicated storage and Minio for S3 needs. The next important part is now to have a [working database for real world apps]({{< ref "/posts/13-build-your-own-kubernetes-cluster-part-4" >}}).