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

## Self-hosted VCS

This specific VCS part is optional and is only for developers that would be completely independent of any cloud VCS providers, by self-hosting his own system.

{{< alert >}}
A backup is highly critical ! Don't underestimate that part and be sure to have a proper solution. **Restic** described in [this previous section]({{< ref "05-build-your-own-docker-swarm-cluster-part-4#data-backup-" >}}) is a perfect choice.
{{< /alert >}}

Of course, in a ~$30 cluster, forget about running a self-hosted GitLab, you will be forced to have an additionnal worker node with at least 4Gb fully dedicated just for running it. I will privilege here a super lightweight solution, Gitea. Besides, the last version 1.16 finally support dark mode !

### Install Gitea 🍵

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

## CI/CD with Drone 🪁

## SonarQube 📈

## Tracing with Jaeger with OpenTelemetry 🕰️

## Final check 🎊🏁🎊

We've done all the basics part of installing, using, testing a professional grade Docker Swarm cluster.
