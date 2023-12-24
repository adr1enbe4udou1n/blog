---
title: "A performance overview of main Web APIs frameworks for 2024"
date: 2023-12-30
tags: ["kubernetes", "docker", "load-testing", "k6", "webapi"]
---

{{< lead >}}
We'll be comparing the read performance of 6 Web APIs frameworks for 2024, sharing the same OpenAPI contract from [realworld app](https://github.com/gothinkster/realworld), a medium-like clone, implemented under multiple languages (PHP, Python, Javascript, Java and C#).
{{< /lead >}}

This is not a basic synthetic benchmark, but a real world benchmark with DB data tests, and multiple scenarios.

A state of the art of real world benchmarks comparison is very difficult to achieve. As performance can highly dependent of code implementation, all made by my own, and advanced fine-tuning for each runtime, I'm opened to any suggestions for performance improvement.

Now that it is said, let's fight !

## The contenders

We'll be using the very last up-to-date stable versions of the frameworks, and the latest stable version of the runtime.

| Framework & Source code                                                                         | Runtime     | ORM            | Tested Database    |
| ----------------------------------------------------------------------------------------------- | ----------- | -------------- | ------------------ |
| [Laravel 10](https://github.com/adr1enbe4udou1n/laravel-realworld-example-app)                  | PHP 8.3     | Eloquent       | MySQL & PostgreSQL |
| [Symfony 7 with API Platform](https://github.com/adr1enbe4udou1n/symfony-realworld-example-app) | PHP 8.3     | Doctrine       | MySQL & PostgreSQL |
| [FastAPI](https://github.com/adr1enbe4udou1n/fastapi-realworld-example-app)                     | Python 3.12 | SQLAlchemy 2.0 | PostgreSQL         |
| [NestJS 10](https://github.com/adr1enbe4udou1n/nestjs-realworld-example-app)                    | Node 20     | Prisma 5       | PostgreSQL         |
| [Spring Boot 3.2](https://github.com/adr1enbe4udou1n/spring-boot-realworld-example-app)         | Java 21     | Hibernate 6    | PostgreSQL         |
| [ASP.NET Core 8](https://github.com/adr1enbe4udou1n/aspnetcore-realworld-example-app)           | .NET 8.0    | EF Core 8      | PostgreSQL         |

All frameworks are :

- Using the same OpenAPI contract
- Fully tested against same [Postman collection](https://github.com/gothinkster/realworld/blob/main/api/Conduit.postman_collection.json)
- Highly tooled with high code quality in mind (static analyzers, formatter, linters, etc.)
- Share roughly the same amount of DB datasets, 50 users, 500 articles, 5000 comments

## The target hardware

We'll be using a dedicated hardware target, running on a Docker swarm cluster, each node composed of 4 CPUs and 8 GB of RAM.

Traefik will be used as a reverse proxy, with a single replica, and will load balance the requests to the replicas of each node.

{{< mermaid >}}
flowchart TD
client((Client))
client -- Port 80 + 443 --> traefik-01
subgraph manager-01
    traefik-01{Traefik SSL}
end
subgraph worker-01
    app-01([My App replica 1])
    traefik-01 --> app-01
end
subgraph worker-02
    app-02([My App replica 2])
    traefik-01 --> app-02
end
subgraph storage-01
    DB[(MySQL or PostgreSQL)]
    app-01 --> DB
    app-02 --> DB
end
{{< /mermaid >}}

## The scenarios

We'll be using [k6](https://k6.io/) to run the tests, and the hardware target will be composed of dedicated CPUs and RAM, running on a Docker swarm cluster.
