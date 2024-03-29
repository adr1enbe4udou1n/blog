---
title: "Setup a Docker Swarm cluster Part VII - CI/CD workflow"
date: 2022-02-21
description: "Build an opinionated containerized platform for developer..."
tags: ["docker", "swarm"]
---

{{< lead >}}
Build your own cheap but powerful self-hosted cluster and be free from any SaaS solutions by following this opinionated guide 🎉
{{< /lead >}}

This is the **Part VII** of more global topic tutorial. [Back to first part]({{< ref "/posts/02-build-your-own-docker-swarm-cluster" >}}) for intro.

## Self-hosted VCS 🍵

This specific VCS part is optional and is only for developers that would be completely independent of any cloud VCS providers, by self-hosting its own system.

{{< alert >}}
A backup is highly critical ! Don't underestimate that part and be sure to have a proper solution. **Restic** described in [this previous section]({{< ref "05-build-your-own-docker-swarm-cluster-part-4#data-backup-" >}}) is a perfect choice.
{{< /alert >}}

Of course, in this low-budget cluster, forget about running properly a self-hosted GitLab, you will be forced to have an additionnal worker node with at least 4Gb fully dedicated just for running it. I will privilege here a super lightweight solution, Gitea. Besides, the last version 1.16 finally support dark mode !

### Install Gitea 💽

You guess it, it's just an additional stack to run !

Do `sudo mkdir /mnt/storage-pool/gitea` and create next stack :

{{< highlight host="stack" file="gitea" >}}

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
        - traefik.http.routers.gitea.entrypoints=https
        - traefik.http.services.gitea.loadbalancer.server.port=3000
        - traefik.tcp.routers.gitea-ssh.rule=HostSNI(`*`)
        - traefik.tcp.routers.gitea-ssh.entrypoints=ssh
        - traefik.tcp.services.gitea-ssh.loadbalancer.server.port=22
      placement:
        constraints:
          - node.role == manager

networks:
  traefik_public:
    external: true
```

{{< /highlight >}}

{{< alert >}}
We added a specific TCP router in order to allow SSH cloning. The SSH Traefik entry point will redirect to the first available service with TCP router.
{{< /alert >}}

Now go to  `https://gitea.sw.dockerswarm.rocks` and go through the installation procedure. Change default SQLite provider by a more production purpose database.

Create a new `gitea` PostgreSQL database as usual from pgAdmin or `psql` for pro-CLI user, and set the according DB info access to Gitea installer. Host should be `data-01`.

Don't forgive to change all domain related field by the proper current domain URL. You should set proper SMTP settings for notifications.

[![Gitea admin dashboard](gitea-install.png)](gitea-install.png)

For information all these settings will be saved in `/mnt/storage-pool/gitea/gitea/conf/app.ini` file. You can change them at any time. You may want to disable registration by changing `DISABLE_REGISTRATION`.

Next just create your first account. The 1st account will be automatically granted to administrator.

[![Gitea admin dashboard](gitea-admin-dashboard.png)](gitea-admin-dashboard.png)

You should now test creating some repos and be sure that git cloning works on both HTTPS and SSH protocol. For SSH be sure to add your own SSH public key in your profile.

## Private docker registry

Before attack the CI/CD part, we should take care of where we put our main docker images that will be automatically be built when every code pushes. You have the choice to use main Docker hub of course but honestly, we have a full cluster now, let's use it fully !

### Install official docker registry 💽

We'll use the official docker registry with addition of nice simple UI for images navigation. It's always the same, do `sudo mkdir /mnt/storage-pool/registry` and create next stack :

{{< highlight host="stack" file="registry" >}}

```yml
version: '3.8'

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
        - traefik.http.routers.registry.entrypoints=https
        - traefik.http.routers.registry.middlewares=admin-auth
        - traefik.http.routers.registry.rule=Host(`registry.sw.dockerswarm.rocks`) && PathPrefix(`/v2`)
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
        - traefik.http.routers.registryui.entrypoints=https
        - traefik.http.routers.registryui.middlewares=admin-auth
        - traefik.http.services.registryui.loadbalancer.server.port=80
      placement:
        constraints:
          - node.role == manager

networks:
  traefik_public:
    external: true
```

{{< /highlight >}}

