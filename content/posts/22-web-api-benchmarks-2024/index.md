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

### Laravel

#### Laravel MySQL scenario 1

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

#### Laravel MySQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **1/2/s** |
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

#### Laravel PgSQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **2/s**   |
| Total requests     | **4386**  |
| Total iterations   | **86**    |
| Max req/s          | **70**    |
| p(90) req duration | **1.24s** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|31,62,60,64,63,68,66,63,64,64,67,66,64,65,65,64,66,63,55,69,65,66,63,66,65,65,65,60,64,66,65,63,64,58,56,59,53,52,56,60,52,53,47,50,53,56,50,45,54,56,54,49,47,47,52,56,47,44,51,58,53,43,51,48,48,45,45,40,44,41,46,41,43,43,38,42,36,38,36,35,29" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|2,4,6,8,10,10,12,14,15,17,18,20,21,22,24,26,28,29,31,32,33,35,37,37,39,40,42,44,45,47,48,49,50,50,49,50,49,49,50,50,50,50,49,50,49,50,50,50,49,50,49,50,49,50,49,49,50,49,50,48,48,48,47,45,43,42,39,38,37,35,30,30,25,21,20,19,17,15,12,8" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|50,56,89,114,147,148,169,210,231,239,253,284,333,352,344,364,431,458,448,497,483,534,558,573,561,597,628,693,689,687,715,743,780,879,847,848,916,929,892,905,944,941,989,954,979,944,932,979,1009,929,934,940,1059,981,1001,962,989,1047,963,1015,911,925,1046,1008,962,905,970,910,894,877,792,725,730,584,515,505,474,459,382,289,186" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.02,0.31,0.29,0.28,0.28,0.27,0.03|#4bc0c0$System|0.01,0.06,0.06,0.06,0.06,0.06,0.01|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.04,0.8,0.82,0.85,0.86,0.87,0.36,0.03|#4bc0c0$System|0.02,0.19,0.18,0.15,0.14,0.13,0.05,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

Now it seems interesting, Laravel performs literally about 2x slower with PostgreSQL than MySQL, with a very high response time (> 1s). Many says that MySQL is better than PostgreSQL for reading data, but I can't explain such a difference. It will be interesting to compare with Symfony Doctrine to get a better idea.

#### Laravel PgSQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **1/3/s** |
| Total requests     | **16219** |
| Total iterations   | **0**     |
| Max req/s          | **220**   |
| p(90) req duration | **128ms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|16,26,27,64,93,94,119,128,120,134,149,150,157,155,152,169,168,169,167,166,175,178,185,175,176,187,181,190,185,179,190,196,194,187,178,193,202,195,195,183,195,201,195,196,190,203,195,205,195,191,203,205,205,197,188,200,208,207,197,190,208,215,212,205,185,204,203,211,194,189,208,211,201,198,199,197,207,206,203,194,203,207,203,198,195,202,206,207,203,191,41" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7,8,8,8,9,9,9,10,10,10,11,11,11,12,12,12,13,13,13,14,14,14,15,15,15,16,16,16,17,17,17,18,18,18,19,19,19,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|44,38,37,27,21,21,22,23,24,28,27,26,30,32,32,34,36,35,40,42,40,43,43,46,50,48,49,51,54,55,56,56,56,63,67,62,62,67,66,74,71,70,75,76,78,77,82,77,85,89,84,85,88,91,96,97,92,94,103,104,99,99,97,104,110,107,102,100,105,109,105,99,104,105,107,106,100,102,103,107,104,102,103,104,106,105,103,101,103,108,102" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.05,0.49,0.64,0.7,0.74,0.72,0.6,0.03|#4bc0c0$System|0.02,0.1,0.12,0.14,0.14,0.14,0.12,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.09,0.28,0.34,0.35,0.37,0.39,0.03,0.03|#4bc0c0$System|0.13,0.36,0.41,0.44,0.46,0.47,0.02,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

Laravel seems less limited by database performance, but still slower than MySQL. Workers and databases are both heavy loaded, and finally we didn't complete a single scenario iteration !

### Symfony

