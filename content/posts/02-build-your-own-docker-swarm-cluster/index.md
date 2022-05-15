---
title: "Setup a Docker Swarm cluster for less than $30 / month"
date: 2022-02-13
description: "Build an opinionated containerized platform for developer..."
tags: ["docker", "swarm"]
---

{{< lead >}}
Build your own cheap but powerful self-hosted cluster and be free from any SaaS solutions by following this opinionated guide 🎉
{{< /lead >}}

## Why Docker Swarm 🧐 ?

Because [Docker Swarm Rocks](https://dockerswarm.rocks/) !

Yeah, for some people it seems a little outdated now in 2022, a period where Kubernetes is everywhere, but I'm personally convicted that [it's really so underrated](https://www.reddit.com/r/docker/comments/oufvd8/why_docker_swarm_is_not_popular_as_kubernetes/). Except for training, you really don't have to throw yourself into all Kubernetes fuzzy complicated things, at least in a personal Homelab perspective.

Of course with Docker Swarm you'll be completely limited to what Docker API has to offer, without any abstraction, contrary to K8S, which built its community around new abstracted orchestration concepts, like *StatefulSets*, *operators*, *Helm*, etc. But it's the intended purpose of Swarm ! Not many new things to learn once you master docker.

### The 2022 Docker Swarm guide 🚀

I'll try to show you step by step how to install your own serious containerized cluster for less than $30 by using [Hetzner](https://www.hetzner.com/), one of the best Cloud provider on European market, with cheap yet really powerful VPS. Besides, they just recently opened new centers in America !

This tutorial is a sort of massive 2022 update from the well-known *dockerswarm.rocks*, with a further comprehension under the hood. It's **NOT** a quick and done tutorial, as we'll go very deeply, but at least you will understand all it's going on. It's divided into 8 parts, so be prepared ! The prerequisites before continue :

* Have some fundamentals on Docker
* Be comfortable with SSH terminal
* Registered for a [Hetzner Cloud account](https://accounts.hetzner.com/signUp), at least for the part 2, or feel free to adapt to any other VPS provider
* A custom domain, I'll use `dockerswarm.rocks` here as an example
* An account to a transactional mail provider as Mailgun, SendGrid, Sendinblue, etc. as a bonus.

## Final goal 🎯

In the very end of this multi-steps guide, you will have complete working production grade secured cluster, backup included, with optional monitoring and complete development CI/CD workflow.

### 1. Cluster initialization 🌍

* **Hetzner** VPS setups under *Ubuntu 20.04* with proper firewall configuration
* **SaltStack** for efficient node management
* **Docker Swarm** installation, with **1 manager and 2 workers**
* **Traefik**, a cloud native reverse proxy with automatic service discovery and SSL configuration
* **Portainer** as simple GUI for containers management

### 2. The stateful part 💾

Because Docker Swarm is not really suited for managing stateful containers (an area where K8S can shine thanks to operators), I choose to use **1 dedicated VPS** for all data critical part. We will install :

* **GlusterFS** as network filesystem, configured for cluster nodes
* **PostgreSQL** as main production database
* **MySQL** as additional secondary database (optional)
* **Redis** as fast database cache (optional)
* **Elasticsearch** as database for indexes
* **Restic** as S3 backup solution

Note as I will not set up this data server for **HA** (High Availability) here, as it's a complete another topic. But note as every chosen tool's here can be clustered.

{{< alert >}}
There are many debates about using databases as docker container, but I personally prefer use managed server for better control, local on-disk performance, central backup management and easier possibility of database clustering.  
Note as on the Kubernetes world, running containerized **AND** clustered databases becomes reality thanks to [powerful operators](https://github.com/zalando/postgres-operator) that provide clustering. There is obviously no such things on Docker Swarm 🙈.
{{< /alert >}}

### 3. Testing the cluster ✅

We will use the main Portainer GUI in order to install following tools :

* [**Diun**](https://crazymax.dev/diun/) (optional), very useful in order to be notified for all used images update inside your Swarm cluster
* [**Cron**](https://github.com/crazy-max/swarm-cronjob) for distributed cron across all cluster
* **pgAdmin** and **phpMyAdmin** as web database managers (optional)
* Some containerized app samples as **MinIO**, **Matomo**, **Redmine**, **n8n**, that will show you how simple is it to install self-hosted web apps thanks to your shiny new cluster !

### 4. Monitoring 📈

This is an optional part, feel free to skip. We'll set up production grade monitoring and tracing with complete dashboards.

* **Prometheus** as time series DB for monitoring
  * We will configure many metrics exporter for each critical part (Data node, PostgreSQL, MySQL, containers detail thanks to **cAdvisor**)
  * Basic usage of *PromQL*
* **Loki** with **Promtail** for centralized logs, fetched from data node and docker containers
* **Jaeger** as main *tracing* tool, with Elasticsearch as main data storage
* Configure Traefik for metrics, logs and tracing as perfect sample
* **Grafana** as GUI dashboard builder with many battery included dashboards
  * Monitoring all the cluster
  * Node, PostgreSQL and MySQL metrics
  * Navigate through log history of all containers and data server node thanks to Loki like *ELK*, with *LogQL*

### 5. CI/CD setup 💻

* **Gitea** as lightweight centralized control version, in case you want get out of Github / GitLab Cloud
* Private **docker registry** with minimal UI for all your custom app images that will be built on your development process and be used as based image for your production docker on cluster
* **Drone CI** as self-hosted CI/CD solution
* **SonarQube** as self-hosted quality code control
* Get perfect load testing environment with **k6** + **InfluxDB** + **Grafana** combo

We'll entirely test the above configuration with the basic .NET weather API.

## Cluster Architecture 🏘️

Note as this cluster will be intended for developer user with complete self-hosted CI/CD solution. So for a good cluster architecture starting point, we can imagine the following nodes :

| server       | description                                                                       |
| ------------ | --------------------------------------------------------------------------------- |
| `manager-01` | The frontal manager node, with proper reverse proxy and some management tools     |
| `worker-01`  | A worker for your production/staging apps                                         |
| `runner-01`  | An additional worker dedicated to CI/CD pipelines execution                       |
| `data-01`    | The critical data node, with attached and resizable volume for better flexibility |

{{< mermaid >}}
flowchart TD
subgraph manager-01
traefik((Traefik))<-- Container Discovery -->docker[Docker API]
end
subgraph worker-01
my-app-01((My App 01))
my-app-02((My App 02))
end
subgraph runner-01
runner((Drone CI runner))
end
subgraph data-01
logs[Loki]
postgresql[(PostgreSQL)]
files[/GlusterFS/]
mysql[(MySQL)]
end
manager-01 == As Worker Node ==> worker-01
manager-01 == As Worker Node ==> runner-01
traefik -. reverse proxy .-> my-app-01
traefik -. reverse proxy .-> my-app-02
my-app-01 -.-> postgresql
my-app-02 -.-> mysql
my-app-01 -.-> files
my-app-02 -.-> files
{{< /mermaid >}}

Note as the hostnames correspond to a particular type of server, dedicated for one task specifically. Each type of node can be scaled as you wish :

| replica      | description                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `manager-0x` | For advanced resilient Swarm quorum                                                                      |
| `worker-0x`  | For better scaling production apps, the easiest to set up                                                |
| `runner-0x`  | More power for pipeline execution                                                                        |
| `data-0x`    | The hard part for data **HA**, with GlusterFS replications, DB clustering for PostgreSQL and MySQL, etc. |

{{< alert >}}
For a simple production cluster, you can start with only `manager-01` and `data-01` as minimal start.  
For a development perspective, you can skip `worker-01` and use `manager-01` for production running.  
You have plenty choices here according to your budget !
{{< /alert >}}

## Cheap solution with Hetzner VPS 🖥️

Here some of the cheapest VPS options we have at this time of writing (**02/2022**) :

| Server Type      | Spec       | Price     |
| ---------------- | ---------- | --------- |
| **CPX11 (AMD)**  | 2C/2G/40Go | **€4.79** |
| **CX21 (Intel)** | 3C/4G/80Go | **€5.88** |
| **CPX21 (AMD)**  | 3C/4G/80Go | **€8.28** |

My personal choice for a cheap yet well-balanced cluster :

| Server Name  | Type                  | Why                                                                  |
| ------------ | --------------------- | -------------------------------------------------------------------- |
| `manager-01` | **CX21**              | I'll privilege RAM for running many management based container tools |
| `worker-01`  | **CX21** or **CPX21** | Just a power choice matter for your app                              |
| `runner-01`  | **CPX11**             | 2 powerful EPYC core is better for fast app building                 |
| `data-01`    | **CX21** or **CPX21** | Just a power choice matter for your databases                        |

We'll take additional volume for `data-01` of **20 Go** for **€0.96**. So we finally arrive to following respectable budget range : **€23.39** - **$29.39**.

The main difference is choice between **Xeon VS EPIC** as CPU for `worker-01` and `data-01` nodes, which will our main critical production application nodes. A quick [sysbench](https://github.com/akopytov/sysbench) will indicates around **70-80%** more power for AMD (test date from 2022-02).
Choose wisely according to your needs.

Note as a Swarm node with *manager* role can act as a *worker* as well. So if you're very budget limited, you can eventually skip `worker-01` and `runner-01` nodes, with only one simple standalone docker host (no Swarm mode). So you can go down to **€14,64** with only **2 CX21** in addition to volume.

{{< alert >}}
If you intend to have your own self-hosted GitLab for an enterprise grade CI/CD workflow, you should run it on node with **8 GB** of RAM.  
**4 GB** is doable if you run just one single GitLab container on it with Prometheus mode disabled and external PostgreSQL.
{{< /alert >}}

## Let's party 🎉

All presentation is done, go to the [next part]({{< ref "/posts/03-build-your-own-docker-swarm-cluster-part-2" >}}) for starting !
