---
title: "Setup a Docker Swarm cluster Part V - Monitoring"
date: 2022-02-19
description: "Build an opinionated containerized platform for developer..."
tags: ["docker", "swarm"]
draft: true
---

{{< lead >}}
Build your own cheap while powerful self-hosted complete CI/CD solution by following this opinionated guide 🎉
{{< /lead >}}

This is the **Part V** of more global topic tutorial. [Back to first part]({{< ref "/posts/02-build-your-own-docker-swarm-cluster" >}}) to start from beginning.

## Metrics with Prometheus 🔦

### Prometheus install 💽

### Nodes & Containers metrics with cAdvisor & Node exporter

## Visualization with Grafana 📈

### Grafana install 💽

### Docker Swarm dashboard

## External node, MySQL and PostgreSQL exports

### Grafana dashboards for data

## 4th check ✅

We've done all the monitoring part with installation of DB times series, exports and UI visualization.

We have all the metrics part. What about logging and tracing, which are an other essential aspects for perfect production analyzing and debugging. We'll see that in the [next part]({{< ref "/posts/07-build-your-own-docker-swarm-cluster-part-6" >}}).
