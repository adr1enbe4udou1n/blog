---
title: "Welcome to Okami101 Blog! :tada:"
description: "This is adr1enbe4udou1n blog."
---

{{< lead >}}
A 🧔🌍💻 aka senior web developer @Bretagne 🇫🇷
{{< /lead >}}

Hi folks, I'm a web lover actually working [@Cesson-Sévigné](https://fr.wikipedia.org/wiki/Cesson-S%C3%A9vign%C3%A9), mastering :

* [`ASP.NET Core`](https://docs.microsoft.com/fr-fr/aspnet/core/?view=aspnetcore-6.0) with `C#` and [`Laravel`](https://laravel.com/) as favorite backend frameworks
* [`Vue 3`](https://vuejs.org/) by [*Composition API*](https://vuejs.org/guide/extras/composition-api-faq.html) with [`Typescript`](https://www.typescriptlang.org/)
* *Utility-first CSS frameworks* as [`Tailwind`](https://tailwindcss.com/) / [`Windi CSS`](https://windicss.org/) / [`UnoCSS`](https://github.com/unocss/unocss), but also comfortable with [`Sass`](https://sass-lang.com/) with **BEM** implementation

I can develop proper API design following [**DDD / Hexa**](https://en.wikipedia.org/wiki/Domain-driven_design) principles if applicable. In addition to above `.NET` and `PHP` backend stacks, I'm also confident with :

* [`Nest.js`](https://nestjs.com/) associated to [`MikroORM`](https://mikro-orm.io/) (*Typescript*)
* [`FastAPI`](https://fastapi.tiangolo.com/) with [`SQLAlchemy`](https://www.sqlalchemy.org/) (*Python*)
* [`Spring Boot`](https://spring.io/projects/spring-boot) with `Hibernate` as main JPA implementation (*Java*)

I encourage `TDD` or at least proper **integration tests** on any backend frameworks, following **AAA** aka *Arrange Act Assert* principle :

* `PHPUnit` or [`Pest`](https://pestphp.com/) for *PHP*
* [`NUnit.net`](https://nunit.org/) or [`xUnit.net`](https://xunit.net/) with [`Fluent Assertions`](https://github.com/fluentassertions/fluentassertions) for *.NET Core*
* `JUnit` with [`REST Assured`](https://rest-assured.io/) for *Spring Boot*
* `Jest` and `pytest` on respective *NodeJS* end *Python* stacks

Fully embracing app containerization with `Docker` and `Kubernetes`, from local, staging to production, I push to use properly configured **CI/CD** whenever possible in order to enforce **continuous automatized testing, linting and code styling** at many languages ([`ESLint`](https://eslint.org/), [`Prettier`](https://prettier.io/), [`PHP CS fixer`](https://cs.symfony.com/), [`PHPStan`](https://github.com/phpstan/phpstan), [`Black`](https://black.readthedocs.io/en/stable/), [`mypy`](http://mypy-lang.org/), [`Google Java Format`](https://github.com/google/google-java-format), [`Spotless`](https://github.com/diffplug/spotless), and so on...).

Mastering installations and maintenance of `Docker Swarm` or bare metal `Kubernetes` clusters. Here some cloud native tools solutions I generally use :

* [`Traefik`](https://traefik.io/traefik/) as preferred cloud proxy with automatic service discovery and SSL configuration
* [`Portainer`](https://www.portainer.io/) as simple GUI for containers management
* [`Loki`](https://grafana.com/oss/loki/), [`Prometheus`](https://prometheus.io) and [`Jaeger`](https://www.jaegertracing.io/) as respective *logging*, *metrics* and *tracing* tools
* [`Grafana`](https://grafana.com) as GUI dashboard builder, designed for *Ops*
* [`Gitea`](https://gitea.io/) or [`GitLab`](https://about.gitlab.com/) as self-hosted *VCS*
* [`Drone CI`](https://www.drone.io/) or [`Concourse`](https://concourse-ci.org/) as both *CI/CD* solutions
* [`SonarQube`](https://www.sonarqube.org/) for automatic quality code scan

I use [`PostgreSQL`](https://www.postgresql.org/), [`MySQL`](https://www.mysql.com/fr/), and `MSSQL` as main *SGBD*, as well as `Redis` for high performance cache/sessions management.

For *load testing*, I can write scenarios for both [`K6`](https://k6.io/) and [`Locust`](https://locust.io/), coupled with proper time series DB as [`InfluxDB`](https://www.influxdata.com/) and `Grafana` as visualization tool. For advanced application performance analysis, I tend to use [`OpenTelemetry`](https://opentelemetry.io/) as collection tools for proper metrics that can be exposed to `Prometheus`, and tracing, ready to export into `Jaeger`.

Have some experiences with many mid-range cloud providers as [Digital Ocean](https://www.digitalocean.com/), [Hetzner](https://www.hetzner.com/), [OVH](https://www.ovhcloud.com/), [Scaleway](https://www.scaleway.com/), and some basic knowledge on [Terraform](https://www.terraform.io/) as main [*IaC*](https://en.wikipedia.org/wiki/Infrastructure_as_code) tool and [Salt](https://docs.saltproject.io/) as cluster wide configuration management.

Some notes of this blog :

* Hosted on Hetzner Cloud
* Powered by [`Hugo`](https://gohugo.io/)
* Source code on my own [`Gitea`](https://gitea.okami101.io/adr1enbe4udou1n/blog)
* Automatically deployed through my own [`Concourse`](https://concourse.okami101.io) instance
* Tracked with [`Matomo`](https://matomo.okami101.io/)

All the above tools are **self-hosted** on custom multi-nodes **bare metal** `Kubernetes` installed with [`k0s`](https://k0sproject.io/).

See some of [my open sourced works]({{< ref "works" >}} "Okami101 Works").