#### Symfony MySQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **3/s**   |
| Total requests     | **3264**  |
| Total iterations   | **64**    |
| Max req/s          | **50**    |
| p(90) req duration | **1.38s** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|13,37,37,38,41,40,39,38,37,42,35,39,37,40,40,38,38,38,38,41,37,42,39,33,45,41,42,32,39,44,38,33,41,44,32,43,41,43,32,39,45,40,36,36,40,39,37,44,40,35,42,43,29,41,40,44,38,35,42,41,40,38,39,40,40,40,43,41,43,43,38,40,39,48,43,42,39,41,40,45,38,44,37,10" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|3,6,9,12,15,18,21,24,27,30,33,36,39,42,45,48,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,49,50,50,50,49,49,50,50,50,49,50,50,49,50,50,49,49,48,47,46,43,42,42,40,36,35,32,28,23,17,14,14,13,12,10,9,8,2" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|85,107,182,244,304,380,458,555,623,664,740,817,916,994,1041,1109,1224,1272,1289,1272,1230,1243,1311,1343,1282,1227,1267,1247,1275,1273,1291,1300,1329,1261,1243,1278,1241,1307,1235,1277,1245,1269,1271,1385,1298,1220,1256,1288,1278,1258,1271,1250,1307,1353,1257,1235,1255,1254,1304,1245,1222,1262,1287,1241,1191,1122,1098,1073,1055,953,863,902,809,692,536,373,350,350,300,298,239,221,182,78" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.03,0.2,0.19,0.18,0.2,0.2,0.18,0.03|#4bc0c0$System|0.02,0.1,0.09,0.1,0.08,0.1,0.08,0.03|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.04,0.97,0.97,0.97,0.97,0.98,0.04,0.03|#4bc0c0$System|0.02,0.03,0.03,0.03,0.03,0.02,0.02,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

It's getting pretty ugly here, with a very high response time (> 1s) at full load. About 3 times slower than Laravel in the same context.

#### Symfony MySQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **1/3/s** |
| Total requests     | **32086** |
| Total iterations   | **18**    |
| Max req/s          | **410**   |
| p(90) req duration | **41ms**  |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|17,44,40,87,174,168,194,228,229,256,302,289,308,335,345,346,343,328,374,381,359,362,368,393,389,403,380,371,390,387,388,366,379,400,389,397,382,373,390,401,393,387,387,392,413,411,379,390,413,414,414,380,394,417,406,413,388,393,414,417,417,391,395,417,413,410,390,396,409,413,408,378,381,394,412,405,381,393,397,395,396,364,375,363,378,371,336,324,312,292,110" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7,8,8,8,9,9,8,8,8,8,9,9,9,9,9,9,10,10,9,10,10,10,11,11,11,11,11,11,12,12,12,12,12,12,13,13,12,13,13,13,14,13,13,13,12,12,12,12,12,12,11,11,11,10,10,10,10,9,9,9,8,8,7,7,6,6,6,5,4,3" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|28,22,24,17,11,12,12,13,13,14,13,14,14,15,14,16,17,18,17,18,19,20,21,20,22,22,22,23,21,21,21,24,24,23,23,22,25,26,25,24,25,26,27,28,26,27,29,28,28,29,28,33,31,29,30,31,33,32,31,31,32,36,33,31,30,29,31,30,29,29,28,29,29,27,24,24,26,25,23,23,21,22,21,20,18,1" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.03,0.42,0.56,0.59,0.59,0.58,0.48,0.03|#4bc0c0$System|0.02,0.24,0.32,0.31,0.36,0.34,0.27,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.09,0.32,0.37,0.38,0.4,0.38,0.12,0.03|#4bc0c0$System|0.04,0.08,0.09,0.1,0.1,0.08,0.04,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

The situation is completely different here, Symfony is able to handle the load, better than Laravel in the same context, with a very low response time (~40ms). Let's see if it's able to keep up with the same performance with PostgreSQL contrary to Laravel.

