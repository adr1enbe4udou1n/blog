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

Here we'll talk about static configuration. Create a YAML file under `/etc/traefik/traefik.yml` with following content (TOML is also supported) :

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
    network: traefik-public
api: {}
metrics:
  prometheus: {}
accessLog: {}
```

At first we declare our 3 entry points

* **HTTPS (443)** as main Web access, I added a global middleware called `gzip` that will be configured on dynamic configuration for proper compression as well as `le`, aka *Let's encrypt*, as main certificate resolver
* **HTTP (80)** with automatic permanent HTTPS redirection, so every web service will be assured to be accessed through HTTPS only (and you should)
* **SSH (22)** for specific advanced case, as give possibility of SSH clone through your main self-hosted Git provider

{{< alert >}}
It's important to have your main SSH for terminal operations on different port than 22 as explained on 1st part of this tutorial, as the 22 port will be taken by Traefik.
{{< /alert >}}

Next the certificate resolver (aka [*Let's encrypt*](https://doc.traefik.io/traefik/https/acme/)) will be configured as simple tlsChallenge. The certificate results of this challenge will be stored on `acme.json` local cache file on the host in order to obviously avoid a certificate regeneration on every Traefik service restart.

#### Traefik deployment

In order to deploy Traefik on our shiny new Docker Swarm, we must write a Docker Swarm deployment file that looks like to a classic Docker compose file. Create a `traefik-stack.yml` file somewhere in your manager server with following content :

```yml
version: '3.2'

services:
  traefik:
    image: traefik:v2.5
    ports:
      - target: 22
        mode: host
      - target: 80
        mode: host
      - target: 443
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
          - node.labels.traefik-public.traefik-public-certificates == true
      labels:
        - traefik.enable=true
        - traefik.http.middlewares.gzip.compress=true
        - traefik.http.middlewares.admin-auth.basicauth.users=admin:${HASHED_PASSWORD?Variable not set}
        - traefik.http.middlewares.admin-ip.ipwhitelist.sourcerange=78.228.120.81
        - traefik.http.routers.traefik-public-https.entrypoints=https
        - traefik.http.routers.traefik-public-https.service=api@internal
        - traefik.http.routers.traefik-public-https.middlewares=admin-ip,admin-auth
        - traefik.http.services.traefik-public.loadbalancer.server.port=8080

networks:
  public:

volumes:
  certificates:
```

You should adapt to your custom needs. Some notes :

* We declare 3 ports for each different entry point, note as I will use [host mode](https://docs.docker.com/network/host/), useful extra performance and getting real IPs from clients.
* We create a `public` network that will be created with [`overlay driver`](https://docs.docker.com/network/overlay/) (this is by default on swarm). This is the very important part in order to have a dedicated NAT for container services that will be exposed to the internet.
* 3 volumes
  * `/etc/traefik` : we'll put our main static required configuration here

The *dynamic* part will be done on `labels` under `deploy` docker compose section.

<https://downloads.portainer.io/portainer-agent-stack.yml>

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
      placement:
        constraints: [node.platform.os == linux]

  portainer:
    image: portainer/portainer-ce:2.11.1
    command: -H tcp://tasks.agent:9001 --tlsskipverify
    ports:
      - "9443:9443"
      - "9000:9000"
      - "8000:8000"
    volumes:
      - portainer_data:/data
    networks:
      - agent_network
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints: [node.role == manager]

networks:
  agent_network:
    driver: overlay
    attachable: true

volumes:
  portainer_data:
```
