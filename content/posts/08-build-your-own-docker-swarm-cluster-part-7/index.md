---
title: "Setup a Docker Swarm cluster Part VII - CI/CD workflow"
date: 2022-02-21
description: "Build an opinionated containerized platform for developer..."
tags: ["docker", "swarm"]
draft: true
---

{{< lead >}}
Build your own cheap while powerful self-hosted complete CI/CD solution by following this opinionated guide 🎉
{{< /lead >}}

This is the **Part VII** of more global topic tutorial. [Back to first part]({{< ref "/posts/02-build-your-own-docker-swarm-cluster" >}}) to start from beginning.

## Self-hosted VCS 🍵

This specific VCS part is optional and is only for developers that would be completely independent of any cloud VCS providers, by self-hosting his own system.

{{< alert >}}
A backup is highly critical ! Don't underestimate that part and be sure to have a proper solution. **Restic** described in [this previous section]({{< ref "05-build-your-own-docker-swarm-cluster-part-4#data-backup-" >}}) is a perfect choice.
{{< /alert >}}

Of course, in a ~$30 cluster, forget about running a self-hosted GitLab, you will be forced to have an additionnal worker node with at least 4Gb fully dedicated just for running it. I will privilege here a super lightweight solution, Gitea. Besides, the last version 1.16 finally support dark mode !

### Install Gitea 💽

You guess it, it's just an additional stack to run !

Let's do `sudo mkdir /mnt/storage-pool/gitea`

Then create a new `gitea` stack :

```yml
version: '3.8'

services:
  gitea:
    image: gitea/gitea:1.16
    volumes:
      - /etc/hosts:/etc/hosts
      - /mnt/storage-pool/gitea:/data
    networks:
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.services.gitea.loadbalancer.server.port=3000
        - traefik.tcp.routers.gitea-ssh.rule=HostSNI(`*`)
        - traefik.tcp.services.gitlab-ssh.loadbalancer.server.port=22
      placement:
        constraints:
          - node.role == manager

networks:
  traefik_public:
    external: true
```

{{< alert >}}
Note as we're adding a specific TCP router in order to allow SSH cloning. The SSH Traefik entry point will redirect to the first available service with TCP router.
{{< /alert >}}

Now go to <https://gitea.sw.okami101.io> and go through the installation procedure. Change default SQLite provider by a more production purpose database.

Create a new `gitea` PostgreSQL database as usual from pgAdmin or `psql` for pro-CLI user, and set the according DB info access to Gitea installer. Host should be `data-01`.

Don't forgive to change all domain related field by the proper current domain URL, which is `gitea.sw.okami101.io` in my case. You should set proper SMTP settings for notifications.

![Gitea admin dashboard](gitea-install.png)

For information all these settings are saved in `/mnt/storage-pool/gitea/gitea/conf/app.ini` file. You can change them at any time. You may want to disable registration by changing `DISABLE_REGISTRATION`.

Next just create your first account. The 1st account will be automatically granted to administrator.

![Gitea admin dashboard](gitea-admin-dashboard.png)

You should now test creating some repos and be sure that git cloning works on both HTTPS and SSH protocol. For SSH be sure to add your own SSH public key in your profile.

## Private docker registry

Before attack the CI/CD part, we should take care of where we put our main docker images that will be automatically be built when every code pushes. You have the choice to use main Docker hub of course but honestly, we have a full cluster now, let's use it fully !

### Install official docker registry 💽

We'll use the official docker registry with addition of nice simple UI for images navigation. It's always the same, do `sudo mkdir /mnt/storage-pool/registry` and create `registry` stack :

```yml
version: '3.3'

services:
  app:
    image: registry:2
    environment:
      REGISTRY_STORAGE_DELETE_ENABLED: 'true'
    volumes:
      - /mnt/storage-pool/registry:/var/lib/registry
    networks:
      traefik_public:
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.registry.rule=Host(`registry.sw.okami101.io`) && PathPrefix(`/v2`)
        - traefik.http.routers.registry.middlewares=admin-auth
        - traefik.http.services.registry.loadbalancer.server.port=5000
      placement:
        constraints:
          - node.role == manager

  ui:
    image: joxit/docker-registry-ui
    environment:
      DELETE_IMAGES: 'true'
      SINGLE_REGISTRY: 'true'
    networks:
      traefik_public:
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.registryui.middlewares=admin-auth
        - traefik.http.services.registryui.loadbalancer.server.port=80
      placement:
        constraints:
          - node.role == manager

networks:
  traefik_public:
    external: true
```

{{< alert >}}
Note as both service must be exposed to Traefik. In order to keep the same subdomain, we made usage of `PathPrefix` feature provided by Traefik with `/v2`.  
It gives us have an additional condition for redirect to the correct service. It's ok in our case because the official docker registry use only `/v2` as endpoint.
{{< /alert >}}

Go to <https://registry.sw.okami101.io> and use Traefik credentials. We have no images yet let's create one.

### Test our private registry

Login into the `manager-01` server, do `docker login registry.sw.okami101.io` and enter proper credentials. You should see *Login Succeeded*. Don't worry about the warning. Create the next Dockerfile somewhere :

```Dockerfile
FROM alpine:latest
RUN apk add --no-cache git
```

Then build and push the image :

```sh
docker build -t alpinegit .
docker tag alpinegit registry.sw.okami101.io/alpinegit
docker push registry.sw.okami101.io/alpinegit
```

Go back to above <https://registry.sw.okami101.io>. You should see 1 new image !

![Docker registry](docker-registry.png)

Delete the image test through UI and from local docker with `docker image rm registry.sw.okami101.io/alpinegit`.

{{< alert >}}
Note as the blobs of image is always physically in the disk, even when "deleted". You must launch manually the docker GC in order to cleanup unused images.  
For that execute `registry garbage-collect /etc/docker/registry/config.yml` inside docker registry.
{{< /alert >}}

## CI/CD with Drone 🪁

```sh
# get the docker node id of runner
docker node ls

# update environment label
docker node update --label-add environment=runner xxxxxx
```

Let's create a new `drone` PostgreSQL database and create a new `drone` stack :

```yml
version: '3.8'

services:
  drone:
    image: drone/drone:2
    volumes:
      - /etc/hosts:/etc/hosts
    environment:
      DRONE_DATABASE_DRIVER: postgres
      DRONE_DATABASE_DATASOURCE: postgres://drone:${DRONE_DATABASE_PASSWORD}@data-01:5432/drone?sslmode=disable
      DRONE_GITEA_CLIENT_ID:
      DRONE_GITEA_CLIENT_SECRET:
      DRONE_RPC_SECRET:
      DRONE_SERVER_HOST: drone.sw.okami101.io
      DRONE_SERVER_PROTO: https
      DRONE_USER_CREATE: username:adr1enbe4udou1n,admin:true
      DRONE_USER_FILTER: okami101
    networks:
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.services.drone.loadbalancer.server.port=80
      placement:
        constraints:
          - node.role == manager

  runner-docker:
    image: drone/drone-runner-docker
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      DRONE_RPC_SECRET:
      DRONE_RPC_HOST: ${DRONE_SERVER_HOST}
      DRONE_RPC_PROTO: ${DRONE_SERVER_PROTO}
    deploy:
      placement:
        constraints:
          - node.labels.environment == runner

networks:
  traefik_public:
    external: true
```

## SonarQube 📈

## Tracing with Jaeger with OpenTelemetry 🕰️

## Final check 🎊🏁🎊

We've done all the basics part of installing, using, testing a professional grade Docker Swarm cluster.
