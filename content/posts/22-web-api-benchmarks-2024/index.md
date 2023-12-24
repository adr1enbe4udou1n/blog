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

The Swarm cluster is fully monitored with [Prometheus](https://prometheus.io/) and [Grafana](https://grafana.com/), allowing to get relevant performance result.

## The scenarios

We'll be using [k6](https://k6.io/) to run the tests, with [constant-arrival-rate executor](https://k6.io/docs/using-k6/scenarios/executors/constant-arrival-rate/) for progressive load testing, following 2 different scenarios :

- **Scenario 1** : fetch all articles, following the pagination
- **Scenario 2** : fetch all articles, calling each single article with slug, fetch associated comments for each article, and fetch profile of each related author

Duration of each scenario is 1 minute, with a 30 seconds graceful for finishing last started iterations.

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

To summary the expected SQL queries :

```sql

SELECT * FROM articles LIMIT 10 OFFSET 0;
SELECT * FROM users WHERE id IN ([articles.author_id...]);
SELECT count(*) FROM favorites WHERE article_id IN ([articles.id...]);
SELECT * FROM article_tag WHERE article_id IN ([articles.id...]);
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

### Laravel + MySQL scenario 1

| Metric           | Value    |
| ---------------- | -------- |
| Choosen rate     | **3**    |
| Total requests   | **8007** |
| Total iterations | **157**  |

{{< chart >}}
type: 'line',
options: {
  scales: {
    x: {
      ticks: {
        autoSkip: false,
        callback: function(val, index) {
          return val % 5 === 0 ? (this.getLabelForValue(val) + 's') : ''
        },
      }
    }
  },
},
data: {
  labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
  datasets: [{
    label: 'Req/s count',
    data: [6, 69, 81, 103, 103, 113, 83, 91, 103, 112, 99, 101, 109, 101, 106, 108, 100, 112, 117, 124, 113, 111, 117, 108, 129, 119, 124, 81, 113, 128, 124, 108, 108, 128, 111, 128, 123, 127, 100, 124, 124, 118, 119, 125, 121, 101, 96, 120, 110, 130, 137, 117, 127, 120, 124, 129, 127, 115, 121, 114, 126, 121, 103, 124, 120, 120, 116, 102, 122, 103, 109, 81],
    tension: 0.2
  }]
}
{{< /chart >}}

{{< chart >}}
type: 'line',
options: {
  scales: {
    x: {
      ticks: {
        autoSkip: false,
        callback: function(val, index) {
          return val % 5 === 0 ? (this.getLabelForValue(val) + 's') : ''
        },
      }
    }
  },
},
data: {
  labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
  datasets: [{
    label: 'VUs count',
    data: [3, 6, 8, 10, 12, 13, 14, 16, 19, 20, 23, 26, 25, 27, 28, 29, 31, 34, 35, 36, 37, 39, 41, 43, 45, 47, 48, 49, 49, 50, 49, 49, 48, 50, 49, 49, 49, 49, 49, 50, 49, 48, 48, 48, 49, 48, 50, 49, 48, 46, 48, 49, 48, 49, 48, 49, 47, 50, 49, 48, 46, 44, 42, 38, 36, 34, 33, 27, 18, 17, 4],
    tension: 0.2
  }]
}
{{< /chart >}}

{{< chart >}}
type: 'line',
options: {
  scales: {
    x: {
      ticks: {
        autoSkip: false,
        callback: function(val, index) {
          return val % 5 === 0 ? (this.getLabelForValue(val) + 's') : ''
        },
      }
    },
    y: {
      ticks: {
        autoSkip: false,
        callback: function(val, index) {
          return this.getLabelForValue(val) + 'ms'
        },
      }
    }
  },
},
data: {
  labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
  datasets: [{
    label: 'Request duration in ms',
    data: [36, 37, 71, 70, 93, 104, 145, 152, 157, 171, 186, 224, 224, 265, 223, 295, 256, 260, 323, 286, 309, 324, 322, 353, 365, 350, 409, 454, 475, 408, 400, 395, 495, 414, 421, 391, 415, 394, 458, 391, 422, 416, 414, 400, 382, 443, 440, 494, 433, 376, 372, 381, 401, 410, 384, 382, 393, 381, 454, 369, 402, 438, 393, 378, 319, 316, 307, 304, 254, 212, 151, 80],
    tension: 0.2
  }]
}
{{< /chart >}}

{{< chart >}}
type: 'line',
options: {
  scales: {
    y: {
        beginAtZero: true,
        suggestedMax: 1
    }
  },
},
data: {
  labels: [0, 15, 30, 45, 60, 75, 90],
  datasets: [{
    label: 'CPU runtime load',
    data: [0.02, 0.34, 0.37, 0.35, 0.38, 0.35, 0.02],
    tension: 0.2,
    fill: true,
  }]
}
{{< /chart >}}

{{< chart >}}
type: 'line',
options: {
  scales: {
    y: {
        beginAtZero: true,
        suggestedMax: 1
    }
  },
},
data: {
  labels: [0, 15, 30, 45, 60, 75, 90],
  datasets: [{
    label: 'CPU database load',
    data: [0.03, 0.89, 0.90, 0.90, 0.90, 0.52, 0.02],
    tension: 0.2,
    fill: true,
  }]
}
{{< /chart >}}

### Laravel + MySQL scenario 2

### Laravel + PostgreSQL scenario 1

### Laravel + PostgreSQL scenario 2

### Symfony + MySQL scenario 1

### Symfony + MySQL scenario 2

### Symfony + PostgreSQL scenario 1

### Symfony + PostgreSQL scenario 2

### FastAPI + PostgreSQL scenario 1

### FastAPI + PostgreSQL scenario 2

### NestJS + PostgreSQL scenario 1

### NestJS + PostgreSQL scenario 2

### Spring Boot + PostgreSQL scenario 1

### Spring Boot + PostgreSQL scenario 2

### ASP.NET Core + PostgreSQL scenario 1

### ASP.NET Core + PostgreSQL scenario 2
