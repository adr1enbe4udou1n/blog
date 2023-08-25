---
title: "Setup a HA Kubernetes cluster Part VIII - QA & code metrics with SonarQube"
date: 2023-10-08
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "testing", "sonarqube"]
draft: true
---

{{< lead >}}
Be free from AWS/Azure/GCP by building a production grade On-Premise Kubernetes cluster on cheap VPS provider, fully GitOps managed, and with complete CI/CD tools 🎉
{{< /lead >}}

This is the **Part VIII** of more global topic tutorial. [Back to first part]({{< ref "/posts/10-build-your-own-kubernetes-cluster" >}}) for intro.

## Real DB App sample

Before go any further, let's add some DB usage to our sample app. We'll use the classical `Articles<->Authors<->Comments` relationships. First create `docker-compose.yml` file in root of demo project:

{{< highlight host="kuberocks-demo" file="docker-compose.yml" >}}

```yaml
version: "3"

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: main
      POSTGRES_PASSWORD: main
      POSTGRES_DB: main
    ports:
      - 5432:5432

  db_test:
    image: postgres:15
    environment:
      POSTGRES_USER: main
      POSTGRES_PASSWORD: main
      POSTGRES_DB: main
    ports:
      - 54320:5432
```

{{< /highlight >}}

Here we create 2 PostgreSQL instances, one for local development and one for integration testing. Launch them with `docker compose up -d` and check they are both running with `docker ps`.

Time to create basic code that list plenty of articles from an API endpoint. Go back to `kuberocks-demo` and create a new separate project dedicated to app logic:

```sh
dotnet new classlib -o src/KubeRocks.Application
dotnet sln add src/KubeRocks.Application
dotnet add src/KubeRocks.WebApi reference src/KubeRocks.Application

dotnet add src/KubeRocks.Application package Microsoft.EntityFrameworkCore
dotnet add src/KubeRocks.Application package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add src/KubeRocks.WebApi package Microsoft.EntityFrameworkCore.Design
```

{{< alert >}}
This is not a DDD course ! We will keep it simple and focus on Kubernetes part.
{{< /alert >}}

### Define the entities

{{< highlight host="kuberocks-demo" file="src/KubeRocks.Application/Entities/Article.cs" >}}

```cs
using System.ComponentModel.DataAnnotations;

namespace KubeRocks.Application.Entities;

public class Article
{
    public int Id { get; set; }

    public required User Author { get; set; }

    [MaxLength(255)]
    public required string Title { get; set; }
    [MaxLength(255)]
    public required string Slug { get; set; }
    public required string Description { get; set; }
    public required string Body { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<Comment> Comments { get; } = new List<Comment>();
}
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.Application/Entities/Comment.cs" >}}

```cs
namespace KubeRocks.Application.Entities;

public class Comment
{
    public int Id { get; set; }

    public required Article Article { get; set; }
    public required User Author { get; set; }

    public required string Body { get; set; }

    public DateTime CreatedAt { get; set; }
}
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.Application/Entities/User.cs" >}}

```cs
using System.ComponentModel.DataAnnotations;

namespace KubeRocks.Application.Entities;

public class User
{
    public int Id { get; set; }

    [MaxLength(255)]
    public required string Username { get; set; }

    [MaxLength(255)]
    public required string Email { get; set; }

    public ICollection<Article> Articles { get; } = new List<Article>();
    public ICollection<Comment> Comments { get; } = new List<Comment>();
}
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.Application/Contexts/AppDbContext.cs" >}}

```cs
namespace KubeRocks.Application.Contexts;

using KubeRocks.Application.Entities;
using Microsoft.EntityFrameworkCore;

public class AppDbContext : DbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Article> Articles => Set<Article>();
    public DbSet<Comment> Comments => Set<Comment>();

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email).IsUnique()
        ;

        modelBuilder.Entity<Article>()
            .HasIndex(u => u.Slug).IsUnique()
        ;
    }
}
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.Application/Extensions/ServiceExtensions.cs" >}}

```cs
using KubeRocks.Application.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace KubeRocks.Application.Extensions;

public static class ServiceExtensions
{
    public static IServiceCollection AddKubeRocksServices(this IServiceCollection services, IConfiguration configuration)
    {
        return services.AddDbContext<AppDbContext>((options) =>
        {
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection"));
        });
    }
}
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.WebApi/Program.cs" >}}

```cs
using KubeRocks.Application.Extensions;

//...

// Add services to the container.
builder.Services.AddKubeRocksServices(builder.Configuration);

//...
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.WebApi/appsettings.Development.json" >}}

```json
{
  //...
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Port=5432;User Id=main;Password=main;Database=main;"
  }
}
```

{{< /highlight >}}

Now as all models are created, we can generate migrations and update database accordingly:

```sh
dotnet new tool-manifest
dotnet tool install dotnet-ef

dotnet dotnet-ef -p src/KubeRocks.Application -s src/KubeRocks.WebApi migrations add InitialCreate
dotnet dotnet-ef -p src/KubeRocks.Application -s src/KubeRocks.WebApi database update
```

### Inject some dummy data

```sh
dotnet new console -o src/KubeRocks.Console
dotnet sln add src/KubeRocks.Console
dotnet add src/KubeRocks.WebApi reference src/KubeRocks.Application
dotnet add src/KubeRocks.Console package Bogus
dotnet add src/KubeRocks.Console package ConsoleAppFramework
dotnet add src/KubeRocks.Console package Respawn
```

{{< highlight host="kuberocks-demo" file="src/KubeRocks.Console/appsettings.json" >}}

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Port=5432;User Id=main;Password=main;Database=main;"
  }
}
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.Console/Commands/SeederCommand" >}}

```cs

```

{{< /highlight >}}

### Define endpoint access

## Production grade deployment

### Liveness & readiness

(liveness, readiness, resource limits, logging)

## Unit & integration Testing

### xUnit

### CI configuration

## Code Metrics

### SonarQube installation

### Project configuration

### Code Coverage

## 7th check ✅

We have everything we need for app building with automatic deployment ! Go [next part]({{< ref "/posts/18-build-your-own-kubernetes-cluster-part-9" >}}) for advanced tracing / load testing !