#### Symfony PgSQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **3/s**   |
| Total requests     | **8160**  |
| Total iterations   | **160**   |
| Max req/s          | **120**   |
| p(90) req duration | **469ms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|28,108,116,120,121,112,119,121,121,120,111,116,120,120,116,111,116,116,124,107,115,114,119,119,116,112,118,118,119,117,111,118,117,118,116,112,116,115,123,120,111,113,121,114,117,115,107,123,117,114,107,116,123,115,115,113,121,114,121,115,111,117,121,120,119,116,113,121,123,123,88" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|3,6,9,12,12,13,14,16,17,19,19,20,22,23,24,25,27,28,29,31,33,33,35,36,38,38,39,41,43,44,46,46,48,48,50,49,47,50,50,50,49,50,49,50,50,49,50,47,49,49,49,49,48,48,50,48,50,50,50,47,48,47,44,41,37,36,32,27,23,17,5" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|125,55,76,97,107,113,119,128,142,156,172,176,185,190,206,223,236,240,250,271,297,288,294,305,326,345,331,356,351,382,394,401,395,414,431,446,418,419,411,415,457,422,422,418,424,443,428,415,408,429,462,423,409,432,420,435,419,419,425,410,437,396,380,354,322,321,289,248,203,147,73" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.03,0.24,0.41,0.39,0.39,0.39,0.03,0.03|#4bc0c0$System|0.02,0.06,0.11,0.12,0.11,0.13,0.02,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.04,0.69,0.71,0.7,0.72,0.72,0.04,0.03|#4bc0c0$System|0.03,0.29,0.29,0.3,0.28,0.28,0.02,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

Performance is strangely very similar with Laravel + MySQL on same scenario. Symfony performs clearly better here with PostgreSQL than MySQL, between 2 to 3 times, which is the complete opposite of Laravel.

#### Symfony PgSQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **1/3/s** |
| Total requests     | **19633** |
| Total iterations   | **4**     |
| Max req/s          | **250**   |
| p(90) req duration | **95ms**  |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|29,30,29,107,108,110,149,152,153,186,178,171,200,203,197,206,199,208,217,215,213,211,225,219,232,221,209,230,239,228,223,217,240,235,246,235,223,233,248,247,233,216,245,246,253,235,229,241,246,243,238,219,242,239,251,238,227,247,251,249,241,235,246,246,248,241,231,240,252,244,231,229,242,246,250,237,227,245,250,249,232,231,245,243,247,237,230,245,251,233" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7,8,8,8,9,9,9,10,10,10,11,11,11,12,12,12,13,13,13,14,14,14,15,15,15,16,16,16,17,17,17,18,18,18,19,19,19,20,20,20,20,20,19,19,19,18,18,18,18,18,18,18,18,18,18,18,18,18,17,17,17,17,17,17,17,17,17,17,17,16" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|34,34,34,19,18,18,20,19,19,21,22,23,25,24,25,29,30,29,32,32,33,38,35,37,39,41,43,43,42,43,49,50,46,51,48,51,57,56,53,56,60,64,62,60,60,68,70,66,68,70,72,80,75,74,76,79,83,82,79,80,82,82,81,76,76,79,77,74,72,74,77,77,75,73,72,76,78,74,72,68,73,74,69,70,68,72,72,70,67,68" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.12,0.55,0.67,0.71,0.73,0.73,0.29,0.03,0.03|#4bc0c0$System|0.05,0.17,0.2,0.21,0.22,0.2,0.09,0.01,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.15,0.28,0.32,0.32,0.33,0.32,0.03,0.03,0.03|#4bc0c0$System|0.2,0.37,0.4,0.43,0.43,0.43,0.02,0.02,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

My mind is broken, now it performs slower than with MySQL in same scenario, about almost twice slower. The 1st scenario shown the inverse. At least it performs better than Laravel with PostgreSQL, but just slightly. To summary the 2nd scenario give MySQL a good advantage against PostgreSQL **with PHP**.

### FastAPI

As a side note here, uvicorn is limited to 1 CPU core, so I use 2 replicas on each worker to use all CPU cores.

#### FastAPI PgSQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **10/s**  |
| Total requests     | **30651** |
| Total iterations   | **601**   |
| Max req/s          | **550**   |
| p(90) req duration | **49ms**  |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|2,385,495,476,462,502,534,518,496,480,513,520,520,509,473,539,491,483,516,463,526,522,520,512,503,545,478,541,468,521,519,489,530,469,479,513,515,495,513,491,508,523,548,483,500,526,505,527,519,496,506,541,504,507,478,508,535,521,488,480,543,379" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|7,8,9,11,11,11,11,12,12,12,11,12,11,12,12,12,13,14,15,15,14,13,15,14,12,13,12,13,15,12,14,15,16,16,16,16,16,18,17,17,16,16,15,18,14,16,15,15,17,16,16,16,17,16,16,15,15,16,16,17" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|25,14,15,18,21,22,21,21,22,24,23,22,23,23,25,24,24,27,26,29,28,27,27,27,27,25,28,24,27,27,25,27,28,30,33,33,32,31,31,34,33,32,29,31,33,30,33,31,31,32,31,29,30,31,31,31,31,30,32,34,32,22" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.03,0.02,0.63,0.66,0.64,0.64,0.03|#4bc0c0$System|0.01,0.01,0.13,0.13,0.15,0.14,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.03,0.03,0.39,0.37,0.38,0.38,0.03|#4bc0c0$System|0.02,0.02,0.13,0.13,0.16,0.15,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

