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

{{< alert >}}
This part is totally optional, as it's mainly focused on monitoring. Feel free to skip this part.
{{< /alert >}}

## Metrics with Prometheus 🔦

Prometheus is become the standard de facto for self-hosted monitoring in part thanks to his architecture. It's a TSDB (Time Series Database) that will poll (aka scrape) standard metrics REST endpoints, provided by the tools to monitor. It's the case of Traefik, as we seen in [part III]({{< ref "04-build-your-own-docker-swarm-cluster-part-3#traefik-" >}}). For tools that don't support it natively, like databases, you'll find many exporters that will do the job for you.

### Prometheus install 💽

I'll not use GlusterFS volume for storing Prometheus data, because :

* 1 instance needed on the master
* No critical data, it's just metrics
* No need of backup, and it can be pretty huge

First go to the `master-01` node settings in Portainer inside *Swarm Cluster overview*, and apply a new label that indicates that this node is the host of Prometheus data.

![Prometheus host overview](portainer-host-overview.png)

It's equivalent of doing :

```sh
export NODE_ID=$(docker info -f '{{.Swarm.NodeID}}')
docker node update --label-add prometheus.data=true $NODE_ID
```

Then create a config file at `/etc/prometheus/prometheus.yml` in `master-01` node :

```yml
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: "traefik"
    static_configs:
      - targets: ["traefik_traefik:8080"]
```

It consists on 2 scrapes job, use `targets` in order to indicate to Prometheus the `/metrics` endpoint locations. I configure `5s` as interval, that means Prometheus will scrape `/metrics` endpoints every 5 seconds.

Finally create a `prometheus` stack in Portainer :

```yml
version: '3.7'

services:

  prometheus:
    image: prom/prometheus
    networks:
      - private
      - traefik_public
    command:
      - --config.file=/etc/prometheus/prometheus.yml
      - --storage.tsdb.retention.size=5GB
      - --storage.tsdb.retention.time=15d
    volumes:
      - /etc/hosts:/etc/hosts
      - /etc/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - data:/prometheus
    deploy:
      placement:
        constraints:
          - node.labels.prometheus.data == true
      labels:
        - traefik.enable=true
        - traefik.http.routers.prometheus.middlewares=admin-ip,admin-auth
        - traefik.http.services.prometheus.loadbalancer.server.port=9090

networks:
  private:
  traefik_public:
    external: true

volumes:
  data:
```

The `private` network will serve us later for exporters. Next config are useful in order to control the DB usage, as metrics can go up very quickly :

| argument                    | description                 |
| --------------------------- | --------------------------- |
| storage.tsdb.retention.size | The max DB size             |
| storage.tsdb.retention.time | The max data retention date |

Deploy it and <https://prometheus.sw.okami101.io> should be available after few seconds. Use same traefik credentials for login.

You should now have access to some metrics !

![Prometheus graph](prometheus-graph.png)

In *Status > Targets*, you should have 2 endpoints enabled, which correspond to above scrape config.

![Prometheus targets](prometheus-targets.png)

### Nodes & Containers metrics with cAdvisor & Node exporter

## Visualization with Grafana 📈

### Grafana install 💽

### Docker Swarm dashboard

## External node, MySQL and PostgreSQL exports

### Grafana dashboards for data

## 4th check ✅

We've done all the monitoring part with installation of DB times series, exports and UI visualization.

We have all the metrics part. What about logging and tracing, which are an other essential aspects for perfect production analyzing and debugging. We'll see that in the [next part]({{< ref "/posts/07-build-your-own-docker-swarm-cluster-part-6" >}}).
