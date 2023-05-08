---
title: "Setup a HA Kubernetes cluster Part IV - Databases with HA & backups"
date: 2023-06-11
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "postgresql", "longhorn"]
draft: true
---

{{< lead >}}
Build your self-hosted Kubernetes cluster and be free from any SaaS solutions by following this opinionated guide 🎉
{{< /lead >}}

1. Add data-01 node
2. PostgreSQL
3. Access through PgAdmin
4. Job backups
5. S3 Backup with longhorn
6. Clustering with additional data-02 and postgreSQL cluster

## 3rd check ✅

Databases are ready to be consumed by any apps ! Go [next part]({{< ref "/posts/14-build-your-kubernetes-cluster-part-5" >}}) to finally use our cluster with some real apps, including some well known low-code tools !