{{< alert >}}
Note as both service must be exposed to Traefik. In order to keep the same subdomain, we made usage of `PathPrefix` feature provided by Traefik with `/v2`.  
It gives us have an additional condition for redirect to the correct service. It's ok in our case because the official docker registry use only `/v2` as endpoint.
{{< /alert >}}

Go to `https://registry.sw.dockerswarm.rocks` and use Traefik credentials. We have no images yet let's create one.

### Test our private registry

Create a Dockerfile sample file somewhere :

{{< highlight host="manager-01" file="~/Dockerfile" >}}

```Dockerfile
FROM alpine:latest
RUN apk add --no-cache git
```

{{< /highlight >}}

Then build and push the image :

{{< highlight host="manager-01" >}}

```sh
# enter proper credentials
docker login registry.sw.dockerswarm.rocks

# build the image
docker build -t alpinegit .
docker tag alpinegit registry.sw.dockerswarm.rocks/alpinegit
docker push registry.sw.dockerswarm.rocks/alpinegit
```

{{< /highlight >}}

Go back to above `https://registry.sw.dockerswarm.rocks`. You should see 1 new image !

[![Docker registry](docker-registry.png)](docker-registry.png)

Delete the image test through UI and from local docker with `docker image rm registry.sw.dockerswarm.rocks/alpinegit`.

{{< alert >}}
Note as the blobs of image is always physically in the disk, even when "deleted". You must launch manually the docker GC in order to cleanup unused images.  
For that execute `registry garbage-collect /etc/docker/registry/config.yml` inside docker registry container console. You can ssh into it directly through Portainer.
{{< /alert >}}

### Register registry in Portainer

For our future app deployments from our built docker image, we need to register our new private registry with proper credentials. Go to *Registries* menu of Portainer, and create the new registry.

[![Portainer registries](portainer-registries.png)](portainer-registries.png)

Save it, and you have registered repository, which will allow proper pulling from it for next custom app stack deployments.

## CI/CD with Drone 🪁

It's finally time to use our currently unused `runner-01` ! We'll use Drone as free self-hosted solution for docker image building. The all CI/CD process can be summarized to this flow chart :

{{< mermaid >}}
flowchart TD
subgraph manager-01
traefik((Traefik))
drone((Drone))
gitea((Gitea))
registry((Registry))
end
subgraph worker-01
my-app((My App 01))
end
subgraph runner-01
drone-runner((Drone runner))
end
traefik-->drone
traefik-->gitea
traefik-->registry
traefik-->my-app
gitea-- webhook on pushed code -->drone
drone-- start pipeline in runner -->drone-runner
gitea-- repo clone -->drone-runner
drone-runner-- push built docker image -->registry
registry-- pull image when deploy stack -->my-app
{{< /mermaid >}}

Let's follow [the official docs](https://docs.drone.io/server/provider/gitea/) for generating a OAuth2 application on Gitea, which is necessary for Drone integration. Set `https://drone.sw.dockerswarm.rocks` as redirect UI after successful authentication.

[![Gitea drone application](gitea-drone-application.png)](gitea-drone-application.png)

Save and keep the client and secret tokens. Then create a new `drone` PostgreSQL database and create next stack :

{{< highlight host="stack" file="drone" >}}

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
      DRONE_GITEA_SERVER: https://gitea.sw.dockerswarm.rocks
      DRONE_RPC_SECRET:
      DRONE_SERVER_HOST:
      DRONE_SERVER_PROTO:
      DRONE_USER_CREATE: username:adr1enbe4udou1n,admin:true
    networks:
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.drone.entrypoints=https
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
          - node.labels.environment == build

networks:
  traefik_public:
    external: true