Now we are talking, FastAPI outperforms above PHP frameworks, and database isn't the bottleneck anymore.

#### FastAPI PgSQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **2/s**   |
| Total requests     | **71394** |
| Total iterations   | **16**    |
| Max req/s          | **870**   |
| p(90) req duration | **113ms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|18,187,561,712,691,710,760,736,773,728,812,853,818,874,808,762,828,797,783,779,779,786,828,795,771,804,877,803,852,828,771,877,837,862,773,813,794,834,770,804,768,803,811,839,780,827,821,824,846,807,808,797,837,859,810,788,803,847,839,783,761,835,800,869,787,775,811,828,840,826,837,873,840,857,819,816,817,763,861,769,789,850,832,801,790,771,784,760,773,756,559" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,49,50,50,50,50,49,49,50,50,50,50,50,50,50,48,48,48,48,47,47,47,47,47,46,45,45,45,44,44,43,43,42,41,40,40,38,38,38" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|13,11,7,8,11,14,16,19,20,25,24,25,30,29,35,39,38,42,45,49,51,53,52,58,63,60,58,63,58,60,66,56,60,57,65,60,63,60,66,61,66,60,64,59,64,60,61,61,59,61,61,64,60,57,61,64,63,59,59,63,61,64,63,57,63,63,63,58,56,59,56,56,55,55,57,57,57,59,52,59,56,51,52,53,53,53,53,51,50,50,46" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.11,0.69,0.72,0.7,0.7,0.72,0.49,0.02|#4bc0c0$System|0.03,0.19,0.19,0.18,0.17,0.17,0.14,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.19,0.29,0.31,0.33,0.32,0.32,0.03,0.03|#4bc0c0$System|0.09,0.19,0.24,0.26,0.24,0.24,0.02,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

FastAPI performs around twice better PHP main frameworks in every situation. I'm not sure that testing it on MySQL change anything.

### NestJS

#### NestJS PgSQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **15/s**  |
| Total requests     | **37281** |
| Total iterations   | **731**   |
| Max req/s          | **700**   |
| p(90) req duration | **Xms**   |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|111,508,571,566,569,558,544,672,589,628,607,610,555,527,586,596,568,598,581,601,630,595,625,615,623,601,620,685,621,569,579,600,672,643,577,663,695,715,581,576,584,605,605,659,638,594,627,583,603,622,642,606,589,618,584,635,642,592,548,568,653,617,237" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|15,22,28,37,43,49,50,50,50,46,50,50,49,46,47,50,50,49,49,49,49,49,49,48,49,49,50,50,47,49,50,46,48,50,48,49,48,50,49,50,48,49,49,48,49,48,50,47,47,46,48,49,48,46,47,48,50,50,48,43,27" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|14,25,36,48,62,75,86,73,83,76,78,79,88,93,82,78,86,83,85,81,74,84,79,77,76,82,79,70,78,83,84,82,72,74,86,74,68,64,84,83,84,78,82,74,71,85,77,83,81,78,73,78,83,78,81,79,73,81,89,89,66,45,24" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.06,0.05,0.42,0.43,0.44,0.42,0.04|#4bc0c0$System|0.02,0.08,0.56,0.53,0.51,0.55,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.03,0.2,0.22,0.24,0.22,0.1,0.03|#4bc0c0$System|0.02,0.15,0.17,0.17,0.18,0.07,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

It's even better than FastAPI, let's keep up on scenario 2.

