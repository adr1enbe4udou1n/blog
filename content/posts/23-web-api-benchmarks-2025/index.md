---
title: "A 2025 benchmark of main Web API frameworks"
date: 2024-12-26
tags: ["kubernetes", "docker", "load-testing", "k6", "webapi"]
---

{{< lead >}}
This is a 2025 update from previous [2024 benchmark]({{< ref "/posts/22-web-api-benchmarks-2024" >}}).
{{< /lead >}}

## The contenders

| Framework & Source code                                                                                                                                                                                                            | Runtime        | ORM            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------- |
| [Laravel 11](https://github.com/adr1enbe4udou1n/laravel-realworld-example-app) ([api](https://laravelrealworld.okami101.io/api/) / [image](https://gitea.okami101.io/conduit/-/packages/container/laravel/latest))                 | FrankenPHP 8.4 | Eloquent       |
| [Symfony 7.2](https://github.com/adr1enbe4udou1n/symfony-realworld-example-app) ([api](https://symfonyrealworld.okami101.io/api/) / [image](https://gitea.okami101.io/conduit/-/packages/container/symfony/latest))                | FrankenPHP 8.4 | Doctrine       |
| [FastAPI](https://github.com/adr1enbe4udou1n/fastapi-realworld-example-app) ([api](https://fastapirealworld.okami101.io/api/) / [image](https://gitea.okami101.io/conduit/-/packages/container/fastapi/latest))                    | Python 3.13    | SQLAlchemy 2.0 |
| [NestJS 10](https://github.com/adr1enbe4udou1n/nestjs-realworld-example-app) ([api](https://nestjsrealworld.okami101.io/api/) / [image](https://gitea.okami101.io/conduit/-/packages/container/nestjs/latest))                     | Node 22        | Prisma 6       |
| [Spring Boot 3.4](https://github.com/adr1enbe4udou1n/spring-boot-realworld-example-app) ([api](https://springbootrealworld.okami101.io/api/) / [image](https://gitea.okami101.io/conduit/-/packages/container/spring-boot/latest)) | Java 21        | Hibernate 6    |
| [ASP.NET Core 9](https://github.com/adr1enbe4udou1n/aspnetcore-realworld-example-app) ([api](https://aspnetcorerealworld.okami101.io/api/) / [image](https://gitea.okami101.io/conduit/-/packages/container/aspnet-core/latest))   | .NET 9.0       | EF Core 9      |

## The Swarm cluster for testing

{{< mermaid >}}
flowchart TD
client((k6))
client -- Port 80 443 --> traefik-01
subgraph manager-01
    traefik-01{Traefik SSL}
end
subgraph worker-01
    app-01([Conduit replica 1])
    traefik-01 --> app-01
end
subgraph worker-02
    app-02([Conduit replica 2])
    traefik-01 --> app-02
end
subgraph storage-01
    DB[(PostgreSQL)]
    app-01 --> DB
    app-02 --> DB
end
{{< /mermaid >}}

Here is the complete [terraform swarm bootstrap](https://github.com/okami101/terraform-swarm-cluster) if you want to reproduce the same setup.

## App deployment configurations

{{< tabs >}}
{{< tab tabName="Laravel" >}}

{{< highlight file="deploy-laravel.yml" >}}

```yml
version: "3.8"

services:
  app:
    image: gitea.okami101.io/conduit/laravel:latest
    environment:
      - APP_KEY=base64:nltxnFb9OaSAr4QcCchy8dG1QXUbc2+2tsXpzN9+ovg=
      - DB_CONNECTION=pgsql
      - DB_HOST=postgres_db
      - DB_USERNAME=okami
      - DB_PASSWORD=okami
      - DB_DATABASE=conduit_laravel
      - JWT_SECRET_KEY=c2b344e1-1a20-47fc-9aef-55b0c0d568a7
    networks:
      - postgres_db
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.laravel.entrypoints=websecure
        - traefik.http.services.laravel.loadbalancer.server.port=8000
      replicas: 2
      placement:
        max_replicas_per_node: 1
        constraints:
          - node.labels.run == true

networks:
  postgres_db:
    external: true
  traefik_public:
    external: true
```

{{< /highlight >}}

{{< /tab >}}
{{< tab tabName="Symfony" >}}

{{< highlight file="deploy-symfony.yml" >}}

```yml
version: "3.8"

services:
  app:
    image: gitea.okami101.io/conduit/symfony:latest
    environment:
      - APP_SECRET=ede04f29dd6c8b0e404581d48c36ec73
      - DATABASE_URL=postgresql://okami:okami@postgres_db/conduit_symfony
      - DATABASE_RO_URL=postgresql://okami:okami@postgres_db/conduit_symfony
      - JWT_PASSPHRASE=c2b344e1-1a20-47fc-9aef-55b0c0d568a7
    networks:
      - postgres_db
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.symfony.entrypoints=websecure
        - traefik.http.services.symfony.loadbalancer.server.port=80
      replicas: 2
      placement:
        max_replicas_per_node: 1
        constraints:
          - node.labels.run == true

networks:
  postgres_db:
    external: true
  traefik_public:
    external: true
```

{{< /highlight >}}

{{< /tab >}}
{{< tab tabName="FastAPI" >}}

{{< highlight file="deploy-fastapi.yml" >}}

```yml
version: "3.8"

services:
  app:
    image: gitea.okami101.io/conduit/fastapi:latest
    environment:
      - DB_HOST=postgres_db
      - DB_RO_HOST=postgres_db
      - DB_PORT=5432
      - DB_USERNAME=okami
      - DB_PASSWORD=okami
      - DB_DATABASE=conduit_fastapi
      - JWT_PASSPHRASE=c2b344e1-1a20-47fc-9aef-55b0c0d568a7
    networks:
      - postgres_db
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.fastapi.entrypoints=websecure
        - traefik.http.services.fastapi.loadbalancer.server.port=8000
      replicas: 4
      placement:
        max_replicas_per_node: 2
        constraints:
          - node.labels.run == true

networks:
  postgres_db:
    external: true
  traefik_public:
    external: true
```

{{< /highlight >}}

{{< /tab >}}
{{< tab tabName="NestJS" >}}

{{< highlight file="deploy-nestjs.yml" >}}

```yml
version: "3.8"

services:
  app:
    image: gitea.okami101.io/conduit/nestjs:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://okami:okami@postgres_db/conduit_nestjs
      - JWT_SECRET=c2b344e1-1a20-47fc-9aef-55b0c0d568a7
    networks:
      - postgres_db
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.nestjs.entrypoints=websecure
        - traefik.http.services.nestjs.loadbalancer.server.port=3000
      replicas: 2
      placement:
        max_replicas_per_node: 1
        constraints:
          - node.labels.run == true

networks:
  postgres_db:
    external: true
  traefik_public:
    external: true
```

{{< /highlight >}}

{{< /tab >}}
{{< tab tabName="Spring Boot" >}}

{{< highlight file="deploy-spring-boot.yml" >}}

```yml
version: "3.8"

services:
  app:
    image: gitea.okami101.io/conduit/spring-boot:latest
    environment:
      - SPRING_PROFILES_ACTIVE=production
      - DB_HOST=postgres_db
      - DB_PORT=5432
      - DB_RO_HOST=postgres_db
      - DB_USERNAME=okami
      - DB_PASSWORD=okami
      - DB_DATABASE=conduit_springboot
      - JWT_SECRET_KEY=YzJiMzQ0ZTEtMWEyMC00N2ZjLTlhZWYtNTViMGMwZDU2OGE3
    networks:
      - postgres_db
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.springboot.entrypoints=websecure
        - traefik.http.services.springboot.loadbalancer.server.port=8080
      replicas: 2
      placement:
        max_replicas_per_node: 1
        constraints:
          - node.labels.run == true

networks:
  postgres_db:
    external: true
  traefik_public:
    external: true
```

{{< /highlight >}}

{{< /tab >}}
{{< tab tabName="ASP.NET Core" >}}

{{< highlight file="deploy-aspnet-core.yml" >}}

```yml
version: "3.8"

services:
  app:
    image: gitea.okami101.io/conduit/symfony:latest
    environment:
      - SERVER_NAME=:80
      - APP_SECRET=ede04f29dd6c8b0e404581d48c36ec73
      - DATABASE_DRIVER=pdo_pgsql
      - DATABASE_URL=postgresql://okami:okami@postgres_db/conduit_symfony
      - DATABASE_RO_URL=postgresql://okami:okami@postgres_db/conduit_symfony
      - JWT_PASSPHRASE=c2b344e1-1a20-47fc-9aef-55b0c0d568a7
      - FRANKENPHP_CONFIG=worker ./public/index.php
      - APP_RUNTIME=Runtime\FrankenPhpSymfony\Runtime
    networks:
      - postgres_db
      - traefik_public
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.symfony.entrypoints=websecure
        - traefik.http.services.symfony.loadbalancer.server.port=80
      replicas: 2
      placement:
        max_replicas_per_node: 1
        constraints:
          - node.labels.run == true

networks:
  postgres_db:
    external: true
  traefik_public:
    external: true
```

{{< /highlight >}}

{{< /tab >}}
{{< /tabs >}}

## The k6 scenarios

### Scenario 1 - Database intensive

```js
import http from "k6/http";
import { check } from "k6";

export const options = {
    scenarios: {
        articles: {
            env: { CONDUIT_URL: '<framework_url>' },
            duration: '1m',
            executor: 'constant-arrival-rate',
            rate: '<rate>',
            timeUnit: '1s',
            preAllocatedVUs: 50,
        },
    },
};

export default function () {
    const apiUrl = `https://${__ENV.CONDUIT_URL}/api`;

    const limit = 10;
    let offset = 0;

    let articles = []

    do {
        const articlesResponse = http.get(`${apiUrl}/articles?limit=${limit}&offset=${offset}`);
        check(articlesResponse, {
            "status is 200": (r) => r.status == 200,
        });

        articles = articlesResponse.json().articles;

        offset += limit;
    }
    while (articles && articles.length >= limit);
}
```

The expected pseudocode SQL queries to build this response:

```sql
SELECT * FROM articles LIMIT 10 OFFSET 0;
SELECT count(*) FROM articles;
SELECT * FROM users WHERE id IN (<articles.author_id...>);
SELECT * FROM article_tag WHERE article_id IN (<articles.id...>);
SELECT * FROM favorites WHERE article_id IN (<articles.id...>);
```

### Scenario 2 - Runtime intensive

```js
import http from "k6/http";
import { check } from "k6";

export const options = {
    scenarios: {
        articles: {
            env: { CONDUIT_URL: '<framework_url>' },
            duration: '1m',
            executor: 'constant-arrival-rate',
            rate: '<rate>',
            timeUnit: '1s',
            preAllocatedVUs: 50,
        },
    },
};

export default function () {
    const apiUrl = `https://${__ENV.CONDUIT_URL}.sw.okami101.io/api`;

    const limit = 10;
    let offset = 0;

    const tagsResponse = http.get(`${apiUrl}/tags`);
    check(tagsResponse, {
        "status is 200": (r) => r.status == 200,
    });

    let articles = []

    do {
        const articlesResponse = http.get(`${apiUrl}/articles?limit=${limit}&offset=${offset}`);
        check(articlesResponse, {
            "status is 200": (r) => r.status == 200,
        });

        articles = articlesResponse.json().articles;

        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            const articleResponse = http.get(`${apiUrl}/articles/${article.slug}`);
            check(articleResponse, {
                "status is 200": (r) => r.status == 200,
            });

            const commentsResponse = http.get(`${apiUrl}/articles/${article.slug}/comments`);
            check(commentsResponse, {
                "status is 200": (r) => r.status == 200,
            });

            const authorsResponse = http.get(`${apiUrl}/profiles/${article.author.username}`);
            check(authorsResponse, {
                "status is 200": (r) => r.status == 200,
            });
        }
        offset += limit;
    }
    while (articles && articles.length >= limit);
}
```

## The results

### Laravel (Octane)

#### Laravel scenario 1

Iteration creation rate = **10/s**

```txt
checks.........................: 100.00% 27540 out of 27540
data_received..................: 294 MB  4.7 MB/s
data_sent......................: 2.4 MB  38 kB/s
dropped_iterations.............: 61      0.968024/s
http_req_blocked...............: avg=37.97µs  min=266ns   med=836ns    max=78.96ms  p(90)=1.45µs   p(95)=1.64µs
http_req_connecting............: avg=2.01µs   min=0s      med=0s       max=4.05ms   p(90)=0s       p(95)=0s
http_req_duration..............: avg=95.87ms  min=5.15ms  med=49.14ms  max=294.56ms p(90)=193.99ms p(95)=202.61ms
  { expected_response:true }...: avg=95.87ms  min=5.15ms  med=49.14ms  max=294.56ms p(90)=193.99ms p(95)=202.61ms
http_req_failed................: 0.00%   0 out of 27540
http_req_receiving.............: avg=571.32µs min=28.45µs med=490.81µs max=33.61ms  p(90)=864.61µs p(95)=1.13ms
http_req_sending...............: avg=104.98µs min=23.57µs med=89.96µs  max=18.26ms  p(90)=155.83µs p(95)=179.54µs
http_req_tls_handshaking.......: avg=32.54µs  min=0s      med=0s       max=38.93ms  p(90)=0s       p(95)=0s
http_req_waiting...............: avg=95.19ms  min=4.92ms  med=48.47ms  max=294.04ms p(90)=193.26ms p(95)=201.93ms
http_reqs......................: 27540   437.03919/s
iteration_duration.............: avg=4.93s    min=1.31s   med=5.22s    max=7.16s    p(90)=6.21s    p(95)=6.39s
iterations.....................: 540     8.569396/s
vus............................: 3       min=3              max=50
vus_max........................: 50      min=50             max=50
```

{{< tabs >}}
{{< tab tabName="Req/s" >}}

{{< chart type="timeseries" title="Req/s count" >}}
[
  {
    label: 'Req/s',
    data: [
        1, 293, 427, 440, 455, 453, 455, 424, 449,
      440, 431, 449, 433, 452, 456, 450, 452, 423,
      441, 434, 446, 443, 436, 450, 423, 445, 452,
      423, 426, 449, 451, 452, 427, 444, 455, 453,
      450, 399, 440, 452, 448, 451, 423, 450, 450,
      449, 431, 419, 448, 453, 450, 442, 441, 452,
      422, 427, 437, 423, 445, 450, 449, 435, 411,
      360
    ]
  }
]
{{< /chart >}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" >}}
[
  {
    label: 'VUs',
    data: [
      10, 14, 17, 19, 21, 23, 25, 28, 32, 35, 36, 40,
      42, 44, 44, 48, 48, 47, 49, 47, 48, 43, 47, 50,
      46, 50, 48, 45, 46, 50, 48, 48, 50, 48, 46, 45,
      46, 50, 49, 50, 48, 49, 46, 41, 44, 48, 49, 50,
      49, 47, 50, 46, 47, 48, 50, 48, 45, 50, 46, 47,
      42, 30,  3
    ]
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="Request duration in ms" >}}
[
  {
    label: 'Duration (ms)',
    data: [
       53,  23,  32,  36,  40,  45,  50,  58,  62,  69,  76,
       75,  89,  91,  98,  96, 101, 114, 108, 113, 110, 106,
      108, 100, 114, 108, 106, 114, 110, 104, 107, 104, 115,
      108, 107, 106,  98, 112, 112, 109, 107, 106, 116, 106,
       92,  93, 104, 117, 111, 106, 110, 109, 105, 104, 113,
      113, 113, 110, 107, 106, 102, 103,  85,  41
    ]
  }
]
{{< /chart >}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.01, 0.14, 0.73, 0.72,
      0.72, 0.71, 0.71, 0.71,
      0.73, 0.72,  0.7, 0.72,
      0.71,  0.7, 0.22, 0.01,
      0.01, 0.02, 0.01
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.01, 0.04, 0.19,  0.2,
       0.2, 0.19, 0.18, 0.19,
      0.19, 0.18,  0.2, 0.19,
      0.19, 0.19, 0.07, 0.01,
      0.01, 0.02, 0.01
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="CPU database load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02, 0.02, 0.17, 0.22,
      0.22, 0.22, 0.21, 0.22,
      0.22, 0.21, 0.21, 0.21,
      0.21, 0.21, 0.16, 0.02,
      0.02, 0.02, 0.02
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.02, 0.02, 0.13, 0.17,
      0.17, 0.16, 0.17, 0.17,
      0.17, 0.17, 0.17, 0.17,
      0.17, 0.17, 0.13, 0.02,
      0.01, 0.02, 0.02
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< /tab >}}
{{< /tabs >}}

#### Laravel scenario 2

Iteration creation rate = **1/s**

```txt
checks.........................: 100.00% 66291 out of 66291
data_received..................: 153 MB  1.7 MB/s
data_sent......................: 5.5 MB  61 kB/s
dropped_iterations.............: 2       0.02222/s
http_req_blocked...............: avg=14.62µs  min=224ns   med=807ns   max=127.73ms p(90)=1.41µs   p(95)=1.57µs
http_req_connecting............: avg=998ns    min=0s      med=0s      max=14.85ms  p(90)=0s       p(95)=0s
http_req_duration..............: avg=45.94ms  min=3.38ms  med=34.14ms max=960.12ms p(90)=98.44ms  p(95)=109.67ms
  { expected_response:true }...: avg=45.94ms  min=3.38ms  med=34.14ms max=960.12ms p(90)=98.44ms  p(95)=109.67ms
http_req_failed................: 0.00%   0 out of 66291
http_req_receiving.............: avg=243.23µs min=20.25µs med=159.9µs max=20.5ms   p(90)=462.34µs p(95)=596.36µs
http_req_sending...............: avg=97.49µs  min=13.22µs med=83.1µs  max=19.68ms  p(90)=147.69µs p(95)=173.01µs
http_req_tls_handshaking.......: avg=10.86µs  min=0s      med=0s      max=25.13ms  p(90)=0s       p(95)=0s
http_req_waiting...............: avg=45.6ms   min=0s      med=33.78ms max=959.32ms p(90)=98.1ms   p(95)=109.33ms
http_reqs......................: 66291   736.482032/s
iteration_duration.............: avg=50.62s   min=29.31s  med=51.94s  max=1m12s    p(90)=1m9s     p(95)=1m11s
iterations.....................: 17      0.188867/s
vus............................: 42      min=1              max=50
vus_max........................: 50      min=50             max=50
```

{{< tabs >}}
{{< tab tabName="Req/s" >}}

{{< chart type="timeseries" title="Req/s count" >}}
[
  {
    label: 'Req/s',
    data: [
       23,  88, 152, 246, 418, 486, 610, 668, 659, 717, 714,
      765, 788, 774, 759, 753, 782, 772, 663, 785, 755, 808,
      776, 802, 797, 753, 796, 766, 793, 809, 752, 788, 773,
      792, 786, 737, 777, 792, 787, 798, 753, 793, 780, 656,
      814, 773, 803, 778, 765, 799, 728, 793, 792, 783, 780,
      758, 779, 787, 770, 792, 754, 771, 796, 779, 797, 750,
      795, 798, 764, 807, 760, 794, 804, 778, 794, 720, 792,
      794, 757, 793, 749, 790, 804, 759, 597, 722, 807, 765,
      791, 814, 361
    ]
  }
]
{{< /chart >}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" >}}
[
  {
    label: 'VUs',
    data: [
       1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12,
      13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
      25, 26, 27, 28, 29, 29, 29, 30, 30, 31, 32, 33,
      33, 33, 34, 35, 36, 37, 38, 38, 39, 40, 41, 42,
      43, 43, 44, 45, 46, 47, 48, 49, 49, 50, 50, 49,
      50, 50, 50, 50, 49, 49, 49, 48, 48, 48, 48, 47,
      47, 47, 47, 47, 46, 46, 46, 46, 45, 45, 44, 44,
      44, 44, 44, 42, 42, 42
    ]
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="Request duration in ms" >}}
[
  {
    label: 'Duration (ms)',
    data: [
      16, 17, 16, 14, 11, 11, 10, 11, 13, 13, 15, 15,
      16, 17, 19, 20, 21, 23, 27, 25, 27, 26, 29, 29,
      31, 33, 33, 35, 35, 37, 39, 37, 39, 39, 40, 44,
      43, 42, 43, 42, 48, 46, 47, 58, 48, 51, 50, 52,
      55, 55, 60, 56, 57, 58, 62, 63, 64, 63, 65, 63,
      65, 64, 63, 64, 63, 65, 62, 61, 63, 59, 63, 60,
      59, 60, 58, 66, 60, 58, 60, 58, 62, 57, 56, 58,
      56, 75, 54, 58, 54, 52, 54
    ]
  }
]
{{< /chart >}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.01, 0.02, 0.24, 0.54,
      0.64, 0.63, 0.65, 0.66,
      0.65, 0.64, 0.62, 0.66,
      0.64, 0.65, 0.64, 0.64,
      0.66, 0.64, 0.58
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.01, 0.02, 0.09, 0.17,
      0.21, 0.21, 0.22, 0.22,
      0.21, 0.21, 0.21, 0.22,
      0.21, 0.23, 0.21, 0.21,
      0.21, 0.21, 0.19
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="CPU database load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02, 0.02, 0.05, 0.22,
      0.25, 0.26, 0.27, 0.27,
      0.27, 0.26, 0.27, 0.26,
      0.27, 0.27, 0.27, 0.26,
      0.27, 0.26, 0.27
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.02, 0.02, 0.04, 0.16, 0.18,
      0.19, 0.19,  0.2,  0.2,  0.2,
      0.21, 0.19,  0.2,  0.2,  0.2,
       0.2,  0.2,  0.2,  0.2
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< /tab >}}
{{< /tabs >}}

### Symfony (FrankenPHP)

#### Symfony scenario 1

Iteration creation rate = **10/s**

```txt
checks.........................: 100.00% 26826 out of 26826
data_received..................: 242 MB  3.8 MB/s
data_sent......................: 2.3 MB  37 kB/s
dropped_iterations.............: 74      1.173916/s
http_req_blocked...............: avg=45µs     min=231ns   med=852ns    max=121.78ms p(90)=1.48µs   p(95)=1.66µs
http_req_connecting............: avg=2.37µs   min=0s      med=0s       max=6.04ms   p(90)=0s       p(95)=0s
http_req_duration..............: avg=100.68ms min=7ms     med=77.39ms  max=241.69ms p(90)=182.09ms p(95)=191.03ms
  { expected_response:true }...: avg=100.68ms min=7ms     med=77.39ms  max=241.69ms p(90)=182.09ms p(95)=191.03ms
http_req_failed................: 0.00%   0 out of 26826
http_req_receiving.............: avg=571.25µs min=29.27µs med=483.38µs max=17.75ms  p(90)=888.77µs p(95)=1.19ms
http_req_sending...............: avg=106.3µs  min=24.84µs med=91.61µs  max=7.88ms   p(90)=158.49µs p(95)=184.03µs
http_req_tls_handshaking.......: avg=37.23µs  min=0s      med=0s       max=30.9ms   p(90)=0s       p(95)=0s
http_req_waiting...............: avg=100ms    min=6.85ms  med=76.72ms  max=241.35ms p(90)=181.42ms p(95)=190.3ms
http_reqs......................: 26826   425.56044/s
iteration_duration.............: avg=5.17s    min=1.05s   med=5.55s    max=7.22s    p(90)=6.21s    p(95)=6.35s
iterations.....................: 526     8.344322/s
vus............................: 3       min=3              max=50
     vus_max........................: 50      min=50             max=50
```

{{< tabs >}}
{{< tab tabName="Req/s" >}}

{{< chart type="timeseries" title="Req/s count" >}}
[
  {
    label: 'Req/s',
    data: [
       14, 383, 421, 413, 428, 432, 431, 421, 437,
      439, 432, 432, 418, 426, 436, 434, 430, 420,
      438, 436, 430, 430, 408, 426, 436, 436, 432,
      419, 439, 433, 432, 418, 414, 424, 439, 431,
      430, 421, 435, 437, 430, 420, 423, 436, 437,
      433, 433, 419, 437, 435, 420, 426, 418, 436,
      435, 434, 430, 418, 437, 431, 419, 430, 418,
      280
    ]
  }
]
{{< /chart >}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" >}}
[
  {
    label: 'VUs',
    data: [
      10, 13, 16, 20, 23, 25, 29, 30, 34, 37, 38, 43,
      46, 49, 49, 49, 48, 48, 47, 48, 49, 49, 49, 49,
      47, 46, 47, 50, 49, 49, 47, 48, 49, 48, 50, 47,
      49, 47, 49, 48, 48, 48, 49, 49, 50, 46, 48, 50,
      50, 50, 49, 50, 49, 45, 48, 47, 49, 48, 50, 50,
      42, 28,  3
    ]
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="Request duration in ms" >}}
[
  {
    label: 'Duration (ms)',
    data: [
       30,  20,  28,  36,  44,  50,  58,  66,  70,  75,
       84,  90,  97, 105, 112, 112, 112, 116, 110, 106,
      108, 112, 121, 114, 111, 106, 107, 112, 112, 114,
      112, 112, 117, 115, 109, 114, 112, 116, 109, 112,
      112, 113, 112, 112, 108, 112, 109, 114, 111, 112,
      116, 116, 117, 112, 104, 112, 111, 118, 110, 113,
      117, 101,  75,  41
    ]
  }
]
{{< /chart >}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.01, 0.23, 0.33, 0.34,
      0.33, 0.33, 0.33, 0.34,
      0.33, 0.34, 0.33, 0.33,
      0.33,  0.3, 0.01, 0.01
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.01, 0.07, 0.09, 0.09,
      0.08, 0.08, 0.08, 0.09,
      0.08, 0.08, 0.08, 0.08,
      0.08, 0.08, 0.01, 0.01
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="CPU database load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02, 0.15,  0.9, 0.91,
      0.91, 0.91,  0.9,  0.9,
      0.91, 0.91, 0.91, 0.91,
      0.91,  0.9, 0.35, 0.01,
      0.01
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.02, 0.03,  0.1, 0.09,
      0.09, 0.09,  0.1, 0.09,
      0.09, 0.09, 0.09, 0.09,
      0.09,  0.1, 0.05, 0.02,
      0.02
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< /tab >}}
{{< /tabs >}}

#### Symfony scenario 2

Iteration creation rate = **2/s**

```txt
checks.........................: 100.00% 138128 out of 138128
data_received..................: 245 MB  3.1 MB/s
data_sent......................: 11 MB   137 kB/s
dropped_iterations.............: 31      0.387655/s
http_req_blocked...............: avg=7.88µs   min=183ns   med=685ns    max=83.34ms  p(90)=1.25µs   p(95)=1.43µs
http_req_connecting............: avg=385ns    min=0s      med=0s       max=4.45ms   p(90)=0s       p(95)=0s
http_req_duration..............: avg=20.55ms  min=2.07ms  med=18.03ms  max=259.05ms p(90)=38.46ms  p(95)=43.95ms
  { expected_response:true }...: avg=20.55ms  min=2.07ms  med=18.03ms  max=259.05ms p(90)=38.46ms  p(95)=43.95ms
http_req_failed................: 0.00%   0 out of 138128
http_req_receiving.............: avg=415.85µs min=15.14µs med=177.95µs max=39.61ms  p(90)=740.65µs p(95)=1.39ms
http_req_sending...............: avg=92.45µs  min=15.6µs  med=71.73µs  max=19.02ms  p(90)=137.18µs p(95)=168.9µs
http_req_tls_handshaking.......: avg=6.07µs   min=0s      med=0s       max=34.16ms  p(90)=0s       p(95)=0s
http_req_waiting...............: avg=20.04ms  min=0s      med=17.5ms   max=258.94ms p(90)=37.81ms  p(95)=43.25ms
http_reqs......................: 138128  1727.291662/s
iteration_duration.............: avg=32.23s   min=13.15s  med=34.27s   max=41.48s   p(90)=40.76s   p(95)=41.1s
iterations.....................: 89      1.112946/s
vus............................: 8       min=2                max=50
vus_max........................: 50      min=50               max=50
```

{{< tabs >}}
{{< tab tabName="Req/s" >}}

{{< chart type="timeseries" title="Req/s count" >}}
[
  {
    label: 'Req/s',
    data: [
        32,  287,  748, 1203, 1479, 1512, 1657, 1594, 1772,
      1751, 1731, 1799, 1849, 1794, 1728, 1758, 1779, 1812,
      1788, 1852, 1618, 1880, 1862, 1836, 1857, 1755, 1849,
      1869, 1869, 1804, 1773, 1818, 1874, 1809, 1866, 1802,
      1809, 1885, 1791, 1859, 1781, 1845, 1862, 1838, 1890,
      1732, 1885, 1749, 1867, 1734, 1598, 1862, 1848, 1890,
      1796, 1768, 1831, 1888, 1825, 1815, 1830, 1823, 1855,
      1828, 1824, 1699, 1861, 1820, 1859, 1743, 1777, 1846,
      1809, 1839, 1776, 1742, 1721, 1641, 1665, 1301,  155
    ]
  }
]
{{< /chart >}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" >}}
[
  {
    label: 'VUs',
    data: [
       2,  4,  6,  8, 10, 12, 14, 16, 18, 20, 22, 24,
      26, 26, 27, 28, 30, 31, 32, 33, 35, 36, 38, 40,
      41, 42, 43, 45, 47, 48, 49, 50, 50, 49, 49, 50,
      50, 50, 50, 50, 50, 49, 49, 50, 49, 50, 50, 48,
      50, 50, 50, 50, 50, 49, 49, 49, 49, 49, 50, 49,
      47, 45, 44, 43, 41, 38, 38, 34, 31, 28, 26, 26,
      23, 21, 20, 18, 14, 12,  8
    ]
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="Request duration in ms" >}}
[
  {
    label: 'Duration (ms)',
    data: [
      12,  8,  6,  5,  5,  7,  7,  9,  9, 10, 12, 12,
      13, 14, 15, 15, 16, 16, 17, 17, 21, 19, 19, 21,
      22, 23, 23, 23, 24, 26, 27, 27, 27, 27, 26, 27,
      28, 26, 28, 27, 28, 27, 26, 27, 26, 28, 26, 28,
      26, 28, 31, 27, 27, 26, 27, 28, 27, 26, 27, 27,
      27, 26, 24, 24, 23, 24, 20, 20, 18, 18, 16, 14,
      14, 12, 12, 11, 10,  9,  7,  5,  6
    ]
  }
]
{{< /chart >}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.01, 0.02, 0.36, 0.65,
      0.69, 0.69,  0.7,  0.7,
       0.7, 0.71, 0.71, 0.71,
       0.7, 0.71,  0.7,  0.7,
      0.71, 0.63, 0.02
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.01, 0.01, 0.12,  0.2,
       0.2, 0.21,  0.2, 0.21,
      0.22, 0.22, 0.22, 0.22,
       0.2, 0.21, 0.21,  0.2,
       0.2, 0.18, 0.02
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="CPU database load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02, 0.02,  0.1, 0.32,
      0.38, 0.38, 0.39,  0.4,
      0.39, 0.39,  0.4,  0.4,
      0.39,  0.4, 0.39, 0.39,
      0.39, 0.39, 0.18
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.02, 0.02, 0.04, 0.12,
      0.15, 0.15, 0.15, 0.15,
      0.15, 0.16, 0.15, 0.15,
      0.15, 0.15, 0.15, 0.15,
      0.15, 0.15, 0.07
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< /tab >}}
{{< /tabs >}}

Huge gap in performance against Laravel Octane here, about twice better ! Without FrankenPHP, we were capping to previously about 300 req/s on Apache...

### FastAPI

As a side note here, uvicorn is limited to 1 CPU core, so I use 2 replicas on each worker to use all CPU cores.

#### FastAPI scenario 1

Iteration creation rate =  **15/s**

```txt
checks.........................: 100.00% 39678 out of 39678
data_received..................: 321 MB  5.2 MB/s
data_sent......................: 3.4 MB  55 kB/s
dropped_iterations.............: 123     1.983368/s
http_req_blocked...............: avg=23.83µs  min=213ns   med=799ns    max=113.17ms p(90)=1.41µs   p(95)=1.59µs
http_req_connecting............: avg=1.42µs   min=0s      med=0s       max=6.53ms   p(90)=0s       p(95)=0s
http_req_duration..............: avg=69.21ms  min=6.41ms  med=54.17ms  max=382.34ms p(90)=142.86ms p(95)=166.33ms
  { expected_response:true }...: avg=69.21ms  min=6.41ms  med=54.17ms  max=382.34ms p(90)=142.86ms p(95)=166.33ms
http_req_failed................: 0.00%   0 out of 39678
http_req_receiving.............: avg=491.01µs min=23.44µs med=282.51µs max=20.46ms  p(90)=1.01ms   p(95)=1.6ms
http_req_sending...............: avg=106.95µs min=17.61µs med=85.46µs  max=20.9ms   p(90)=155.94µs p(95)=189.16µs
http_req_tls_handshaking.......: avg=18.91µs  min=0s      med=0s       max=34.33ms  p(90)=0s       p(95)=0s
http_req_waiting...............: avg=68.62ms  min=6.23ms  med=53.56ms  max=381.34ms p(90)=142.08ms p(95)=165.56ms
http_reqs......................: 39678   639.805458/s
iteration_duration.............: avg=3.56s    min=1s      med=3.68s    max=5.11s    p(90)=4.22s    p(95)=4.38s
iterations.....................: 778     12.545205/s
vus............................: 3       min=3              max=50
vus_max........................: 50      min=50             max=50
```

{{< tabs >}}
{{< tab tabName="Req/s" >}}

{{< chart type="timeseries" title="Req/s count" >}}
[
  {
    label: 'Req/s',
    data: [
      205, 686, 625, 657, 643, 684, 625, 652, 606,
      656, 610, 662, 672, 687, 647, 650, 636, 663,
      665, 617, 600, 621, 637, 655, 628, 681, 649,
      637, 662, 568, 669, 667, 630, 625, 630, 685,
      654, 647, 667, 631, 618, 656, 614, 695, 650,
      659, 629, 638, 646, 609, 642, 661, 647, 677,
      601, 662, 665, 608, 671, 628, 632, 629, 150
    ]
  }
]
{{< /chart >}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" >}}
[
  {
    label: 'VUs',
    data: [
      15, 18, 22, 30, 31, 36, 37, 41, 49, 50, 49, 50,
      47, 48, 47, 48, 49, 47, 49, 44, 47, 48, 48, 50,
      46, 46, 45, 50, 48, 47, 45, 50, 45, 49, 45, 45,
      50, 47, 48, 50, 47, 50, 46, 47, 49, 47, 50, 47,
      50, 46, 49, 46, 47, 49, 48, 49, 47, 47, 48, 49,
      38,  3
    ]
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="Request duration in ms" >}}
[
  {
    label: 'Duration (ms)',
    data: [
      19, 22, 29, 35, 44, 46, 57, 60, 71, 73, 80, 73,
      73, 67, 76, 74, 73, 73, 70, 80, 76, 77, 76, 74,
      77, 65, 70, 75, 73, 84, 68, 71, 80, 74, 79, 64,
      74, 77, 69, 77, 79, 71, 78, 67, 75, 72, 77, 76,
      74, 78, 71, 73, 74, 70, 78, 76, 71, 75, 71, 79,
      71, 49, 17
    ]
  }
]
{{< /chart >}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.01, 0.48, 0.69,  0.7,
      0.69,  0.7,  0.7, 0.69,
      0.71, 0.69, 0.68, 0.69,
      0.69, 0.41, 0.01, 0.02,
      0.01, 0.01
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.01, 0.16, 0.26, 0.26,
      0.24, 0.24, 0.25, 0.25,
      0.26, 0.25, 0.24, 0.24,
      0.24, 0.16, 0.01, 0.02,
      0.01, 0.01
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="CPU database load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02, 0.11, 0.46, 0.49,
      0.48,  0.5,  0.5, 0.49,
      0.48, 0.48, 0.47, 0.49,
      0.48, 0.49, 0.05, 0.02,
      0.02, 0.02
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.02, 0.06, 0.24, 0.35,
      0.28, 0.35, 0.33,  0.3,
      0.28, 0.32, 0.27, 0.34,
      0.29,  0.3, 0.04, 0.02,
      0.02, 0.02
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< /tab >}}
{{< /tabs >}}

#### FastAPI scenario 2

Iteration creation rate = **2/s**

```txt
checks.........................: 100.00% 82414 out of 82414
data_received..................: 164 MB  1.8 MB/s
data_sent......................: 6.1 MB  68 kB/s
dropped_iterations.............: 64      0.711058/s
http_req_blocked...............: avg=13.71µs  min=208ns   med=783ns    max=143.23ms p(90)=1.39µs   p(95)=1.56µs
http_req_connecting............: avg=1.28µs   min=0s      med=0s       max=25.89ms  p(90)=0s       p(95)=0s
http_req_duration..............: avg=43.46ms  min=3.99ms  med=24.29ms  max=315.4ms  p(90)=108.49ms p(95)=129.33ms
  { expected_response:true }...: avg=43.46ms  min=3.99ms  med=24.29ms  max=315.4ms  p(90)=108.49ms p(95)=129.33ms
http_req_failed................: 0.00%   0 out of 82414
http_req_receiving.............: avg=205.46µs min=16.8µs  med=103.34µs max=23.42ms  p(90)=394.08µs p(95)=591.95µs
http_req_sending...............: avg=94.88µs  min=17.56µs med=78.81µs  max=14.63ms  p(90)=143.76µs p(95)=171.26µs
http_req_tls_handshaking.......: avg=9.75µs   min=0s      med=0s       max=29.89ms  p(90)=0s       p(95)=0s
http_req_waiting...............: avg=43.16ms  min=23.62µs med=23.97ms  max=315.14ms p(90)=108.17ms p(95)=129.04ms
http_reqs......................: 82414   915.642582/s
iteration_duration.............: avg=1m5s     min=44.88s  med=1m10s    max=1m14s    p(90)=1m13s    p(95)=1m13s
iterations.....................: 36      0.39997/s
vus............................: 21      min=2              max=50
vus_max........................: 50      min=50             max=50
```

{{< tabs >}}
{{< tab tabName="Req/s" >}}

{{< chart type="timeseries" title="Req/s count" >}}
[
  {
    label: 'Req/s',
    data: [
       12,  155, 362, 681, 799, 914, 973, 975, 984, 928, 959,
      964,  934, 975, 874, 924, 883, 908, 931, 888, 983, 935,
      967,  959, 898, 942, 939, 935, 933, 904, 926, 909, 911,
      904,  945, 929, 990, 962, 973, 896, 998, 962, 930, 983,
      891, 1007, 944, 925, 983, 952, 938, 984, 939, 936, 872,
      959,  996, 983, 968, 945, 909, 964, 973, 897, 921, 996,
      953,  986, 941, 929, 942, 966, 880, 943, 901, 956, 925,
      944,  967, 899, 935, 937, 924, 960, 899, 999, 917, 891,
      880,  884, 538
    ]
  }
]
{{< /chart >}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" >}}
[
  {
    label: 'VUs',
    data: [
       2,  4,  6,  8, 10, 12, 14, 16, 18, 20, 22, 24,
      26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48,
      50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
      50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
      50, 50, 50, 50, 49, 49, 50, 50, 50, 50, 50, 50,
      49, 49, 49, 49, 48, 47, 46, 46, 46, 45, 45, 44,
      43, 43, 43, 42, 41, 40, 40, 40, 38, 36, 35, 34,
      32, 30, 29, 26, 25, 21
    ]
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="Request duration in ms" >}}
[
  {
    label: 'Duration (ms)',
    data: [
      20, 14, 12,  9, 10, 11, 12, 14, 16, 19, 21, 23,
      26, 27, 32, 32, 36, 38, 38, 44, 41, 45, 46, 47,
      54, 52, 51, 55, 54, 55, 54, 55, 54, 55, 53, 54,
      49, 53, 51, 56, 50, 52, 53, 51, 55, 50, 53, 53,
      49, 53, 53, 50, 53, 53, 57, 50, 52, 49, 52, 54,
      54, 52, 50, 53, 54, 49, 49, 47, 49, 49, 47, 45,
      50, 47, 47, 45, 44, 44, 41, 45, 42, 41, 39, 36,
      38, 31, 33, 32, 31, 28, 24
    ]
  }
]
{{< /chart >}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.01, 0.24, 0.65, 0.68,
      0.66, 0.69, 0.68, 0.68,
      0.68, 0.69, 0.69, 0.71,
      0.69, 0.68,  0.7,  0.7,
      0.69, 0.68, 0.65
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.01, 0.08, 0.23, 0.26,
      0.25, 0.28, 0.27, 0.25,
      0.25, 0.25, 0.25, 0.27,
      0.28, 0.26, 0.27, 0.28,
      0.27, 0.24, 0.24
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="CPU database load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02, 0.03, 0.24, 0.24,
      0.25, 0.26, 0.28, 0.28,
      0.29, 0.28, 0.29, 0.28,
      0.27, 0.28, 0.29, 0.28,
      0.28, 0.27, 0.28
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.02, 0.02, 0.13, 0.16,
       0.2, 0.23, 0.23, 0.24,
      0.26, 0.26, 0.26, 0.23,
      0.23, 0.25, 0.24, 0.25,
      0.25, 0.23, 0.23
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< /tab >}}
{{< /tabs >}}

### NestJS

#### NestJS scenario 1

Iteration creation rate = **20/s**

```txt
checks.........................: 100.00% 50643 out of 50643
data_received..................: 857 MB  14 MB/s
data_sent......................: 4.7 MB  76 kB/s
dropped_iterations.............: 208     3.386691/s
http_req_blocked...............: avg=18.93µs  min=174ns    med=712ns    max=77.19ms  p(90)=1.29µs   p(95)=1.48µs
http_req_connecting............: avg=964ns    min=0s       med=0s       max=5.11ms   p(90)=0s       p(95)=0s
http_req_duration..............: avg=55.57ms  min=3.38ms   med=51.45ms  max=156.06ms p(90)=101.84ms p(95)=106.83ms
  { expected_response:true }...: avg=55.57ms  min=3.38ms   med=51.45ms  max=156.06ms p(90)=101.84ms p(95)=106.83ms
http_req_failed................: 0.00%   0 out of 50643
http_req_receiving.............: avg=393.14µs min=18.48µs  med=253.43µs max=30ms     p(90)=610.66µs p(95)=950.88µs
http_req_sending...............: avg=106.23µs min=22.01µs  med=78.55µs  max=20.42ms  p(90)=148.81µs p(95)=187.14µs
http_req_tls_handshaking.......: avg=16.1µs   min=0s       med=0s       max=34.53ms  p(90)=0s       p(95)=0s
http_req_waiting...............: avg=55.07ms  min=3.2ms    med=50.96ms  max=155.49ms p(90)=101.27ms p(95)=106.29ms
http_reqs......................: 50643   824.577783/s
iteration_duration.............: avg=2.88s    min=993.46ms med=2.92s    max=3.99s    p(90)=3.28s    p(95)=3.41s
iterations.....................: 993     16.168192/s
vus............................: 24      min=20             max=50
vus_max........................: 50      min=50             max=50
```

{{< tabs >}}
{{< tab tabName="Req/s" >}}

{{< chart type="timeseries" title="Req/s count" >}}
[
  {
    label: 'Req/s',
    data: [
       99, 730, 768, 784, 763, 777, 816, 790, 745,
      786, 768, 826, 819, 838, 786, 843, 825, 831,
      842, 825, 854, 850, 845, 847, 834, 842, 851,
      839, 842, 840, 854, 835, 844, 842, 853, 862,
      842, 837, 829, 828, 851, 854, 847, 862, 836,
      847, 843, 856, 846, 828, 855, 841, 834, 856,
      813, 838, 853, 853, 834, 847, 831, 787
    ]
  }
]
{{< /chart >}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" >}}
[
  {
    label: 'VUs',
    data: [
      20, 28, 38, 45, 50, 50, 47, 50, 50, 50, 46, 48,
      50, 47, 49, 48, 47, 49, 50, 48, 48, 49, 46, 48,
      48, 50, 48, 50, 48, 48, 48, 50, 48, 47, 49, 49,
      46, 50, 50, 47, 48, 49, 47, 47, 48, 49, 45, 49,
      50, 50, 48, 50, 49, 50, 48, 48, 47, 50, 49, 50,
      24
    ]
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="Request duration in ms" >}}
[
  {
    label: 'Duration (ms)',
    data: [
      17, 23, 33, 45, 57, 62, 60, 59, 63, 62, 63, 57,
      59, 57, 61, 56, 58, 57, 57, 58, 55, 56, 57, 55,
      56, 57, 57, 55, 58, 57, 55, 57, 57, 58, 56, 56,
      57, 56, 58, 58, 55, 55, 57, 55, 56, 57, 58, 52,
      55, 58, 55, 57, 59, 56, 59, 57, 56, 55, 57, 56,
      57, 30
    ]
  }
]
{{< /chart >}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.01, 0.37, 0.51,  0.5,
       0.5,  0.5,  0.5,  0.5,
      0.51,  0.5, 0.51, 0.49,
      0.49, 0.26, 0.02, 0.01,
      0.02, 0.02
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.01, 0.16, 0.22, 0.22,
      0.23, 0.22, 0.23, 0.23,
      0.23, 0.24, 0.23, 0.23,
      0.23, 0.13, 0.01, 0.01,
      0.01, 0.01
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="CPU database load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02, 0.06, 0.21, 0.21,
      0.23, 0.23, 0.22, 0.22,
      0.23, 0.23, 0.23, 0.23,
      0.22, 0.23, 0.02, 0.03,
      0.02, 0.02, 0.02
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.02, 0.06,  0.2, 0.21,
       0.2, 0.22, 0.22, 0.22,
      0.22, 0.22, 0.22, 0.21,
      0.21, 0.22, 0.02, 0.02,
      0.01, 0.02, 0.02
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< /tab >}}
{{< /tabs >}}

#### NestJS scenario 2

Iteration creation rate = **3/s**

```txt
checks.........................: 100.00% 155200 out of 155200
data_received..................: 704 MB  8.5 MB/s
data_sent......................: 12 MB   150 kB/s
dropped_iterations.............: 80      0.966185/s
http_req_blocked...............: avg=6.88µs   min=174ns   med=660ns   max=87.19ms  p(90)=1.24µs   p(95)=1.42µs
http_req_connecting............: avg=357ns    min=0s      med=0s      max=7.72ms   p(90)=0s       p(95)=0s
http_req_duration..............: avg=21.55ms  min=2.13ms  med=18.15ms max=112.67ms p(90)=41.07ms  p(95)=52.6ms
  { expected_response:true }...: avg=21.55ms  min=2.13ms  med=18.15ms max=112.67ms p(90)=41.07ms  p(95)=52.6ms
http_req_failed................: 0.00%   0 out of 155200
http_req_receiving.............: avg=377.08µs min=14.17µs med=144.7µs max=45.51ms  p(90)=704.67µs p(95)=1.31ms
http_req_sending...............: avg=92.1µs   min=13.27µs med=68.38µs max=26.86ms  p(90)=133.57µs p(95)=167.61µs
http_req_tls_handshaking.......: avg=5.04µs   min=0s      med=0s      max=36.97ms  p(90)=0s       p(95)=0s
http_req_waiting...............: avg=21.08ms  min=0s      med=17.7ms  max=112.22ms p(90)=40.34ms  p(95)=51.94ms
http_reqs......................: 155200  1874.398124/s
iteration_duration.............: avg=33.81s   min=20.37s  med=35.26s  max=40.81s   p(90)=39.62s   p(95)=40.18s
iterations.....................: 100     1.207731/s
vus............................: 9       min=3                max=50
vus_max........................: 50      min=50               max=50
```

{{< tabs >}}
{{< tab tabName="Req/s" >}}

{{< chart type="timeseries" title="Req/s count" >}}
[
  {
    label: 'Req/s',
    data: [
        45,  363, 1030, 1417, 1719, 1698, 1910, 1844, 1812,
      1991, 1990, 1860, 1983, 1890, 1938, 1890, 1927, 1790,
      1873, 1963, 1954, 1937, 1961, 1960, 1952, 1924, 1952,
      1929, 1915, 1907, 1978, 1897, 1953, 1880, 1962, 1961,
      1930, 2001, 1938, 1957, 1952, 1946, 1965, 1879, 1976,
      1957, 1886, 1875, 1913, 1942, 1960, 1969, 1961, 1925,
      1989, 1997, 1926, 1825, 1898, 1981, 1977, 1926, 1988,
      1906, 1994, 2038, 1936, 1955, 1900, 1973, 1980, 2019,
      1962, 1917, 1984, 1944, 1961, 1878, 1902, 2018, 1956,
      1880, 1551,  152
    ]
  }
]
{{< /chart >}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" >}}
[
  {
    label: 'VUs',
    data: [
       3,  6,  9, 12, 15, 18, 21, 24, 27, 30, 33, 36,
      39, 42, 45, 48, 50, 50, 50, 50, 49, 49, 50, 49,
      50, 50, 50, 48, 50, 50, 50, 50, 49, 49, 50, 50,
      50, 50, 49, 50, 50, 49, 50, 48, 50, 50, 49, 49,
      49, 48, 50, 50, 49, 50, 47, 48, 49, 50, 50, 49,
      49, 47, 46, 45, 44, 43, 42, 41, 41, 40, 39, 37,
      35, 35, 34, 32, 30, 29, 25, 21, 18,  9
    ]
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="Request duration in ms" >}}
[
  {
    label: 'Duration (ms)',
    data: [
      10,  9,  6,  6,  7,  9,  9, 11, 13, 14, 15, 18,
      18, 21, 22, 24, 25, 28, 26, 25, 26, 25, 25, 25,
      25, 26, 25, 26, 26, 26, 25, 26, 25, 26, 25, 25,
      25, 25, 25, 25, 25, 25, 25, 26, 25, 25, 26, 26,
      26, 25, 25, 25, 25, 26, 25, 24, 25, 27, 26, 25,
      25, 25, 23, 24, 22, 21, 22, 21, 22, 20, 20, 19,
      19, 18, 17, 17, 16, 16, 15, 12, 11,  9,  6,  5
    ]
  }
]
{{< /chart >}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02, 0.15, 0.49, 0.53,
      0.51, 0.52, 0.53, 0.52,
      0.52, 0.52, 0.51, 0.53,
      0.52, 0.52, 0.52, 0.53,
      0.52, 0.48, 0.02
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.01, 0.06, 0.23, 0.25,
      0.25, 0.26, 0.26, 0.25,
      0.26, 0.25, 0.25, 0.25,
      0.26, 0.25, 0.26, 0.25,
      0.25, 0.23, 0.01
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="CPU database load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02, 0.02, 0.22,  0.3,
       0.3, 0.31, 0.32, 0.31,
       0.3, 0.32, 0.31,  0.3,
      0.32, 0.31, 0.32, 0.31,
      0.33, 0.32, 0.14
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.02, 0.02, 0.16, 0.21,
      0.21, 0.21, 0.21, 0.21,
      0.21, 0.21, 0.21, 0.22,
      0.21, 0.21, 0.21, 0.21,
       0.2, 0.22,  0.1
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< /tab >}}
{{< /tabs >}}

### Spring Boot

#### Spring Boot scenario 1

Iteration creation rate = **40/s**

```txt
checks.........................: 100.00% 115209 out of 115209
data_received..................: 2.2 GB  36 MB/s
data_sent......................: 9.8 MB  162 kB/s
dropped_iterations.............: 142     2.337943/s
http_req_blocked...............: avg=9.76µs  min=150ns    med=495ns   max=79.87ms  p(90)=888ns    p(95)=1.1µs
http_req_connecting............: avg=744ns   min=0s       med=0s      max=8.88ms   p(90)=0s       p(95)=0s
http_req_duration..............: avg=23.5ms  min=2.85ms   med=21.95ms max=146.98ms p(90)=36.25ms  p(95)=42.4ms
  { expected_response:true }...: avg=23.5ms  min=2.85ms   med=21.95ms max=146.98ms p(90)=36.25ms  p(95)=42.4ms
http_req_failed................: 0.00%   0 out of 115209
http_req_receiving.............: avg=2.26ms  min=18.74µs  med=1ms     max=82.11ms  p(90)=5.64ms   p(95)=8.68ms
http_req_sending...............: avg=147.6µs min=13.42µs  med=55.61µs max=48.16ms  p(90)=138.64µs p(95)=212.34µs
http_req_tls_handshaking.......: avg=7.73µs  min=0s       med=0s      max=32.66ms  p(90)=0s       p(95)=0s
http_req_waiting...............: avg=21.09ms min=0s       med=19.81ms max=143.7ms  p(90)=32.3ms   p(95)=37.67ms
http_reqs......................: 115209  1896.845564/s
iteration_duration.............: avg=1.25s   min=597.55ms med=1.26s   max=1.6s     p(90)=1.37s    p(95)=1.4s
iterations.....................: 2259    37.19305/s
vus............................: 48      min=27               max=50
vus_max........................: 50      min=50               max=50
```

{{< tabs >}}
{{< tab tabName="Req/s" >}}

{{< chart type="timeseries" title="Req/s count" >}}
[
  {
    label: 'Req/s',
    data: [
      1252, 1842, 1865, 1887, 1927, 1918, 1954,
      1939, 1963, 1897, 1825, 1956, 1952, 1861,
      1885, 1891, 1904, 1898, 1791, 1810, 1904,
      1904, 1998, 1934, 1887, 1888, 1972, 1950,
      1929, 1889, 1913, 1951, 1926, 1904, 1862,
      1946, 1947, 1948, 1918, 1889, 1873, 1903,
      1915, 1909, 1893, 1863, 1963, 1893, 1941,
      1787, 1839, 1950, 1988, 1953, 1868, 1979,
      1944, 1944, 1943, 1917, 1268
    ]
  }
]
{{< /chart >}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" >}}
[
  {
    label: 'VUs',
    data: [
      27, 38, 47, 47, 45, 48, 48, 49, 48, 49, 47, 46,
      47, 48, 50, 50, 49, 49, 50, 46, 49, 47, 49, 49,
      46, 50, 47, 49, 47, 47, 48, 48, 47, 48, 48, 48,
      48, 48, 48, 49, 50, 48, 48, 48, 50, 49, 48, 46,
      47, 48, 46, 48, 46, 47, 47, 50, 47, 48, 48
    ]
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="Request duration in ms" >}}
[
  {
    label: 'Duration (ms)',
    data: [
      12, 17, 21, 24, 23, 24, 23, 24, 23, 24, 26, 23,
      23, 24, 24, 25, 24, 23, 25, 26, 23, 23, 22, 24,
      25, 24, 23, 23, 24, 25, 24, 24, 23, 24, 24, 24,
      23, 24, 24, 24, 24, 24, 24, 24, 25, 25, 23, 24,
      24, 26, 25, 23, 23, 24, 24, 23, 24, 23, 23, 24,
      18
    ]
  }
]
{{< /chart >}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.01, 0.07, 0.31, 0.31,
      0.32, 0.31, 0.31, 0.33,
      0.32, 0.32, 0.31, 0.31,
      0.33,  0.3, 0.01, 0.01,
      0.02, 0.01, 0.01
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.01, 0.08, 0.36, 0.36,
      0.36, 0.35, 0.37, 0.37,
      0.35, 0.36, 0.36, 0.35,
      0.36, 0.32, 0.01, 0.01,
      0.02, 0.01, 0.01
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="CPU database load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02, 0.02, 0.42, 0.62,
       0.6,  0.6,  0.6, 0.62,
      0.62,  0.6, 0.62, 0.61,
      0.61, 0.61, 0.25, 0.02,
      0.02, 0.02, 0.02
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.02, 0.01, 0.25, 0.36,
      0.36, 0.35, 0.36, 0.35,
      0.34, 0.37, 0.35, 0.36,
      0.35, 0.37, 0.15, 0.02,
      0.02, 0.02, 0.02
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< /tab >}}
{{< /tabs >}}

#### Spring Boot scenario 2

Iteration creation rate = **10/s**

```txt
checks.........................: 100.00% 232800 out of 232800
data_received..................: 1.0 GB  14 MB/s
data_sent......................: 20 MB   270 kB/s
dropped_iterations.............: 450     5.968885/s
http_req_blocked...............: avg=5.53µs  min=162ns   med=501ns   max=85.2ms   p(90)=989ns    p(95)=1.17µs
http_req_connecting............: avg=242ns   min=0s      med=0s      max=6.7ms    p(90)=0s       p(95)=0s
http_req_duration..............: avg=14.96ms min=1.9ms   med=13.28ms max=156.15ms p(90)=25.17ms  p(95)=30.3ms
  { expected_response:true }...: avg=14.96ms min=1.9ms   med=13.28ms max=156.15ms p(90)=25.17ms  p(95)=30.3ms
http_req_failed................: 0.00%   0 out of 232800
http_req_receiving.............: avg=2.41ms  min=17.6µs  med=1.38ms  max=71.34ms  p(90)=5.57ms   p(95)=8.28ms
http_req_sending...............: avg=92.57µs min=10.47µs med=55.14µs max=42.4ms   p(90)=116.58µs p(95)=158.84µs
http_req_tls_handshaking.......: avg=4.04µs  min=0s      med=0s      max=40.3ms   p(90)=0s       p(95)=0s
http_req_waiting...............: avg=12.45ms min=0s      med=11.04ms max=155.41ms p(90)=20.83ms  p(95)=25.16ms
http_reqs......................: 232800  3087.903222/s
iteration_duration.............: avg=23.57s  min=20.06s  med=24.16s  max=25.43s   p(90)=24.79s   p(95)=24.94s
iterations.....................: 150     1.989628/s
vus............................: 12      min=10               max=50
vus_max........................: 50      min=50               max=50
```

{{< tabs >}}
{{< tab tabName="Req/s" >}}

{{< chart type="timeseries" title="Req/s count" >}}
[
  {
    label: 'Req/s',
    data: [
       170, 1815, 2801, 2812, 2770, 3096, 3297, 3364,
      3216, 2908, 3259, 3294, 3309, 3209, 3031, 3266,
      3166, 3341, 2976, 2953, 2901, 2909, 2959, 3047,
      2850, 3207, 3218, 3222, 2993, 2944, 3254, 3018,
      3211, 3214, 3064, 3086, 3355, 3149, 3211, 3143,
      3073, 3386, 3358, 2972, 3150, 3158, 3392, 3418,
      2909, 3005, 3318, 2955, 3275, 3036, 3024, 3348,
      3283, 3383, 3398, 2852, 3200, 3136, 3343, 3216,
      2945, 3202, 3404, 3244, 3020, 3053, 3188, 3211,
      3192, 3115, 2901, 1729
    ]
  }
]
{{< /chart >}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" >}}
[
  {
    label: 'VUs',
    data: [
      10, 20, 30, 40, 50, 50, 50, 50, 50, 50, 50, 50,
      50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 49,
      48, 50, 50, 50, 49, 49, 50, 50, 50, 50, 50, 50,
      50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
      50, 50, 49, 48, 50, 48, 50, 50, 50, 50, 50, 50,
      50, 50, 50, 50, 50, 50, 50, 50, 50, 45, 42, 38,
      35, 26, 12
    ]
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="Request duration in ms" >}}
[
  {
    label: 'Duration (ms)',
    data: [
       6,  5,  7, 10, 14, 16, 15, 15, 15, 17, 15, 15,
      15, 15, 16, 15, 15, 15, 17, 17, 17, 17, 17, 16,
      17, 15, 15, 15, 16, 16, 15, 16, 15, 15, 16, 16,
      15, 16, 15, 16, 16, 15, 15, 17, 16, 15, 15, 14,
      17, 16, 15, 17, 15, 16, 16, 15, 15, 15, 14, 17,
      15, 16, 15, 15, 17, 15, 14, 15, 16, 16, 14, 13,
      12, 11,  9,  6
    ]
  }
]
{{< /chart >}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.01, 0.01, 0.27, 0.38,
      0.38, 0.37, 0.35, 0.36,
      0.38, 0.38, 0.38, 0.37,
      0.36, 0.38, 0.39, 0.37,
      0.37, 0.05, 0.01
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.01, 0.01, 0.28, 0.39,
       0.4, 0.38, 0.36, 0.39,
      0.38, 0.38, 0.37, 0.38,
      0.39, 0.39, 0.39, 0.38,
      0.38, 0.05, 0.01
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="CPU database load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02, 0.02, 0.14, 0.46,
      0.49,  0.5, 0.47, 0.48,
      0.47, 0.49, 0.49,  0.5,
      0.47, 0.49,  0.5,  0.5,
      0.48, 0.28, 0.02
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.02, 0.02,  0.1, 0.31,
      0.32, 0.32, 0.29, 0.31,
      0.33, 0.32, 0.35, 0.34,
      0.33, 0.33, 0.32, 0.33,
      0.31, 0.17, 0.02
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< /tab >}}
{{< /tabs >}}

### ASP.NET Core

#### ASP.NET Core scenario 1

Iteration creation rate = **30/s**

```txt
checks.........................: 100.00% 60537 out of 60537
data_received..................: 1.4 GB  22 MB/s
data_sent......................: 5.4 MB  88 kB/s
dropped_iterations.............: 614     10.010036/s
http_req_blocked...............: avg=18.21µs  min=164ns   med=643ns    max=119.65ms p(90)=1.2µs    p(95)=1.39µs
http_req_connecting............: avg=1.19µs   min=0s      med=0s       max=7.21ms   p(90)=0s       p(95)=0s
http_req_duration..............: avg=47.41ms  min=3.21ms  med=47.19ms  max=150.24ms p(90)=64.58ms  p(95)=70.42ms
  { expected_response:true }...: avg=47.41ms  min=3.21ms  med=47.19ms  max=150.24ms p(90)=64.58ms  p(95)=70.42ms
http_req_failed................: 0.00%   0 out of 60537
http_req_receiving.............: avg=1.27ms   min=21.28µs med=577.04µs max=53.67ms  p(90)=2.93ms   p(95)=4.89ms
http_req_sending...............: avg=115.28µs min=14.99µs med=72.14µs  max=30.87ms  p(90)=151.69µs p(95)=216.28µs
http_req_tls_handshaking.......: avg=14.34µs  min=0s      med=0s       max=52.71ms  p(90)=0s       p(95)=0s
http_req_waiting...............: avg=46.02ms  min=2.92ms  med=46.04ms  max=148.92ms p(90)=62.52ms  p(95)=67.86ms
http_reqs......................: 60537   986.934156/s
iteration_duration.............: avg=2.48s    min=1s      med=2.51s    max=2.79s    p(90)=2.64s    p(95)=2.68s
iterations.....................: 1187    19.35165/s
vus............................: 24      min=24             max=50
vus_max........................: 50      min=50             max=50
```

{{< tabs >}}
{{< tab tabName="Req/s" >}}

{{< chart type="timeseries" title="Req/s count" >}}
[
  {
    label: 'Req/s',
    data: [
       500,  987,  969,  985,  980, 1036,  987, 1003,
       980,  965, 1017,  988, 1013,  948,  961, 1024,
       989, 1018,  996,  981, 1016,  993,  981,  987,
       964, 1020,  985, 1018,  997,  972, 1010,  994,
       998, 1001,  970, 1028, 1021, 1000, 1013,  975,
      1013,  965,  993,  972,  960, 1029,  975, 1005,
       998,  962, 1024,  991, 1001,  981,  962, 1015,
       985,  993, 1001,  968, 1008,  466
    ]
  }
]
{{< /chart >}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" >}}
[
  {
    label: 'VUs',
    data: [
      30, 46, 50, 50, 50, 50, 49, 50, 50, 49, 49, 46,
      50, 50, 47, 50, 49, 50, 49, 48, 50, 49, 50, 50,
      48, 50, 49, 49, 48, 50, 50, 48, 50, 50, 49, 49,
      49, 49, 49, 50, 49, 50, 50, 50, 48, 47, 50, 50,
      50, 48, 49, 50, 49, 50, 49, 50, 50, 49, 50, 50,
      24
    ]
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="Request duration in ms" >}}
[
  {
    label: 'Duration (ms)',
    data: [
      16, 31, 49, 49, 48, 47, 48, 48, 50, 48, 47, 49,
      47, 51, 50, 47, 48, 48, 48, 49, 47, 49, 49, 49,
      49, 47, 48, 48, 48, 49, 46, 49, 48, 47, 50, 46,
      47, 48, 48, 49, 47, 49, 48, 49, 51, 47, 48, 48,
      47, 50, 48, 48, 48, 49, 50, 47, 49, 48, 48, 49,
      42, 22
    ]
  }
]
{{< /chart >}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02,  0.1,  0.6, 0.58,
      0.58, 0.58, 0.57, 0.58,
       0.6, 0.58, 0.57, 0.58,
      0.57, 0.57, 0.04, 0.01,
      0.02, 0.02
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.01, 0.05, 0.25, 0.24,
      0.23, 0.24, 0.25, 0.24,
      0.24, 0.24, 0.24, 0.24,
      0.25, 0.24, 0.03, 0.01,
      0.02, 0.02
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="CPU database load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.01, 0.02,  0.5, 0.77,
      0.76, 0.76, 0.76, 0.76,
      0.77, 0.77, 0.75, 0.76,
      0.76, 0.77, 0.42, 0.02,
      0.02, 0.02, 0.02
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.02, 0.02, 0.17, 0.23,
      0.23, 0.24, 0.24, 0.23,
      0.23, 0.23, 0.23, 0.23,
      0.23, 0.23, 0.14, 0.02,
      0.02, 0.02, 0.02
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< /tab >}}
{{< /tabs >}}

#### ASP.NET Core scenario 2

Iteration creation rate = **10/s**

```txt
checks.........................: 100.00% 155200 out of 155200
data_received..................: 930 MB  14 MB/s
data_sent......................: 14 MB   206 kB/s
dropped_iterations.............: 500     7.429243/s
http_req_blocked...............: avg=7.19µs  min=170ns   med=579ns    max=70.57ms  p(90)=1.14µs   p(95)=1.32µs
http_req_connecting............: avg=367ns   min=0s      med=0s       max=4.55ms   p(90)=0s       p(95)=0s
http_req_duration..............: avg=20.06ms min=1.85ms  med=17.93ms  max=227.21ms p(90)=35.09ms  p(95)=41.47ms
  { expected_response:true }...: avg=20.06ms min=1.85ms  med=17.93ms  max=227.21ms p(90)=35.09ms  p(95)=41.47ms
http_req_failed................: 0.00%   0 out of 155200
http_req_receiving.............: avg=1.3ms   min=16.13µs med=566.94µs max=41.66ms  p(90)=3.1ms    p(95)=5.12ms
http_req_sending...............: avg=94.15µs min=11.56µs med=62.76µs  max=35.14ms  p(90)=130.16µs p(95)=171.55µs
http_req_tls_handshaking.......: avg=5.61µs  min=0s      med=0s       max=52.65ms  p(90)=0s       p(95)=0s
http_req_waiting...............: avg=18.66ms min=0s      med=16.5ms   max=226.18ms p(90)=33.14ms  p(95)=39.31ms
http_reqs......................: 155200  2306.036927/s
iteration_duration.............: avg=31.5s   min=28.79s  med=31.76s   max=33.25s   p(90)=32.83s   p(95)=32.95s
iterations.....................: 100     1.485849/s
vus............................: 12      min=10               max=50
vus_max........................: 50      min=50               max=50
```

{{< tabs >}}
{{< tab tabName="Req/s" >}}

{{< chart type="timeseries" title="Req/s count" >}}
[
  {
    label: 'Req/s',
    data: [
       180, 1475, 1881, 1960, 1863, 2200, 2252, 2434,
      2455, 2328, 2416, 2404, 2395, 2326, 2170, 2357,
      2314, 2513, 2381, 2355, 2438, 2318, 2496, 2455,
      2375, 2358, 2309, 2498, 2439, 2409, 2293, 2370,
      2363, 2383, 2290, 2339, 2316, 2460, 2386, 2413,
      2263, 2320, 2508, 2199, 2323, 2374, 2273, 2441,
      2319, 2344, 2328, 2328, 2507, 2430, 2307, 2431,
      2291, 2380, 2494, 2388, 2265, 2362, 2418, 2456,
      2245, 2323, 2199, 1317
    ]
  }
]
{{< /chart >}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" >}}
[
  {
    label: 'VUs',
    data: [
      10, 20, 30, 40, 50, 50, 50, 50, 50, 50, 50, 50,
      50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
      50, 50, 50, 50, 50, 50, 50, 50, 50, 49, 50, 48,
      47, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
      50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
      50, 49, 44, 40, 34, 27, 12
    ]
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="Request duration in ms" >}}
[
  {
    label: 'Duration (ms)',
    data: [
       8,  7, 11, 15, 21, 22, 22, 20, 20, 21, 20, 21,
      20, 21, 23, 21, 21, 20, 21, 21, 20, 21, 20, 20,
      21, 21, 21, 20, 20, 21, 21, 21, 21, 20, 21, 21,
      21, 19, 21, 20, 22, 21, 20, 22, 21, 21, 22, 20,
      21, 21, 21, 21, 20, 20, 21, 20, 22, 21, 20, 21,
      22, 21, 20, 18, 17, 14, 12,  7
    ]
  }
]
{{< /chart >}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.01, 0.04, 0.49, 0.59,
      0.58,  0.6,  0.6, 0.59,
      0.58, 0.59, 0.59, 0.59,
      0.61, 0.58,  0.6, 0.17,
      0.02, 0.01, 0.01
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.01, 0.03, 0.31, 0.35,
      0.36, 0.37, 0.35, 0.35,
      0.37, 0.37, 0.37, 0.37,
      0.37, 0.37, 0.37, 0.12,
      0.01, 0.01, 0.01
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< chart type="timeseries" title="CPU database load" stacked="true" max="1" step="5" >}}
[
  {
    label: 'User',
    data: [
      0.02, 0.02, 0.23, 0.46,
      0.49, 0.48, 0.51,  0.5,
      0.49, 0.48, 0.49, 0.48,
      0.49, 0.51,  0.5, 0.36,
      0.02, 0.02, 0.02
    ],
    borderColor: '#4bc0c0',
    backgroundColor: '#4bc0c0',
    fill: true
  },
  {
    label: 'System',
    data: [
      0.02, 0.01, 0.17, 0.33,
      0.35, 0.36, 0.36, 0.35,
      0.34, 0.36, 0.35, 0.36,
      0.36, 0.34, 0.35, 0.26,
      0.02, 0.02, 0.02
    ],
    borderColor: '#ff6384',
    backgroundColor: '#ff6384',
    fill: true
  }
]
{{< /chart >}}

{{< /tab >}}
{{< /tabs >}}

### Conclusion

Here are the final req/s results for each framework against PgSQL database.

{{< chart type="timeseries" title="Database intensive Scenario" >}}
[
  {
    label: "Laravel",
    borderColor: "#c2410c",
    backgroundColor: "#c2410c",
    data: [
      1, 293, 427, 440, 455, 453, 455, 424, 449,
      440, 431, 449, 433, 452, 456, 450, 452, 423,
      441, 434, 446, 443, 436, 450, 423, 445, 452,
      423, 426, 449, 451, 452, 427, 444, 455, 453,
      450, 399, 440, 452, 448, 451, 423, 450, 450,
      449, 431, 419, 448, 453, 450, 442, 441, 452,
      422, 427, 437, 423, 445, 450, 449, 435, 411,
      360
    ],
  },
  {
    label: "Symfony",
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
    data: [
      14, 383, 421, 413, 428, 432, 431, 421, 437,
      439, 432, 432, 418, 426, 436, 434, 430, 420,
      438, 436, 430, 430, 408, 426, 436, 436, 432,
      419, 439, 433, 432, 418, 414, 424, 439, 431,
      430, 421, 435, 437, 430, 420, 423, 436, 437,
      433, 433, 419, 437, 435, 420, 426, 418, 436,
      435, 434, 430, 418, 437, 431, 419, 430, 418,
      280
    ],
  },
  {
    label: "FastAPI",
    borderColor: "#0f766e",
    backgroundColor: "#0f766e",
    data: [
      205, 686, 625, 657, 643, 684, 625, 652, 606,
      656, 610, 662, 672, 687, 647, 650, 636, 663,
      665, 617, 600, 621, 637, 655, 628, 681, 649,
      637, 662, 568, 669, 667, 630, 625, 630, 685,
      654, 647, 667, 631, 618, 656, 614, 695, 650,
      659, 629, 638, 646, 609, 642, 661, 647, 677,
      601, 662, 665, 608, 671, 628, 632, 629, 150
    ],
  },
  {
    label: "NestJS",
    borderColor: "#b91c1c",
    backgroundColor: "#b91c1c",
    data: [
      99, 730, 768, 784, 763, 777, 816, 790, 745,
      786, 768, 826, 819, 838, 786, 843, 825, 831,
      842, 825, 854, 850, 845, 847, 834, 842, 851,
      839, 842, 840, 854, 835, 844, 842, 853, 862,
      842, 837, 829, 828, 851, 854, 847, 862, 836,
      847, 843, 856, 846, 828, 855, 841, 834, 856,
      813, 838, 853, 853, 834, 847, 831, 787
    ],
  },
  {
    label: "Spring Boot",
    borderColor: "#15803d",
    backgroundColor: "#15803d",
    data: [
      1252, 1842, 1865, 1887, 1927, 1918, 1954,
      1939, 1963, 1897, 1825, 1956, 1952, 1861,
      1885, 1891, 1904, 1898, 1791, 1810, 1904,
      1904, 1998, 1934, 1887, 1888, 1972, 1950,
      1929, 1889, 1913, 1951, 1926, 1904, 1862,
      1946, 1947, 1948, 1918, 1889, 1873, 1903,
      1915, 1909, 1893, 1863, 1963, 1893, 1941,
      1787, 1839, 1950, 1988, 1953, 1868, 1979,
      1944, 1944, 1943, 1917, 1268
    ],
  },
  {
    label: "ASP.NET Core",
    borderColor: "#6d28d9",
    backgroundColor: "#6d28d9",
    data: [
      500,  987,  969,  985,  980, 1036,  987, 1003,
       980,  965, 1017,  988, 1013,  948,  961, 1024,
       989, 1018,  996,  981, 1016,  993,  981,  987,
       964, 1020,  985, 1018,  997,  972, 1010,  994,
       998, 1001,  970, 1028, 1021, 1000, 1013,  975,
      1013,  965,  993,  972,  960, 1029,  975, 1005,
       998,  962, 1024,  991, 1001,  981,  962, 1015,
       985,  993, 1001,  968, 1008,  466
    ],
  },
]
{{< /chart >}}

{{< chart type="timeseries" title="Runtime intensive Scenario" >}}
[
  {
    label: "Laravel",
    borderColor: "#c2410c",
    backgroundColor: "#c2410c",
    data: [
      23,  88, 152, 246, 418, 486, 610, 668, 659, 717, 714,
      765, 788, 774, 759, 753, 782, 772, 663, 785, 755, 808,
      776, 802, 797, 753, 796, 766, 793, 809, 752, 788, 773,
      792, 786, 737, 777, 792, 787, 798, 753, 793, 780, 656,
      814, 773, 803, 778, 765, 799, 728, 793, 792, 783, 780,
      758, 779, 787, 770, 792, 754, 771, 796, 779, 797, 750,
      795, 798, 764, 807, 760, 794, 804, 778, 794, 720, 792,
      794, 757, 793, 749, 790, 804, 759, 597, 722, 807, 765,
      791, 814, 361
    ],
  },
  {
    label: "Symfony",
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
    data: [
      32,  287,  748, 1203, 1479, 1512, 1657, 1594, 1772,
      1751, 1731, 1799, 1849, 1794, 1728, 1758, 1779, 1812,
      1788, 1852, 1618, 1880, 1862, 1836, 1857, 1755, 1849,
      1869, 1869, 1804, 1773, 1818, 1874, 1809, 1866, 1802,
      1809, 1885, 1791, 1859, 1781, 1845, 1862, 1838, 1890,
      1732, 1885, 1749, 1867, 1734, 1598, 1862, 1848, 1890,
      1796, 1768, 1831, 1888, 1825, 1815, 1830, 1823, 1855,
      1828, 1824, 1699, 1861, 1820, 1859, 1743, 1777, 1846,
      1809, 1839, 1776, 1742, 1721, 1641, 1665, 1301,  155
    ],
  },
  {
    label: "FastAPI",
    borderColor: "#0f766e",
    backgroundColor: "#0f766e",
    data: [
      12,  155, 362, 681, 799, 914, 973, 975, 984, 928, 959,
      964,  934, 975, 874, 924, 883, 908, 931, 888, 983, 935,
      967,  959, 898, 942, 939, 935, 933, 904, 926, 909, 911,
      904,  945, 929, 990, 962, 973, 896, 998, 962, 930, 983,
      891, 1007, 944, 925, 983, 952, 938, 984, 939, 936, 872,
      959,  996, 983, 968, 945, 909, 964, 973, 897, 921, 996,
      953,  986, 941, 929, 942, 966, 880, 943, 901, 956, 925,
      944,  967, 899, 935, 937, 924, 960, 899, 999, 917, 891,
      880,  884, 538
    ],
  },
  {
    label: "NestJS",
    borderColor: "#b91c1c",
    backgroundColor: "#b91c1c",
    data: [
      45,  363, 1030, 1417, 1719, 1698, 1910, 1844, 1812,
      1991, 1990, 1860, 1983, 1890, 1938, 1890, 1927, 1790,
      1873, 1963, 1954, 1937, 1961, 1960, 1952, 1924, 1952,
      1929, 1915, 1907, 1978, 1897, 1953, 1880, 1962, 1961,
      1930, 2001, 1938, 1957, 1952, 1946, 1965, 1879, 1976,
      1957, 1886, 1875, 1913, 1942, 1960, 1969, 1961, 1925,
      1989, 1997, 1926, 1825, 1898, 1981, 1977, 1926, 1988,
      1906, 1994, 2038, 1936, 1955, 1900, 1973, 1980, 2019,
      1962, 1917, 1984, 1944, 1961, 1878, 1902, 2018, 1956,
      1880, 1551,  152
    ],
  },
  {
    label: "Spring Boot",
    borderColor: "#15803d",
    backgroundColor: "#15803d",
    data: [
      170, 1815, 2801, 2812, 2770, 3096, 3297, 3364,
      3216, 2908, 3259, 3294, 3309, 3209, 3031, 3266,
      3166, 3341, 2976, 2953, 2901, 2909, 2959, 3047,
      2850, 3207, 3218, 3222, 2993, 2944, 3254, 3018,
      3211, 3214, 3064, 3086, 3355, 3149, 3211, 3143,
      3073, 3386, 3358, 2972, 3150, 3158, 3392, 3418,
      2909, 3005, 3318, 2955, 3275, 3036, 3024, 3348,
      3283, 3383, 3398, 2852, 3200, 3136, 3343, 3216,
      2945, 3202, 3404, 3244, 3020, 3053, 3188, 3211,
      3192, 3115, 2901, 1729
    ],
  },
  {
    label: "ASP.NET Core",
    borderColor: "#6d28d9",
    backgroundColor: "#6d28d9",
    data: [
       180, 1475, 1881, 1960, 1863, 2200, 2252, 2434,
      2455, 2328, 2416, 2404, 2395, 2326, 2170, 2357,
      2314, 2513, 2381, 2355, 2438, 2318, 2496, 2455,
      2375, 2358, 2309, 2498, 2439, 2409, 2293, 2370,
      2363, 2383, 2290, 2339, 2316, 2460, 2386, 2413,
      2263, 2320, 2508, 2199, 2323, 2374, 2273, 2441,
      2319, 2344, 2328, 2328, 2507, 2430, 2307, 2431,
      2291, 2380, 2494, 2388, 2265, 2362, 2418, 2456,
      2245, 2323, 2199, 1317
    ],
  },
]
{{< /chart >}}
