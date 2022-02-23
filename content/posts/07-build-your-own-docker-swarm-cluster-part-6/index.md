---
title: "Setup a Docker Swarm cluster Part VI - Logging & tracing"
date: 2022-02-20
description: "Build an opinionated containerized platform for developer..."
tags: ["docker", "swarm"]
draft: true
---

{{< lead >}}
Build your own cheap while powerful self-hosted complete CI/CD solution by following this opinionated guide 🎉
{{< /lead >}}

This is the **Part VI** of more global topic tutorial. [Back to first part]({{< ref "/posts/02-build-your-own-docker-swarm-cluster" >}}) to start from beginning.

## Why centralized logs ?

A real production cluster should have centralized logs. Of course, we have some basic service logs viewer on Portainer, which shows the containers STDOUT, but :

* With more and more containers, it can be unmanageable
* Logs of containers will not persist after each container restart
* Not very powerful to navigate, can be tedious with huge logs

Moreover, it'll be nice if logs of `data-01` services (MySQL, PostgreSQL, etc.) can be centralized too.

### Why Loki ?

The common way to deal with this is to use *ELK*, but I'll show you a better option which is far less resource demanding. *Loki* is a perfect viable option and perfectly integrated to Grafana. It works exactly like Prometheus in terms of architecture, but for logs :

* Loki as itself is a powerful database index search service like Elasticsearch, but optimized for logs
* Completely integrated to Grafana thanks to LogQL language, similar to PromQL for Prometheus
* Like Prometheus, we need to install many type of exporters in order to feed the Loki database.

The mains exporters are :

* Promtail which fetch logs local file based on some patterns perfect for our `data-01` managed server
* Docker driver plugin which redirect all STDOUT to Loki.

## Logs with Loki 📄

First, let's install the main Loki service :

```sh
curl -O -L "https://github.com/grafana/loki/releases/download/v2.4.2/loki-linux-amd64.zip"
sudo apt install -y unzip
unzip "loki-linux-amd64.zip"
chmod a+x "loki-linux-amd64"
sudo mv loki-linux-amd64 /usr/local/bin/loki
```

Prepare the config file :

```sh
wget https://raw.githubusercontent.com/grafana/loki/master/cmd/loki/loki-local-config.yaml
sudo mkdir /etc/loki
sudo mv loki-local-config.yaml /etc/loki/
sudo mkdir /var/lib/loki
sudo chown swarm:swarm /var/lib/loki
```

> Change default /tmp/loki to /var/lib/loki

Then prepare the service `/etc/systemd/system/loki.service`

```conf
[Unit]
Description=Loki
After=network.target

[Service]
Type=simple
User=swarm
ExecStart=/usr/local/bin/loki -config.file=/etc/loki/loki-local-config.yaml

[Install]
WantedBy=multi-user.target
```

Finally, start the service

```sh
sudo service loki start
sudo service loki status
sudo systemctl enable loki.service
sudo systemctl status loki.service
```

### Data logs with Promtail

### Docker hosts

<https://grafana.com/docs/loki/latest/clients/docker-driver/>

```sh
docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
```

`/etc/docker/daemon.json`

```json
{
  "log-driver": "loki",
  "log-opts": {
    "loki-url": "http://data-01:3100/loki/api/v1/push",
    "loki-batch-size": "400"
  }
}
```

### Grafana explore and dashboard

## Tracing with Jaeger 🔍

### Traefik integration

## 5th check ✅

We've done all the logging part with complete centralized logging for cluster + data, as well as tracing.

Now it's time to test a real case scenario for a developer perspective. We'll see that in the [last part]({{< ref "/posts/08-build-your-own-docker-swarm-cluster-part-7" >}}).