#### NestJS PgSQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value      |
| ------------------ | ---------- |
| Iteration rate     | **3/s**    |
| Total requests     | **105536** |
| Total iterations   | **68**     |
| Max req/s          | **1400**   |
| p(90) req duration | **53ms**   |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|17,369,682,787,878,1048,1104,1102,1083,1147,1171,1246,1276,1182,1200,1281,1233,1302,1247,1249,1320,1382,1386,1362,1382,1357,1379,1423,1259,1296,1340,1341,1394,1264,1328,1446,1365,1356,1258,1326,1324,1466,1372,1206,1287,1352,1449,1322,1248,1367,1332,1341,1305,1264,1284,1362,1343,1428,1274,1319,1393,1440,1434,1228,1223,1349,1356,1421,1278,1269,1158,1215,1239,1068,1151,1192,1152,1210,1083,1132,1165,1154,1193,1035,984,765,36" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|3,6,9,12,15,18,21,24,27,30,33,36,39,42,45,48,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,49,50,50,49,50,50,50,50,50,50,49,49,50,50,50,50,49,49,49,50,49,46,44,43,40,40,36,32,29,24,18,18,18,18,18,18,18,18,18,18,17,15,12,9,4" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|20,8,8,12,13,14,16,19,22,23,25,26,28,33,35,35,39,38,40,40,37,36,36,37,36,37,36,35,40,39,37,37,36,39,37,35,36,37,40,37,38,34,36,41,39,36,34,37,40,36,38,37,37,40,39,36,37,35,38,39,36,34,32,35,35,30,29,25,26,23,20,15,14,17,16,15,15,15,16,16,15,14,12,12,10,7,5" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.03,0.43,0.47,0.45,0.45,0.45,0.35,0.02|#4bc0c0$System|0.02,0.54,0.52,0.52,0.52,0.52,0.57,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.08,0.37,0.39,0.37,0.38,0.34,0.17,0.04|#4bc0c0$System|0.01,0.27,0.31,0.32,0.31,0.28,0.11,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

What can I say, NestJS is the clear winner so far. The native even loop system makes miracles. It's time to test it against compiled language.

### Spring Boot

#### Spring Boot PgSQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **10**    |
| Total requests     | **29376** |
| Total iterations   | **576**   |
| Max req/s          | **500**   |
| p(90) req duration | **161ms** |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|20,334,444,468,449,425,462,467,499,472,446,479,477,490,490,459,454,490,449,460,453,456,490,486,467,461,496,494,504,503,460,478,502,487,471,460,473,491,476,470,455,464,478,457,491,447,489,476,485,475,458,454,493,490,463,471,460,485,504,480,447,453,481,208" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|10,13,16,16,19,23,24,26,24,28,31,31,32,34,35,37,38,39,41,41,44,48,47,48,50,45,48,46,47,46,48,48,48,47,49,49,50,48,47,50,49,46,47,48,49,45,46,49,47,48,50,46,48,48,48,48,48,48,47,48,39,24" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|21,22,28,31,36,43,48,50,51,54,61,62,63,66,67,74,78,77,87,87,89,97,95,96,104,107,93,97,93,92,101,101,95,98,102,107,101,99,103,99,108,105,100,106,98,109,94,97,101,100,106,105,95,97,100,103,101,99,98,99,105,93,58,24" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.03,0.06,0.18,0.2,0.18,0.19,0.03|#4bc0c0$System|0.02,0.06,0.24,0.25,0.25,0.25,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.03,0.41,0.42,0.44,0.45,0.15,0.03|#4bc0c0$System|0.02,0.49,0.51,0.51,0.5,0.19,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

Database is the bottleneck again, java runtime is clearly sleeping here, while performing a magnitude better than PHP equivalent in this scenario. Fall behind FastAPI and NestJS, but still a good performance.

#### Spring Boot PgSQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value      |
| ------------------ | ---------- |
| Iteration rate     | **5**      |
| Total requests     | **169168** |
| Total iterations   | **109**    |
| Max req/s          | **2600**   |
| p(90) req duration | **38ms**   |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|19,819,1441,1883,2236,2093,2106,2245,2362,2424,2523,2343,2357,2525,2402,2395,2189,2040,2314,2479,2576,2316,2362,2550,2510,2307,2303,2373,2578,2535,2458,2431,2172,2463,2469,2423,2317,2349,2379,2461,2510,2289,2255,2336,2448,2466,2293,2274,2113,2251,2521,2480,2368,2485,2582,2450,2368,2385,2306,2510,2641,2351,2284,2590,2455,2231,2222,2224,2356,2393,1979,1722,1649,1794,1060" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|5,10,15,20,25,30,35,40,45,50,50,50,50,50,50,50,50,50,50,50,50,49,50,50,50,50,50,50,48,50,50,49,49,50,50,49,49,49,47,49,48,50,50,50,50,50,50,50,50,50,50,50,50,50,49,49,50,50,50,50,48,47,43,42,39,37,34,32,23,12,9,9,9,2" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|7,4,6,7,8,11,13,15,16,18,19,21,21,20,21,21,22,25,21,20,19,21,21,20,20,21,22,21,19,19,20,21,23,20,20,20,21,21,21,20,20,22,22,21,20,20,22,22,23,22,20,20,21,20,19,20,21,21,22,19,19,21,21,17,17,18,17,15,14,10,8,5,5,5,4" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.03,0.17,0.31,0.34,0.32,0.35,0.05|#4bc0c0$System|0.02,0.11,0.26,0.25,0.26,0.27,0.03|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.04,0.51,0.55,0.54,0.53,0.52,0.03|#4bc0c0$System|0.03,0.32,0.34,0.35,0.36,0.33,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

