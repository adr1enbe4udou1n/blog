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

### Installing the Traefik 💞 Portainer combo

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
    volumes:
      - /etc/traefik:/etc/traefik
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik-public-certificates:/certificates
    networks:
      - jaeger_private
      - traefik-public

networks:
  jaeger_private:
    external: true
  traefik-public:
    external: true

volumes:
  traefik-public-certificates:
```

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
