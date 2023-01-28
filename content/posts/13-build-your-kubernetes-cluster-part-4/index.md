---
title: "Setup a HA Kubernetes cluster Part IV - Databases & backups"
date: 2022-12-11
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "mysql", "postgresql", "minio", "restic"]
draft: true
---

{{< lead >}}
Build your self-hosted Kubernetes cluster and be free from any SaaS solutions by following this opinionated guide 🎉
{{< /lead >}}

1. Add data-01 node
2. MySQL and PostgreSQL
3. Web management apps with PMA & PGA
4. Job backups
5. Clustering with additional data-02 and postgreSQL cluster

## 3rd check ✅

Databases are ready to be consumed by any apps. In real world situation, we should have a full monitoring suite, see [next part]({{< ref "/posts/14-build-your-kubernetes-cluster-part-5" >}}) for complete monitoring and logging stack.