Java is maybe not the best DX experience for me, but it's a beast in terms of raw performance. Besides, we'll again have database bottleneck, which is the only case seen in this scenario on every framework tested ! Impossible to reach 100% java runtime CPU usage, even with 4 CPU cores, about only 60% overall...

### ASP.NET Core

#### ASP.NET Core PgSQL scenario 1

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value     |
| ------------------ | --------- |
| Iteration rate     | **20**    |
| Total requests     | **57936** |
| Total iterations   | **1136**  |
| Max req/s          | **980**   |
| p(90) req duration | **87ms**  |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|18,742,920,880,882,977,984,976,947,927,962,967,979,955,911,954,965,1005,957,918,904,986,973,974,892,969,973,988,917,900,973,975,972,953,928,963,997,975,971,884,954,977,950,965,923,942,976,968,972,885,959,960,974,948,890,952,973,986,953,914,973,947,102" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|13,20,24,28,34,36,37,38,43,43,47,50,47,48,49,49,46,48,48,47,48,47,47,45,50,48,44,49,49,48,47,48,44,47,48,47,46,48,48,48,45,46,45,47,48,47,47,49,49,45,49,46,46,43,50,42,44,44,50,48,20" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|12,14,18,26,30,33,34,37,39,44,45,48,48,48,52,50,49,45,49,52,52,48,50,45,53,50,49,46,50,55,50,47,48,49,50,49,46,47,49,53,51,47,47,48,50,51,49,48,49,53,49,49,48,48,50,51,44,43,47,51,50,33,9" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.03,0.03,0.43,0.46,0.46,0.46,0.11|#4bc0c0$System|0.01,0.01,0.18,0.2,0.21,0.2,0.05|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.03,0.04,0.78,0.76,0.76,0.76,0.03|#4bc0c0$System|0.02,0.02,0.21,0.24,0.23,0.22,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

ASP.NET Core is the final winner of 1st scenario. EF Core is incredibly efficient here.

#### ASP.NET Core PgSQL scenario 2

{{< tabs >}}
{{< tab tabName="Counters & Req/s" >}}

| Metric             | Value      |
| ------------------ | ---------- |
| Iteration rate     | **5**      |
| Total requests     | **167616** |
| Total iterations   | **108**    |
| Max req/s          | **2500**   |
| p(90) req duration | **38ms**   |

{{< chart type="timeseries" title="Req/s count" datasets="Req/s|205,1130,1622,1790,2011,2135,2024,2093,2463,2465,2428,2385,2144,2460,2503,2551,2337,2200,2404,2379,2452,2322,2252,2462,2449,2469,2306,2230,2488,2554,2466,2253,2180,2426,2445,2502,2349,2196,2476,2343,2538,2341,2166,2499,2412,2452,2259,2137,2439,2474,2461,2302,2113,2479,2374,2421,2369,2221,2462,2409,2332,2382,2216,2394,2478,2341,1644,1934,2134,2266,2070,1598,1417,1505,1518,710" />}}

{{< /tab >}}

{{< tab tabName="Req duration" >}}

{{< chart type="timeseries" title="VUs count" datasets="VUs|5,10,15,21,25,30,35,40,45,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,49,49,50,50,50,50,48,49,50,50,49,50,48,50,47,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,49,50,50,48,49,47,46,44,42,39,37,34,31,21,13,8,8,8,4" />}}

{{< chart type="timeseries" title="Request duration in ms" datasets="Duration (ms)|6,5,7,9,10,12,15,17,17,18,20,21,23,20,20,19,21,23,21,21,20,21,22,20,20,20,21,22,20,19,20,22,23,20,20,20,21,22,20,21,19,21,23,20,21,20,22,23,21,20,20,22,23,20,21,21,21,22,20,21,21,20,21,19,18,18,24,19,16,13,10,8,5,5,5,4" />}}

