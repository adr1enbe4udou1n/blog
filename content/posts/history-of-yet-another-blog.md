---
title: "History of yet another blog"
date: 2021-12-23
description: "Now I can say I finally have a blog..."
tags: ["hugo", "docker", "drone"]
---

{{< lead >}}
Here we are, never too late too init my first blog 🙊.
{{< /lead >}}

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

### Deployment

Hugo supports many deployments methods, with Github Actions as the simplest. In my case I prefer more self-hosted approach with my favorite CI/CD tool aka [Drone CI](https://www.drone.io/). Here is the simplest way to build an image and pushing into a custom private docker image registry.

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
      repo: registry.okami101.io/adr1enbe4udou1n/blog
      tags: latest
      username:
        from_secret: registry_username
      password:
        from_secret: registry_password
```