```

{{< /highlight >}}

{{< alert >}}
Don't forget to have proper docker labels on nodes, as explain [here]({{< ref "04-build-your-own-docker-swarm-cluster-part-3#cli-tools--environment-labels" >}}), otherwise docker runner will not run because of `node.labels.environment == build`.
{{< /alert >}}

| variable                    | description                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `DRONE_SERVER_HOST`         | The host of main Drone server. I'll use `drone.sw.dockerswarm.rocks` here.                                                      |
| `DRONE_SERVER_PROTO`        | The scheme protocol, which is `https`.                                                                                          |
| `DRONE_GITEA_CLIENT_ID`     | Use the above client ID token.                                                                                                  |
| `DRONE_GITEA_CLIENT_SECRET` | Use the above client secret token.                                                                                              |
| `DRONE_DATABASE_PASSWORD`   | Use the database password.                                                                                                      |
| `DRONE_RPC_SECRET`          | Necessary for proper secured authentication between Drone and runners. Use `openssl rand -hex 16` for generating a valid token. |
| `DRONE_USER_CREATE`         | The initial user to create at launch. Put your Gitea username here for setting automatically Gitea user as drone administrator. |

It's time to go to `https://drone.sw.dockerswarm.rocks` and generate your first Drone account through OAuth2 from Gitea. You should be properly redirected to Gitea, where you'll just have to authorize Drone application.

[![Gitea oauth2](gitea-oauth2.png)](gitea-oauth2.png)

Finalize registration, and you should finally arrive to main Drone dashboard. If you have already created some repositories, they should appear in the list.

[![Drone dashboard](drone-dashboard.png)](drone-dashboard.png)

{{< alert >}}
Ensure that the runner detect the remote Drone server before continue. You can check through Grafana logs for any `successfully pinged the remote server`.
{{< /alert >}}

## Test with basic project

We have all the minimal CI/CD pipeline in place ! Let's create a basic backend Dotnet API and test all CI/CD workflow !

### Create new API project ✨

Firstly, create a new `my-weather-api` private repository through Gitea. I'll use `main` as default branch here.

[![Gitea new repository](gitea-empty-repository.png)](gitea-empty-repository.png)