{{< /tab >}}
{{< tab tabName="CPU load" >}}

{{< chart type="timeseries" title="CPU runtime load" datasets="User|0.03,0.6,0.6,0.61,0.64,0.47,0.02|#4bc0c0$System|0.01,0.3,0.29,0.3,0.29,0.29,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< chart type="timeseries" title="CPU database load" datasets="User|0.2,0.55,0.54,0.53,0.53,0.15,0.03|#4bc0c0$System|0.14,0.34,0.34,0.34,0.34,0.09,0.02|#ff6384" stacked="true" max="1" step="15" />}}

{{< /tab >}}
{{< /tabs >}}

It's very close to Spring Boot, just a bit behind.

### Conclusion

Here are the final req/s results for each framework.

{{< chart type="timeseries" title="Req/s count" datasets="Laravel|1,38,40,137,150,211,216,255,247,269,285,299,294,291,295,322,322,327,308,314,329,329,341,324,318,336,341,344,328,329,349,347,353,329,333,352,360,351,339,330,355,359,353,328,340,355,348,355,340,334,356,347,356,346,337,347,358,353,336,341,347,347,350,328,345,355,351,351,349,341,354,351,353,340,343,343,353,362,336,333,353,344,362,338,335,353,353,355,339,320,304|#c2410c$Symfony|17,44,40,87,174,168,194,228,229,256,302,289,308,335,345,346,343,328,374,381,359,362,368,393,389,403,380,371,390,387,388,366,379,400,389,397,382,373,390,401,393,387,387,392,413,411,379,390,413,414,414,380,394,417,406,413,388,393,414,417,417,391,395,417,413,410,390,396,409,413,408,378,381,394,412,405,381,393,397,395,396,364,375,363,378,371,336,324,312,292,110|#ffffff$FastAPI|18,187,561,712,691,710,760,736,773,728,812,853,818,874,808,762,828,797,783,779,779,786,828,795,771,804,877,803,852,828,771,877,837,862,773,813,794,834,770,804,768,803,811,839,780,827,821,824,846,807,808,797,837,859,810,788,803,847,839,783,761,835,800,869,787,775,811,828,840,826,837,873,840,857,819,816,817,763,861,769,789,850,832,801,790,771,784,760,773,756,559|#0f766e$NestJS|17,369,682,787,878,1048,1104,1102,1083,1147,1171,1246,1276,1182,1200,1281,1233,1302,1247,1249,1320,1382,1386,1362,1382,1357,1379,1423,1259,1296,1340,1341,1394,1264,1328,1446,1365,1356,1258,1326,1324,1466,1372,1206,1287,1352,1449,1322,1248,1367,1332,1341,1305,1264,1284,1362,1343,1428,1274,1319,1393,1440,1434,1228,1223,1349,1356,1421,1278,1269,1158,1215,1239,1068,1151,1192,1152,1210,1083,1132,1165,1154,1193,1035,984,765,36|#b91c1c$Spring Boot|19,819,1441,1883,2236,2093,2106,2245,2362,2424,2523,2343,2357,2525,2402,2395,2189,2040,2314,2479,2576,2316,2362,2550,2510,2307,2303,2373,2578,2535,2458,2431,2172,2463,2469,2423,2317,2349,2379,2461,2510,2289,2255,2336,2448,2466,2293,2274,2113,2251,2521,2480,2368,2485,2582,2450,2368,2385,2306,2510,2641,2351,2284,2590,2455,2231,2222,2224,2356,2393,1979,1722,1649,1794,1060|#15803d$ASP.NET Core|205,1130,1622,1790,2011,2135,2024,2093,2463,2465,2428,2385,2144,2460,2503,2551,2337,2200,2404,2379,2452,2322,2252,2462,2449,2469,2306,2230,2488,2554,2466,2253,2180,2426,2445,2502,2349,2196,2476,2343,2538,2341,2166,2499,2412,2452,2259,2137,2439,2474,2461,2302,2113,2479,2374,2421,2369,2221,2462,2409,2332,2382,2216,2394,2478,2341,1644,1934,2134,2266,2070,1598,1417,1505,1518,710|#6d28d9" />}}

To resume, compiled languages have always a clear advantage when it comes to raw performance.
