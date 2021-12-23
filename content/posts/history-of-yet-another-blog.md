---
title: "History of yet another blog"
date: 2021-12-23
description: "Now I can say I finally have a blog..."
tags: ["hugo", "docker", "drone"]
---

Here we are, never too late too init my first blog 🙊.  
So as a [cliché](https://www.hsablonniere.com/once-upon-a-blog--9849zg/), this first post must have to talk about his blog...

## Why Hugo ?

I first exit obviously standard all-in-one CMS as `Wordpress` because I wanted to stay minimalist, by writing markdown posts. Markdown-based headless CMS as `Strapi` is more suited, but I prefer to avoid DB storing write posts directly via VS Code with proper Markdown extensions, all versioned on Git. Besides, I wanted to have minimal work to do on frontend side with all basic blog features (pagination, tags and so on...), just some configurations, without lose any more advanced customization if needed.

So static generator was the obvious choice and `Hugo` was by far the easiest to use in order to make minimally featured proper blog. So many modern and artistic [themes](https://themes.gohugo.io/). [Congo](https://github.com/jpanther/congo) was the perfect choice for me with `Dark Mode`and `Tailwind` as a bonus 😍.

### The repo

As you can see the repo of this blog `https://github.com/adr1enbe4udou1n/blog`, thanks hugo modules we easily successfully manage to have only what maters in the repo, i.e. only hugo and theme related config files and obviously the contents and layouts overload for customization.

## Deployment

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