Next I presume you have [.NET SDK](https://dotnet.microsoft.com/en-us/download) locally installed. Create a new ASP.NET Core Web API project and push into Gitea.

```sh
dotnet new webapi -o my-weather-api --no-https

cd my-weather-api

dotnet new gitignore

git init
git add .
git commit -m "first commit"
git remote add origin git@gitea.sw.dockerswarm.rocks:adr1enbe4udou1n/my-weather-api.git # if you use ssh
git push -u origin main
```

{{< alert >}}
Don't forget `--no-https` as we'll use Traefik as main SSL provider, otherwise the app will not properly respond when deployed. It will simply skip the `app.UseHttpsRedirection();` line code middleware.
{{< /alert >}}

Project should be pushed correctly :

[![Gitea new repository](gitea-new-repository.png)](gitea-new-repository.png)

### Drone configuration 🛠️

Let's now activate the repo in Drone. Click on *SYNC* button. Click on new repo and activate the repository.

[![Drone repository settings](drone-repository-settings.png)](drone-repository-settings.png)

It will create a webhook inside repository settings, triggered on every code push.

Now generate a new SSH key on `manager-01` :

{{< highlight host="manager-01" >}}

```sh
ssh-keygen -t ed25519 -C "admin@sw.dockerswarm.rocks"
cat .ssh/id_ed25519 # the private key to set in swarm_ssh_key
cat .ssh/id_ed25519.pub # the public key to add just below
echo "ssh-ed25519 AAAA... admin@sw.dockerswarm.rocks" | tee -a .ssh/authorized_keys
```

{{< /highlight >}}

Then configure the repository settings on Drone. Go to *Organization > Secrets* section and add some global secrets.

| name                | description                                |
| ------------------- | ------------------------------------------ |
| `registry_username` | The username access of our docker registry |
| `registry_password` | The password access of our docker registry |
| `swarm_ssh_key`     | The **private** above key                  |

[![Drone secrets](drone-secrets.png)](drone-secrets.png)

### Configure the pipelines (the CI part) 🏗️

For working, Drone needs a `.drone.yml` file in root of repository. This file will describe all steps of our build pipeline. Let's create and explain it :

{{< highlight file=".drone.yml" >}}

```yml
kind: pipeline
type: docker
name: default

steps:
  - name: build
    image: mcr.microsoft.com/dotnet/sdk:6.0
    commands:
      - dotnet publish -c Release -o ./publish

  - name: image
    image: plugins/docker
    settings:
      registry: registry.sw.dockerswarm.rocks
      repo: registry.sw.dockerswarm.rocks/adr1enbe4udou1n/my-weather-api
      tags: latest
      username:
        from_secret: registry_username
      password:
        from_secret: registry_password

trigger:
  event:
    - push
    - pull_request
```

{{< /highlight >}}

It's just simple 2 steps :

1. `build` : Here is the step for project dependencies import, compilation, testing, and code linting / formatting. This is a very basic project here, so we start with a simple building. The image `mcr.microsoft.com/dotnet/sdk:6.0` is the required docker image for proper .NET building. The publish command will generate a `publish` subdirectory.
2. `image` : We use the [official docker plugin](https://plugins.drone.io/drone-plugins/drone-docker/) for building our final production based docker image, done from the below Dockerfile. Use `repo` as the final docker image name.

Next create the Dockerfile which will be used for `image` step :

{{< highlight file="Dockerfile" >}}

```Dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:6.0
RUN apt-get install -y tzdata

COPY /publish /app
WORKDIR /app

ENTRYPOINT ["dotnet", "my-weather-api.dll"]
```

{{< /highlight >}}

We use production suited .NET runtime image `mcr.microsoft.com/dotnet/aspnet:6.0`. Note as **WE MUST** do the simplest commands possible in order to have the lightest image layers, as it's the production image. All we have to do is to copy the final published binaries from above `build` drone step.

Commit both above files and push to remote repo. Drone should be automatically triggered for building and activate the runner. The runner will clone the project and process all pipeline's steps.

[![Drone build](drone-build.png)](drone-build.png)

If all's going well, the final image should be pushed in our docker registry. You can ensure it by navigating to `https://registry.sw.dockerswarm.rocks`.

### Deployment (the CD part) 🚀

Our application is now ready for production deployment ! Let's create our new shiny stack :

{{< highlight host="stack" file="weather" >}}

```yml
version: '3.8'

services:
  app:
    image: registry.sw.dockerswarm.rocks/adr1enbe4udou1n/my-weather-api
    environment:
      ASPNETCORE_ENVIRONMENT: Development
    networks:
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.my-weather-api.entrypoints=https
        - traefik.http.services.my-weather-api.loadbalancer.server.port=80
      placement:
        constraints:
          - node.labels.environment == production

networks:
  traefik_public:
    external: true
```

{{< /highlight >}}

{{< alert >}}
I use `Development` in order to have the swagger UI.  
Be sure to have registered the private registry in Portainer before deploying as [explained here](#register-registry-in-portainer).
{{< /alert >}}

Finally, deploy and see the result in `https://weather.sw.dockerswarm.rocks/swagger`. You should access to the swagger UI, and API endpoints should correctly respond.

#### Continuous deployment

Now it's clear that we don't want to deploy manually every time when the code is pushed.

First be sure that following `docker service update --image registry.sw.dockerswarm.rocks/adr1enbe4udou1n/my-weather-api:latest weather_app --with-registry-auth` command works well in `manager-01`. It's simply update the current `weather_app` service with the last available image version from the private registry.

Now we must be sure that the `runner-01` host can reach the `manager-01` server from outside. If you have applied the firewall at the beginning of this tutorial, only our own IP is authorized. Let's add the public IP of `runner-01` to your `firewall-external` inside Hetzner console.

Now let's add a new `deploy` step inside `.drone.yml` into our pipeline for automatic deployment !

{{< highlight file=".drone.yml" >}}

```yml
#...
  - name: deploy
    image: appleboy/drone-ssh
    settings:
      host: sw.dockerswarm.rocks
      port: 2222
      username: swarm
      key:
        from_secret: swarm_ssh_key
      script:
        - docker service update --image registry.sw.dockerswarm.rocks/adr1enbe4udou1n/my-weather-api:latest weather_app --with-registry-auth
#...
```

{{< /highlight >}}

Let's test by editing `Program.cs` file :

{{< highlight file="Program.cs" >}}

```cs
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Weather API",
        Version = "0.0.1",
    });
});
```

{{< /highlight >}}

Push and back to your API, and the title and version should be automatically updated !

[![Weather API](weather-api.png)](weather-api.png)

## 6th check ✅

We've done all the main CI/CD part.

Now let's go even further in the exploitation of our new cluster development environment in the [last part]({{< ref "/posts/09-build-your-own-docker-swarm-cluster-part-8" >}}).
