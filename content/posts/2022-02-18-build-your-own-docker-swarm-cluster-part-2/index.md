---
title: "Setup a Docker Swarm cluster - Part II"
date: 2022-02-18
description: "Build an opinionated containerized platform for developer..."
tags: ["docker", "swarm"]
slug: build-your-own-docker-swarm-cluster-part-2
draft: true
---

{{< lead >}}
Build your own cheap while powerful self-hosted complete CI/CD solution by following this opinionated guide 🎉
{{< /lead >}}

This is the **Part II** of more global topic tutorial. [Go to first part]({{< ref "/posts/2022-02-13-build-your-own-docker-swarm-cluster" >}}) before continue.

## Installation of Docker Swarm

### Docker engine

Now we must do the classic Docker installation on each stateless servers. Repeat following commands on `manager-01`, `worker-01` and `runner-01`.

```sh
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

sudo usermod -aG docker $USER
```

Then logout and use `docker run hello-world` and be sure all is OK. Follow [official installation](https://docs.docker.com/engine/install/ubuntu/) if not.

### Enable Docker Swarm

Finally, enable Swarm mode on `manager-01` :

```sh
docker swarm init --advertise-addr 10.0.0.2
```

{{< alert >}}
Use private network IP of manager, it' should be the same defined on `/et/hosts` on other worker servers.
{{< /alert >}}

The above command will show the command to launch to other worker nodes. Apply it on `worker-01` and `runner-01`.

When done use `docker node ls` on manager node in order to confirm the presence of the 2 workers with `Ready` status and active.

Yeah, cluster is already properly configured. Far less overwhelming than Kubernetes, I should say.

## Network file system

Before go further away, we'll quickly need of proper unique shared storage location for all managers and workers. It's mandatory in order to keep same state when your app containers are automatically rearranged by Swarm manager across multiple workers for convergence purpose.

We'll use `GlusterFS` for that. You can of course use a simple NFS bind mount. But GlusterFS make more sense in the sense that it allows easy replication for HA. You will not regret it when you'll need a `data-02`. We'll not cover GlusterFS replication here, just a unique master replica.

{{< mermaid >}}
flowchart TD
subgraph manager-01
traefik((Traefik))
end
subgraph worker-01
my-app-01-01((My App 01))
my-app-02-01((My App 02))
end
subgraph worker-02
my-app-01-02((My App 01))
my-app-02-02((My App 02))
end
subgraph data-01
storage[/GlusterFS/]
end
traefik-->my-app-01-01
traefik-->my-app-02-01
traefik-->my-app-01-02
traefik-->my-app-02-02
worker-01-- glusterfs bind mount -->data-01
worker-02-- glusterfs bind mount -->data-01
{{< /mermaid >}}

{{< alert >}}
Note that manager node can be used as worker as well. However, I think it's not well suited for production apps in my opinion.
{{< /alert >}}

### Install GlusterFS

It's 2 steps :

* Installing the file system server on dedicated volume mounted on `data-01`
* Mount the above volume on all clients where docker is installed

{{< tabs >}}
{{< tab tabName="1. master (data-01)" >}}

```sh
sudo add-apt-repository -y ppa:gluster/glusterfs-10

sudo apt install -y glusterfs-server
sudo systemctl enable glusterd.service
sudo systemctl start glusterd.service

# get the path of you mounted disk from part 1 of this tuto
df -h # it should be like /mnt/HC_Volume_xxxxxxxx

# create the volume
sudo gluster volume create volume-01 data-01:/mnt/HC_Volume_xxxxxxxx/gluster-storage
sudo gluster volume start volume-01

# ensure volume is present with this command
sudo gluster volume status

# next line for testing purpose
sudo touch /mnt/HC_Volume_xxxxxxxx/gluster-storage/test.txt
```

{{< /tab >}}
{{< tab tabName="2. clients (docker hosts)" >}}

```sh
# do following commands on every docker client host
sudo add-apt-repository -y ppa:gluster/glusterfs-10

sudo apt install -y glusterfs-client

# I will choose this path as main bind mount
sudo mkdir /mnt/storage-pool

# edit /etc/fstab with following line for persistent mount
data-01:/volume-01 /mnt/storage-pool glusterfs defaults,_netdev,x-systemd.automount 0 0

# test fstab with next command
sudo mount -a

# you should see test.txt
ls /mnt/storage-pool/
```

{{< /tab >}}
{{< /tabs >}}

{{< alert >}}
You can ask why we use bind mounts directly on the host instead of using more featured docker volumes directly (Kubernetes does similar way). Moreover, it's not really the first recommendation on [official docs](https://docs.docker.com/storage/bind-mounts/), as it states to prefer volumes directly.  
It's just as I didn't find reliable GlusterFS driver working for Docker. Kubernetes is far more mature in this domain sadly. Please let me know if you know production grade solution for that !
{{< /alert >}}

## Installing the Traefik - Portainer combo 💞

It's finally time to start our first container services. The minimal setup will be :

* [Traefik](https://doc.traefik.io/traefik/) as main proxy with dynamic services discovery through that Docker API
* [Portainer](https://www.portainer.io/) as main GUI for docker containers management and deployement

This 2 services will be deployed as docker services on `manager-01`.

### Traefik

The main task of traefik will be to redirect correct URL path to corresponding app service, according to regex rules (which domain or subdomain, which prefix URL path, etc.).

Thankfully, Traefik can be configured to take cares of all SSL certificates generation automatically without any intervention. We will use simple Let's encrypt for this.

#### The static Traefik configuration

Traditionally I should say that Traefik is clearly not really easy to setup for new comers. The essential part to keep in mind is that this reverse proxy has 2 types of configuration, *static* and *dynamic*. [Go here](https://doc.traefik.io/traefik/getting-started/configuration-overview/) for detail explication of difference between these types of configuration.

Here we'll talk about static configuration. Create a YAML file under `/etc/traefik/traefik.yml` of `manager-01` server with following content (TOML is also supported) :

```yml
entryPoints:
  https:
    address: :443
    http:
      middlewares:
        - gzip
      tls:
        certResolver: le
  http:
    address: :80
    http:
      redirections:
        entryPoint:
          to: https
          scheme: https
          permanent: true
  ssh:
    address: :22
certificatesResolvers:
  le:
    acme:
      email: admin@sw.okami101.io
      storage: /certificates/acme.json
      tlsChallenge: {}
providers:
  docker:
    defaultRule: Host(`{{ index .Labels "com.docker.stack.namespace" }}.sw.okami101.io`)
    exposedByDefault: false
    swarmMode: true
    network: traefik_public
api: {}
accessLog: {}
metrics:
  prometheus: {}
```

{{< tabs >}}
{{< tab tabName="entryPoints" >}}

* **HTTPS (443)** as main Web access, I added a global middleware called `gzip` that will be configured on next dynamic configuration for proper compression as well as `le`, aka *Let's encrypt*, as main certificate resolver
* **HTTP (80)** with automatic permanent HTTPS redirection, so every web service will be assured to be accessed through HTTPS only (and you should)
* **SSH (22)** for specific advanced case, as give possibility of SSH clone through your main self-hosted Git provider

{{< alert >}}
It's important to have your main SSH for terminal operations on different port than 22 as explained on 1st part of this tutorial, as the 22 port will be taken by Traefik.
{{< /alert >}}

{{< /tab >}}
{{< tab tabName="certificatesResolvers" >}}

The certificate resolver (aka [*Let's encrypt*](https://doc.traefik.io/traefik/https/acme/)) will be configured with **TLS-ALPN-01** challenge. The certificate results of this challenge will be stored on `acme.json` local cache file on the host in order to obviously avoid a certificate regeneration on every Traefik service restart.

{{< /tab >}}
{{< tab tabName="providers" >}}

This is the famous source of Traefik dynamic configuration. We only need of Docker as main provider here, but it supports [plenty else](https://doc.traefik.io/traefik/providers/overview/).

It indicates Traefik to read through Docker API in order to discover any new services and apply automatic configurations as well as SSL certificate without any restart. [Docker labels](https://docs.docker.com/config/labels-custom-metadata/) will be used for dynamic configuration.

* `swarmMode` : tell Traefik to uses labels found on services instead of individual containers (case of Docker Standalone mode).
* `exposedByDefault` : when false, force us to use `traefik.enable=true` as explicit label for automatic docker service discovery
* `network` : default network connection for all exposed containers
* `defaultRule` : default rule that will be applied to HTTP routes, in order to redirect particular URL to the right service. Each service container can override this default value with `traefik.http.routers.my-container.rule` label.

As a default route rule, I set here a value adapted for an automatic subdomain discovery. `{{ index .Labels "com.docker.stack.namespace" }}.sw.okami101.io` is a dynamic Go template string that means to use the `com.docker.stack.namespace` label that is applied by default on Docker Swarm on each deployed service. So if I deploy a swarm stack called `myapp`, Traefik will automatically set `myapp.sw.okami101.io` as default domain URL to my service, with automatic TLS challenge !

All I have to do is to add a specific label `traefik.enable=true` inside the Docker service configuration and be sure that it's on the `traefik_public` network.

{{< /tab >}}
{{< tab tabName="others" >}}

* `api` : enable a nice Traefik dashboard (with dark theme support !) that will be exposed on the local 8080 port by default
* `accessLog` : show all incoming requests through Docker STDOUT
* `metrics` : define all metrics to expose or export to a supported service. I will use Prometheus as a default here, it configures Traefik for exposing a new `/metrics` endpoint that will be consumed later by Prometheus

{{< /tab >}}
{{< /tabs >}}

#### Traefik deployment

In order to deploy Traefik on our shiny new Docker Swarm, we must write a Docker Swarm deployment file that looks like to a classic Docker compose file. Create a `traefik-stack.yml` file somewhere in your manager server with following content :

```yml
version: '3.2'

services:
  traefik:
    image: traefik:v2.5
    ports:
      - target: 22
        published: 22
        mode: host
      - target: 80
        published: 80
        mode: host
      - target: 443
        published: 443
        mode: host
    networks:
      - public
    volumes:
      - /etc/traefik:/etc/traefik
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - certificates:/certificates
    deploy:
      placement:
        constraints:
          - node.labels.traefik-public.certificates == true
      labels:
        - traefik.enable=true
        - traefik.http.middlewares.gzip.compress=true
        - traefik.http.middlewares.admin-auth.basicauth.users=admin:${HASHED_PASSWORD?Variable not set}
        - traefik.http.middlewares.admin-ip.ipwhitelist.sourcerange=78.228.120.81
        - traefik.http.routers.traefik-public-api.service=api@internal
        - traefik.http.routers.traefik-public-api.middlewares=admin-ip,admin-auth
        - traefik.http.services.traefik-public.loadbalancer.server.port=8080

networks:
  public:

volumes:
  certificates:
```

{{< tabs >}}
{{< tab tabName="networks" >}}

We declare 3 ports for each entry point, note as I will use [host mode](https://docs.docker.com/network/host/), useful extra performance and getting real IPs from clients.

Then we create a `public` network that will be created with [`overlay driver`](https://docs.docker.com/network/overlay/) (this is by default on swarm). This is the very important part in order to have a dedicated NAT for container services that will be exposed to the internet.

{{< /tab >}}
{{< tab tabName="volumes" >}}

We'll declare 3 volumes :

* `/etc/traefik` : location where we putted our above static configuration file
* `/var/run/docker.sock` : Required for allowing Traefik to access to Docker API in order to have automatic dynamic docker configuration working.
* `certificates` : named docker volume in order to store our acme.json generated file from all TLS challenge by Let's Encrypt.

{{< alert >}}
Note as we add `node.labels.traefik-public.certificates` inside `deploy.constraints` in order to ensure Traefik will run on the same server where certificates are located every time when Docker Swarm does service convergence.
{{< /alert >}}

{{< /tab >}}
{{< tab tabName="labels" >}}

This is the Traefik dynamic configuration part. I declare here many service that I will use later. Adapt for your own needs !

`traefik.enable=true` : Tell Traefik to expose himself through the network

##### The middlewares

* `gzip` : provides [basic gzip compression](https://doc.traefik.io/traefik/middlewares/http/compress/). Note as Traefik doesn't support brotli yep, which is pretty disappointed where absolutly all other reverse proxies support it...
* `admin-auth` : provides basic HTTP authorization. `basicauth.users` will use standard `htpasswd` format. I use `HASHED_PASSWORD` as dynamic environment variable.
* `admin-ip` : provides IP whitelist protection, given a source range.

##### The routers

* `traefik-public-api` : Configured for proper redirection to internal dashboard Traefik API from `traefik.sw.okami101.io`, which is defined by default rule. It's configured with above `admin-auth` and `admin-ip` for proper protection.

##### The services

* `traefik-public` : allow proper redirection to the default exposed 8080 port of Traefik container. This is sadly mandatory when using [Docker Swarm](https://doc.traefik.io/traefik/providers/docker/#port-detection_1)

{{< alert >}}
Keep in mind that the middlewares here are just declared as available for further usage in our services, but not applied globally, except for `gzip` that been declared globally to HTTPS entry point above in the static configuration.
{{< /alert >}}

{{< /tab >}}
{{< /tabs >}}

It's finally time to test all this massive configuration !

Go to the `manager-01`, be sure to have above /etc/traefik/traefik.yml file, and do following commands :

```sh
# declare the current node manager as main certificates host, required in order to respect above deploy constraint
export NODE_ID=$(docker info -f '{{.Swarm.NodeID}}')
docker node update --label-add traefik-public.certificates=true $NODE_ID

# generate your main admin password hash for any admin HTTP basic auth access into specific environment variable
export HASHED_PASSWORD=$(openssl passwd -apr1 aNyR4nd0mP@ssw0rd)

# deploy our 1st stack and cross the fingers...
docker stack deploy -c traefik-stack.yml traefik

# check status of the service, it should have 1 replica
docker service ls

# check logs for detail or any errors
docker service logs traefik_traefik
```

After few seconds, Traefik should launch and generate proper SSL certificate for his own domain. You can finally go to <https://traefik.sw.okami101.io>. `http://` should work as well thanks to permanent redirection.

If properly configured, you will be prompted for access. After entering admin as user and your own chosen password, you should finally access to the traefik dashboard similar to below !

![Traefik Dashboard](traefik-dashboard.png)

### Portainer

The hard part is done, we'll finish this 2nd part by installing Portainer. Portainer is constituted of

* A main GUI that must be exposed through Traefik
* An agent active for each docker node, realized by the global deployment mode of Docker Swarm. This agent will be responsible for getting all running dockers through API and send them to Portainer manager.

Create `portainer-agent-stack.yml` swarm stack file with follogin content :

```yml
version: '3.2'

services:
  agent:
    image: portainer/agent:2.11.1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /var/lib/docker/volumes:/var/lib/docker/volumes
    networks:
      - agent_network
    deploy:
      mode: global

  portainer:
    image: portainer/portainer-ce:2.11.1
    command: -H tcp://tasks.agent:9001 --tlsskipverify
    volumes:
      - /mnt/storage-pool/portainer:/data
    networks:
      - agent_network
      - traefik_public
    deploy:
      placement:
        constraints: [node.role == manager]
      labels:
        - traefik.enable=true
        - traefik.http.routers.portainer.middlewares=admin-ip
        - traefik.http.services.portainer.loadbalancer.server.port=9000

networks:
  agent_network:
  traefik_public:
    external: true
```

This is an adapted file from the official [Portainer Agent Stack](https://downloads.portainer.io/portainer-agent-stack.yml).

We use `agent_network` as overlay network for communication between agents and manager. No need of `admin-auth` middleware here as Portainer has his own authentication.

{{< alert >}}
Note that `traefik_public` must be set to **external** in order to reuse the original Traefik network.
{{< /alert >}}

Deploy the portainer stack :

```sh
# create the local storage for portainer in Gluster storage
sudo mkdir /mnt/storage-pool/portainer

# deploy portainer stack
docker stack deploy -c portainer-agent-stack.yml portainer

# check status
docker service ls
```

As soon as the main portainer service has successfully started, Traefik will detect it and configure it with SSL. The specific router for Portainer should appear in Traefik dashboard on HTTP section as below.

![Traefik routers](traefik-routers.png)

It's time to create your admin account through <https://portainer.sw.okami101.io>. If all goes well, aka Portainer agent are accessible from Portainer portal, you should have access to your cluster home environment with 2 stacks active.

![Portainer home](portainer-home.png)

{{< alert >}}
If you go to the stacks menu, you will note that both `traefik` end `portainer` are *Limited* control, because these stacks were done outside Portainer. We will create and deploy next stacks directly from Portainer GUI.
{{< /alert >}}
