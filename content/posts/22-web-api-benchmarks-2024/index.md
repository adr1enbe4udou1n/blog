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

### Side note on PHP configuration

Note as I tested PostgreSQL for all frameworks as main Database, but I added MySQL for Laravel and Symfony too, because of simplicity of PHP for switching database without changing code base, as I have both DB drivers integrated into base PHP Docker image. It allows to have an interesting Eloquent VS Doctrine ORM comparison.

{{< alert >}}
I enabled OPcache and use simple Apache as web server, as it's the simplest configuration for PHP apps containers. I tested [FrankenPHP](https://frankenphp.dev/), which seems promising at first glance, but performance results was just far lower than Apache, even with worker mode...
{{< /alert >}}

## The target hardware

We'll be using a dedicated hardware target, running on a Docker swarm cluster, each node composed of 4 CPUs and 8 GB of RAM.

Traefik will be used as a reverse proxy, with a single replica, and will load balance the requests to the replicas of each node.

{{< mermaid >}}
flowchart TD
client((Client))
client -- Port 80 443 --> traefik-01
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

The Swarm cluster is fully monitored with [Prometheus](https://prometheus.io/) and [Grafana](https://grafana.com/), allowing to get relevant performance result.

## The scenarios

We'll be using [k6](https://k6.io/) to run the tests, with [constant-arrival-rate executor](https://k6.io/docs/using-k6/scenarios/executors/constant-arrival-rate/) for progressive load testing, following 2 different scenarios :

- **Scenario 1** : fetch all articles, following the pagination
- **Scenario 2** : fetch all articles, calling each single article with slug, fetch associated comments for each article, and fetch profile of each related author

Duration of each scenario is 1 minute, with a 30 seconds graceful for finishing last started iterations. Results with one single test failures, i.e. any response status different than 200 or any response json error parsing, are not accepted.

The **iteration rate** (rate / timeUnit) will be choosen in order to obtain the highest possible request rate, without any test failures.

### Scenario 1

The interest of this scenario is to be very database intensive, by fetching all articles, authors, and favorites, following the pagination, with a couple of SQL queries. Note as each code implementation use eager loading to avoid N+1 queries.

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

To summary the expected JSON response:

```json
{
    "articles": [
        {
            "title": "Laboriosam aliquid dolore sed dolore",
            "slug": "laboriosam-aliquid-dolore-sed-dolore",
            "description": "Rerum beatae est enim cum similique.",
            "body": "Voluptas maxime incidunt...",
            "createdAt": "2023-12-23T16:02:03.000000Z",
            "updatedAt": "2023-12-23T16:02:03.000000Z",
            "author": {
                "username": "Devin Swift III",
                "bio": "Nihil impedit totam....",
                "image": "https:\/\/randomuser.me\/api\/portraits\/men\/47.jpg",
                "following": false
            },
            "tagList": [
                "aut",
                "cumque"
            ],
            "favorited": false,
            "favoritesCount": 5
        }
    ],
    //...
    "articlesCount": 500
}
```

The expected pseudocode SQL queries to build this response:

```sql
SELECT * FROM articles LIMIT 10 OFFSET 0;
SELECT count(*) FROM articles;
SELECT * FROM users WHERE id IN (<articles.author_id...>);
SELECT count(*) FROM favorites WHERE article_id IN (<articles.id...>);
SELECT * FROM article_tag WHERE article_id IN (<articles.id...>);
```

### Scenario 2

The interest of this scenario is to be mainly runtime intensive, by calling each endpoint of the API.

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

### Laravel MySQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **3/s**   |
| Total requests     | **8007**  |
| Total iterations   | **157**   |
| Max req/s          | **140**   |
| p(90) req duration | **544ms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|6,69,81,103,103,113,83,91,103,112,99,101,109,101,106,108,100,112,117,124,113,111,117,108,129,119,124,81,113,128,124,108,108,128,111,128,123,127,100,124,124,118,119,125,121,101,96,120,110,130,137,117,127,120,124,129,127,115,121,114,126,121,103,124,120,120,116,102,122,103,109,81" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|3,6,8,10,12,13,14,16,19,20,23,26,25,27,28,29,31,34,35,36,37,39,41,43,45,47,48,49,49,50,49,49,48,50,49,49,49,49,49,50,49,48,48,48,49,48,50,49,48,46,48,49,48,49,48,49,47,50,49,48,46,44,42,38,36,34,33,27,18,17,4" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|36,37,71,70,93,104,145,152,157,171,186,224,224,265,223,295,256,260,323,286,309,324,322,353,365,350,409,454,475,408,400,395,495,414,421,391,415,394,458,391,422,416,414,400,382,443,440,494,433,376,372,381,401,410,384,382,393,381,454,369,402,438,393,378,319,316,307,304,254,212,151,80" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.03,0.34,0.37,0.36,0.38,0.36,0.03|#4bc0c0$System|0.02,0.08,0.07,0.09,0.08,0.08,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.03,0.89,0.9,0.91,0.91,0.53,0.03|#4bc0c0$System|0.02,0.07,0.07,0.09,0.09,0.05,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

As expected here, database is the bottleneck. We'll get slow response time at full load (> 500ms).

### Laravel MySQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **0.5/s** |
| Total requests     | **29015** |
| Total iterations   | **5**     |
| Max req/s          | **360**   |
| p(90) req duration | **117ms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|1,38,40,137,150,211,216,255,247,269,285,299,294,291,295,322,322,327,308,314,329,329,341,324,318,336,341,344,328,329,349,347,353,329,333,352,360,351,339,330,355,359,353,328,340,355,348,355,340,334,356,347,356,346,337,347,358,353,336,341,347,347,350,328,345,355,351,351,349,341,354,351,353,340,343,343,353,362,336,333,353,344,362,338,335,353,353,355,339,320,304" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,14,14,15,15,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,24,25,25,26,25,26,26,27,27,28,28,29,29,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,27,27,27,26,26,26,26,26,26,26,26,26" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|30,26,26,14,13,13,13,15,16,18,17,19,20,24,23,24,24,27,29,31,30,32,32,36,37,38,37,40,42,45,42,45,45,51,50,50,50,53,56,57,58,58,60,65,64,65,65,66,71,73,70,71,70,75,71,76,72,76,80,78,82,83,82,83,82,78,79,79,79,81,78,80,78,81,78,85,79,77,83,81,75,77,76,75,76,74,73,73,76,80,74" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.27,0.69,0.76,0.77,0.77,0.77,0.03|#4bc0c0$System|0.08,0.16,0.2,0.2,0.19,0.21,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.14,0.2,0.2,0.2,0.21,0.22,0.03|#4bc0c0$System|0.11,0.14,0.15,0.17,0.14,0.14,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

Now we have a very runtime intensive scenario, with workers as bottleneck, API is keeping up with a very low response time (~100ms).

### Laravel PgSQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### Laravel PgSQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### Symfony MySQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### Symfony MySQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### Symfony PgSQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### Symfony PgSQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### FastAPI PgSQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### FastAPI PgSQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### NestJS PgSQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### NestJS PgSQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### Spring Boot PgSQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### Spring Boot PgSQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### ASP.NET Core PgSQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

### ASP.NET Core PgSQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value   |
| ------------------ | ------- |
| Iteration rate     | **X**   |
| Total requests     | **X**   |
| Total iterations   | **X**   |
| Max req/s          | **X**   |
| p(90) req duration | **Xms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}
