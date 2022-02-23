---
title: "Setup a Docker Swarm cluster for less than $30 / month"
date: 2022-02-13
description: "Build an opinionated containerized platform for developer..."
tags: ["docker", "swarm"]
draft: true
---

{{< lead >}}
Build your own cheap while powerful self-hosted complete CI/CD solution by following this opinionated guide 🎉
{{< /lead >}}

## Why Docker Swarm 🧐 ?

Because [Docker Swarm Rocks](https://dockerswarm.rocks/) !

Even if Docker Swarm has lost the enterprise graduate orchestration containers war, you don't have to throw yourself into all Kubernetes fuzzy complicated things for a simple homelab, unless for custom training of course.

If you know how to use docker-compose, you're already ready for Docker Swarm which use almost the same API with addition of specific *deploy* config.

I'll try to show you step by step how to install your own cheap containerized cluster for less than $30 by using [Hetzner](https://www.hetzner.com/), one of the best Cloud provider on European market, with cheap but powerful VPS.

So the prerequisites before continue :

* Have some knowledge on docker-compose setups
* Be comfortable with SSH terminal
* Registered for a [Hetzner Cloud account](https://accounts.hetzner.com/signUp)
* A custom domain, I'll use `okami101.io` here
* A account to a transactional mail provider as mailgun, sendgrid, sendingblue, etc.

{{< alert >}}
You can of course apply this guide on any other cloud provider, but I doubt that you can achieve lower price.
{{< /alert >}}

## Final goal 🎯

In the end of this multi-steps guide, you will have complete working production grade secured cluster, backup included, with optional monitoring and complete development CI/CD workflow.

### 1. Cluster initialization 🌍

* Initial VPS setup for docker under Ubuntu 20.04 with proper Hetzner firewall configuration
* `Docker Swarm` installation, **1 manager and 2 workers**
* `Traefik`, a cloud native reverse proxy with automatic service discovery and SSL configuration
* `Portainer` as simple GUI for containers management

### 2. The stateful part 💾

For all data critical part, I choose to use **1 dedicated VPS**. We will install :

* `GlusterFS` as network filesystem, configured for cluster nodes
* `PostgreSQL` as main production database
* `MySQL` as additional secondary database (optional)
* `Redis` as fast database cache (optional)
* S3 Backup with `Restic`

Note as I will not set up this for **HA** (High Availability) here, as it's a complete another topic. So this data node will be our **SPF** (Single Point of Failure) with only one file system and DB.

{{< alert >}}
There are many debates about using databases as docker container, but I personally prefer use managed server for better control, local on-disk performance, central backup management and easier possibility of database clustering.  
Note as on the Kubernetes world, run containerized databases becomes reality thanks to [powerful operators](https://github.com/zalando/postgres-operator) that provide easy clustering. The is obviously no such things on Docker Swarm 🙈
{{< /alert >}}

### 3. Testing the cluster ✅

We will use the main Portainer GUI in order to install following tools :

* [`Diun`](https://crazymax.dev/diun/) (optional), very useful in order to be notified for all used images update inside your Swarm cluster
* `pgAdmin` and `phpMyAdmin` as web database managers (optional)
* Some demo containerized samples that will show you how simple is it to install self-hosted web apps thanks to your shiny new cluster as `redmine`, `n8n`

### 4. Monitoring 📈

This is an optional part, feel free to skip. We'll set up production grade monitoring and tracing with complete dashboards.

* `Prometheus` as time series DB for monitoring
  * We will configure many metrics exporter for each critical part (Data node, PostgreSQL, MySQL, containers detail thanks to `cAdvisor`)
  * Basic usage of *PromQL*
* `Loki` with `Promtail` for centralized logs, fetched from data node and docker containers
* `Jaeger` as *tracing* tools
  * We will use `Elasticsearch` as main data storage
* `Traefik` configuration for metrics and trace as perfect sample
* `Grafana` as GUI dashboard builder with many battery included dashboards
  * Monitoring all the cluster
  * Node, PostgreSQL and MySQL metrics
  * Navigate through log history of all containers and data server node thanks to `Loki` like *ELK*, with *LogQL*

### 5. CI/CD setup 💻

* `Gitea` as lightweight centralized control version, in case you want get out of Github / GitLab Cloud
* `Private docker registry` with minimal UI for all your custom app images that will be built on your development process and be used as based image for your production docker on cluster
* `Drone CI` as self-hosted CI/CD solution
* `SonarQube` as self-hosted quality code control

Finally, we'll finish this guide by a simple mini-app development with above CI/CD integration !

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

Note as the hostnames correspond to a particular type of server, dedicated for one task specifically. Each type of node can be scale as you wish :

| replica      | description                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `manager-0x` | For advanced resilient Swarm quorum                                                                      |
| `worker-0x`  | For better scaling production apps, the easiest to set up                                                |
| `runner-0x`  | More power for pipeline execution                                                                        |
| `data-0x`    | The hard part for data **HA**, with GlusterFS replications, DB clustering for PostgreSQL and MySQL, etc. |

{{< alert >}}
For a simple production cluster, you can start with only `manager-01` and `data-01` as absolutely minimal start.  
For a development perspective, you can skip `worker-01` and use `manager-01` for production running.  
You have plenty choices here according to your budget !
{{< /alert >}}

## Cheap solution with Hetzner VPS 🖥️

Here some of the cheapest VPS options we have :

| Server Type      | Spec       | Price     |
| ---------------- | ---------- | --------- |
| **CPX11 (AMD)**  | 2C/2G/40Go | **€4.79** |
| **CX21 (Intel)** | 3C/4G/80Go | **€5.88** |
| **CPX21 (AMD)**  | 3C/4G/80Go | **€8.28** |

My personal choice for a good balance between cheap and well-balanced cluster :

| Server Name  | Type                  | Why                                          |
| ------------ | --------------------- | -------------------------------------------- |
| `manager-01` | **CX21**              | I'll privilege RAM                           |
| `runner-01`  | **CPX11**             | 2 powerful core is better for building       |
| `worker-01`  | **CX21** or **CPX21** | Just a power choice matter for your app      |
| `data-01`    | **CX21** or **CPX21** | Just a power choice matter for your database |

We'll take additional volume of **60 Go** for **€2.88**

We finally arrive to following respectable budget range : **€25.31** - **$31.31**

The only difference being choice between **Xeon VS EPIC** as CPU power for `worker` and `data` nodes, which will our main production application nodes. A quick [sysbench](https://github.com/akopytov/sysbench) will indicates around **70-80%** more power for AMD (test date from 2022-02).
Choose wisely according to your needs.

If you don't need of `worker` and `runner` nodes, with only one simple standalone docker host without Swarm mode, you can even go down to **€14,64** with only **2 CX21** in addition to volume.

{{< alert >}}
If you intend to have your own self-hosted GitLab for an enterprise grade CI/CD workflow, you should run it on node with **8 GB** of RAM.  
**4 GB** is doable if you run just one single GitLab container on it with Prometheus mode disabled and external PostgreSQL.
{{< /alert >}}

## Let's party 🎉

All presentation is done, go to the [next part]({{< ref "/posts/03-build-your-own-docker-swarm-cluster-part-2" >}}) for starting !