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

First, let's install the main Loki service on `data-01` (be sure to have unzip with `sudo apt install -y unzip`) :

```sh
curl -O -L "https://github.com/grafana/loki/releases/download/v2.4.2/loki-linux-amd64.zip"
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

Edit `/etc/loki/loki-local-config.yaml` and change `/tmp/loki` by `/var/lib/loki`.

Then prepare the service `/etc/systemd/system/loki.service` :

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

Finally, start the service :

```sh
sudo systemctl enable loki.service
sudo systemctl start loki.service
sudo systemctl status loki.service
```

It's running !

### Data logs with Promtail

It's time to feed the Loki database with Promtail. First, let's install the main service, always in `data-01` (we don't need it on docker hosts) :

```sh
curl -O -L "https://github.com/grafana/loki/releases/download/v2.4.2/promtail-linux-amd64.zip"
unzip "promtail-linux-amd64.zip"
chmod a+x "promtail-linux-amd64"
sudo mv promtail-linux-amd64 /usr/local/bin/promtail
```

Create `/etc/loki/promtail-local-config.yaml` :

```yml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://data-01:3100/loki/api/v1/push

scrape_configs:
  - job_name: system
    static_configs:
      - labels:
          job: varlogs
          host: data-01
          __path__: /var/log/*log
      - labels:
          job: mysql-logs
          host: data-01
          __path__: /var/log/mysql/*log
      - labels:
          job: postgresql-logs
          host: data-01
          __path__: /var/log/postgresql/*log
```

The above config is pretty itself explanatory. We declare the URL of Loki rest API endpoint, and a list of jobs which consist of simple regex where to tail log files. The `positions.yaml` avoid duplications by keeping the last line where the service stopped for each log file.

Then prepare the service `/etc/systemd/system/promtail.service` :

```conf
[Unit]
Description=Promtail
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/promtail -config.file=/etc/loki/promtail-local-config.yaml

[Install]
WantedBy=multi-user.target
```

Finally, start the service :

```sh
sudo systemctl enable promtail.service
sudo systemctl start promtail.service
sudo systemctl status promtail.service
```

Recheck status after few seconds to confirm local var logs have been pushed successfully to Loki. Check `sudo cat /tmp/positions.yaml` for current tail status.

{{< alert >}}
You can eventually repeat all this Promtail install procedure for each Docker host if you want to have system logs for all nodes.
{{< /alert >}}

### Docker hosts

Now we need to push all container logs to Loki. The official [Docker driver](https://grafana.com/docs/loki/latest/clients/docker-driver) is a nice way to do it for perfect integration.

```sh
docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions

# ensure plugin is enabled
docker plugin ls
```

Now we have 2 options, reedit all active docker stack YAML description to use the Loki driver (boring), or downright consider it as default driver for all containers, which is relevant in our case, I think.

Create `/etc/docker/daemon.json` on each docker host with following content :

```json
{
  "log-driver": "loki",
  "log-opts": {
    "loki-url": "http://data-01:3100/loki/api/v1/push",
    "loki-batch-size": "400"
  }
}
```

Then restart docker service `sudo service docker restart`.

And voilà, Loki is the default log driver for all containers. Note as you can still access your logs from Portainer.

### Grafana explore and dashboard

Now it's time to set up our central logs dashboard. First add *Loki* as a new data source inside Grafana, similarly to previous Prometheus. Set `http://data-01:3100` inside URL field and save it.

![Grafana loki datasource](grafana-loki-datasource.png)

Then create a new Dashboard. No need to import this time :

1. Add a new panel
2. Set logs as visualization type
3. Select Loki in Data source
4. Test some basic LogQL in Log browser in order to confirm all is working. Simply type `{` It should have full autocomplete. You should have plenty of access logs when using `{swarm_stack="traefik"}`

![Grafana loki datasource](grafana-panel-editor.png)

After this primary testing, let's use the power of Grafana with variables :

1. Set `{swarm_stack="$stack"}"` in log browser
2. Go to dashboard settings and enter the *Variables* section
3. Create a `stack` variable, select Prometheus as *Data source*, and insert following value inside *Query* field : `label_values(container_last_seen, container_label_com_docker_stack_namespace)`
4. It's a PromQL which fetch all detected docker stacks, click on *Update* to confirm the validity of *Preview of values* that will be show up

![Grafana loki datasource](grafana-variables.png)

1. Return to your panel editor. A new *stack* selector will appear in the top will all you to select the stack logs to show !
2. Let's apply for saving the panel and test the selector. The Panel should reactive with the *stack* selector.
3. Save the dashboard.

![Grafana loki datasource](grafana-logs-dashboard.png)

## Tracing with Jaeger 🔍

### Traefik integration

## 5th check ✅

We've done all the logging part with complete centralized logging for cluster + data, as well as tracing.

Now it's time to test a real case scenario for a developer perspective. We'll see that in the [last part]({{< ref "/posts/08-build-your-own-docker-swarm-cluster-part-7" >}}).
