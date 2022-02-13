---
title: "Setup a Docker Swarm cluster for less than $30 / month"
date: 2022-02-13
description: "Build an opinionated containerized platform for developer..."
tags: ["docker", "swarm"]
slug: build-your-own-homelab-docker-swarm-cluster
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
* A custom domain, I'll use `example.org` here

{{< alert >}}
You can of course apply this guide on any other cloud provider, but I doubt that you can achieve lower price.
{{< /alert >}}

## Final goal 🎯

In the end of this multi-steps guide, you will have complete working development oriented cluster :

* `Traefik`, a cloud native reverse proxy

## Cluster Architecture

Note as this cluster will be intended for developer user with complete self-hosted CI/CD solution. So for a good cluster architecture starting point, we should at least have the following nodes :

* `manager-01` : The frontal manager node, with proper reverse proxy and some management tools
* `worker-01` : A worker

cpx11 (AMD) = 2C/2G/40Go = 4.79
cx21 (Intel) = 3C/4G/80Go = 5.88
cpx21 (AMD) = 3C/4G/80Go = 8.28
cx31 (Intel) = 2C/8G/160Go = 10.68
cpx31 (AMD) = 4C/8G/160Go = 14.88

* Front CPX31
* Worker CPX21
* Runner CPX11
* Data CPX21 + 50Go Volume 2.40$
* Block storage 75Go FREE on Scaleway

Total : 2.40 + 2*8.28 + 1*4.79 + 1*10.68 = 34.43€
