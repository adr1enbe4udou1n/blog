---
title: "History of yet another blog"
date: 2021-12-23
description: "Now I can say I finally have a blog..."
tags: ["hugo", "docker", "drone"]
slug: history-of-yet-another-blog
---

{{< lead >}}
I have a dream that I'll have a blog...
{{< /lead >}}

Here we are, never too late too init my first blog 🙊.
So as a [cliché](https://www.hsablonniere.com/once-upon-a-blog--9849zg/), this first post must have to talk about his blog...

## Why Hugo ?

I first exit obviously standard all-in-one CMS as `Wordpress`. As a markdown lover, Markdown-based headless CMS as `Strapi` seemed more suited, but I clearly prefer to avoid any heavy BO+DB storing combo and use Git power for proper native source revisions. Writing posts directly via VS Code with proper [Markdown extensions](https://github.com/valentjn/vscode-ltex) stays an invaluable experience for me 👌

Besides, I wanted to have minimal work to do on frontend side 🚀 with all basic blog features (pagination, tags and so on...) 🎉, just some configurations, without lose any more advanced customization if needed 🛠️.

So flat-file based 📄 static generator was the obvious choice and `Hugo` was by far the easiest to use in order to make minimally featured proper blog. Hugo site documentation is clear and proposes many modern and artistic [themes](https://themes.gohugo.io/).

### The theme

[Congo](https://github.com/jpanther/congo) was the perfect choice for me with `Dark Mode`and `Tailwind` as a bonus 😍. It provides [additional shortcodes](https://jpanther.github.io/congo/docs/shortcodes/) as alert, badge, button, icons, katex, lead, as well as complete [charts](https://jpanther.github.io/congo/samples/charts/) and [diagrams](https://jpanther.github.io/congo/samples/diagrams-flowcharts/) system.

### The comments system

I found [utterances](https://utteranc.es/) as the perfect Disqus alternative choice between tracking-free, quick and easiest install, open source and not too much vendor locking by integrate comments directly to actual blog Github repo issues.

You obviously must have a Github account, if you prefer self-hosted solution and multi social login choices, it seems that [Remark42](https://github.com/umputun/remark42) is the perfect choice. Besides, it has official ready to go [Docker](https://hub.docker.com/r/umputun/remark42) image.

### The repo

As you can see the [repo of this blog](https://github.com/adr1enbe4udou1n/blog), thanks to Hugo modules we easily successfully manage to have *only what maters* versioned, i.e. only hugo and theme related config files and obviously the contents and layouts overload for customization.

### Automatic build

As any static site generators, the process steps are :

1. Generate all static assets files from the content.
2. Serving these outputted assets through simple web server as Nginx.

Hugo supports many deployments methods, with Github Actions as one of the simplest. In my case I prefer more self-hosted approach with my favorite CI/CD tool aka [Drone CI](https://www.drone.io/). Here is the simplest way to build an image and pushing into a custom private docker image registry.

```yaml
kind: pipeline
type: docker
name: default

steps:
  - name: build
    image: peaceiris/hugo:latest-mod
    commands:
      - hugo --minify

  - name: image
    image: plugins/docker
    settings:
      registry: registry.okami101.io
      repo: registry.okami101.io/adr1enbe4udou1n/blog
      tags: latest
      username:
        from_secret: registry_username
      password:
        from_secret: registry_password
```

{{< alert >}}
Note as I use `latest-mod` image tag in my case because I use Congo theme as Go modules dependency, which is the cleanest way to do it as I do not need to include it on my repo. The `latest` image tag has only Hugo binary without Go dependency.
{{< /alert >}}

This Drone pipeline consists of simple 2 steps as we're talking above :

1. The first **build step** use minimal Go based image container which includes Hugo binary. All we have to do is launching `hugo --minify` command which will firstly download Congo theme dependency and then generate all assets into `public` subfolder. Note as Drone will automatically clone the repo with `depth=1` and mount it into Hugo container.
2. Then we use official [Docker plugin](http://plugins.drone.io/drone-plugins/drone-docker/) in order to build our final docker image and **push into custom private registry**.

{{< alert >}}
In order to use public docker registry simply change image step as following :

```yaml
...
  - name: image
    image: plugins/docker
    settings:
      repo: foo/bar
      tags: latest
      username:
        from_secret: docker_username
      password:
        from_secret: docker_password
...
```

{{< /alert >}}

The Drone Docker plugin needs a local **Dockerfile** which will describe how to build the image. In our case, all we need is to choose a light web server (`Nginx` will be perfect) and copy previously built `public` subfolder from the 1st step into our docker image. It's only 2 lines !

```Dockerfile
FROM nginx:alpine

COPY public /usr/share/nginx/html
```

{{< alert >}}
By default Nginx use `/usr/share/nginx/html` as default public directory.
{{< /alert >}}

Note as Drone will automatically mount the current volume state on each step so the `public` folder will be directly available on all subsequent step.

It's that it. We now have ready-to-deploy production image that will be auto updated on each push.

### Hosting & Deployment

In my case, I use custom self-hosted `Docker Swarm` for all my projects, and [`Traefik`](https://doc.traefik.io/traefik/) as reverse proxy. This proxy allows automatic service discovery and SSL management. All I have to do is define a new blog `stack` into my swarm cluster. A stack is just the same as docker-compose file in standalone Docker host, but with additional `deploy` statement that allows resource management as scaling strategy, etc.

```yaml
version: "3"

services:
  app:
    image: registry.okami101.io/adr1enbe4udou1n/blog
    networks:
      - traefik-public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.blog.entrypoints=https
        - traefik.http.routers.blog.rule=Host(`blog.okami101.io`)
        - traefik.http.services.blog.loadbalancer.server.port=80

networks:
  traefik-public:
    external: true
```

If we forget all necessary `traefik` related config, the stack can't be more basic than that. It's just a matter of pulling our image from our private registry. Don't forget to save private registry credentials by `drone login hub.myregistry.com` command before.

All we have to do is to redirect web traffic from custom domain to our new Docker container instantiated from our final image. It's really easy with a proper configured Traefik reverse proxy :

1. Firstly the service must be connected to the public dedicated Traefik internal private network.
2. The `traefik.enable=true` deploy labels allows automatic discovery by Traefik. This is required when [`exposedByDefault`](https://doc.traefik.io/traefik/providers/docker/#exposedbydefault) is set to `false`.
3. The `traefik.http.routers.blog.entrypoints` is used for selecting the proper configured [entrypoint](https://doc.traefik.io/traefik/routing/entrypoints/). See it as the external port access between end users and your host.
4. The `traefik.http.routers.blog.rule` allows proper routing from a specific URL request pattern (most of the time the DNS host) to this service.
5. Finally the `traefik.http.services.blog.loadbalancer.server.port` is mandatory for Docker Swarm in order to proper routing to the internal port of our Docker image. For Nginx based images, it's `80` by default.

Then use the `docker stack deploy -c blog.yml blog` command for launching the stack. If successfully started, Traefik will automatically discover the new service and route all traffics from `blog.okami101.io` URLs to our custom Nginx container.

### Continuous Deployment

The final task is to configure automatic deploy to production on each push. For that we have to restart the above service on every push. This can be achieved via `docker service update blog_app`, note as `blog_app` is the default service name that follow `<stack_name>_<service_name>` naming convention.

**BUT** by default it will not use the latest updated image by default. So we need to add additional `--image` argument as following : `docker service update --image registry.okami101.io/adr1enbe4udou1n/blog:latest blog_app --with-registry-auth`. The `--with-registry-auth` argument is mandatory for private registries. This command **must be launch on a manager** Swarm cluster.

All we have to do now is to use our Drone pipeline with a new final *deploy* step that will consist on simple SSH command 🙌 with this above one-line script. This can be achieved easily thanks to [Drone SSH plugin](http://plugins.drone.io/appleboy/drone-ssh/).

```yaml
...
  - name: deploy
    image: appleboy/drone-ssh
    settings:
      host: front.okami101.io
      port: 2222
      username: okami
      key:
        from_secret: swarm_ssh_key
      script:
        - docker service update --image registry.okami101.io/adr1enbe4udou1n/blog:latest blog_app --with-registry-auth
...
```

{{< alert >}}
`swarm_ssh_key` is the secret private SSH key that will allow proper SSH connection to the swarm manager cluster.
{{< /alert >}}

We have now full CI/CD 🎉. Pretty heavy for just a fancy blog, but it would be not cool without a little overkill complexity. Moreover, it will be impossible to write my first post ! A blog without a single post will be so sad 🙈.

I just regret to not have tried with Kubernetes or either tried to develop my [own fancy HTTP framework](https://www.hsablonniere.com/once-upon-a-blog--9849zg/#served-with-my-own-http-framework) as Hubert do for more 📎🔥...

{{< lead >}}
Now, I have a blog...
{{< /lead >}}
