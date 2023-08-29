---
title: "Setup a HA Kubernetes cluster Part IX - Further deployment with DB"
date: 2023-10-09
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "postgresql", "efcore"]
draft: true
---

{{< lead >}}
Be free from AWS/Azure/GCP by building a production grade On-Premise Kubernetes cluster on cheap VPS provider, fully GitOps managed, and with complete CI/CD tools 🎉
{{< /lead >}}

This is the **Part IX** of more global topic tutorial. [Back to first part]({{< ref "/posts/10-build-your-own-kubernetes-cluster" >}}) for intro.

## Real DB App sample

Let's add some DB usage to our sample app. We'll use the classical `Articles<->Authors<->Comments` relationships. First create `docker-compose.yml` file in root of demo project:

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
```

{{< /highlight >}}

Launch it with `docker compose up -d` and check database running with `docker ps`.

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

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

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

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
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
    public required string Name { get; set; }

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
    "DefaultConnection": "Host=localhost;Username=main;Password=main;Database=main;"
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

We'll use Bogus on a separate console project:

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
    "DefaultConnection": "Host=localhost;Username=main;Password=main;Database=main;"
  }
}
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.Console/KubeRocks.Console.csproj" >}}

```xml
<Project Sdk="Microsoft.NET.Sdk">

    <!-- ... -->

  <PropertyGroup>
    <!-- ... -->
    <RunWorkingDirectory>$(MSBuildProjectDirectory)</RunWorkingDirectory>
  </PropertyGroup>

  <ItemGroup>
    <None Update="appsettings.json">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    </None>
  </ItemGroup>

</Project>
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.Console/Commands/DbCommand.cs" >}}

```cs
using Bogus;
using KubeRocks.Application.Contexts;
using KubeRocks.Application.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Respawn;
using Respawn.Graph;

namespace KubeRocks.Console.Commands;

[Command("db")]
public class DbCommand : ConsoleAppBase
{
    private readonly AppDbContext _context;

    public DbCommand(AppDbContext context)
    {
        _context = context;
    }

    [Command("migrate", "Migrate database")]
    public async Task Migrate()
    {
        await _context.Database.MigrateAsync();
    }

    [Command("fresh", "Wipe data")]
    public async Task FreshData()
    {
        await Migrate();

        using var conn = new NpgsqlConnection(_context.Database.GetConnectionString());

        await conn.OpenAsync();

        var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
        {
            TablesToIgnore = new Table[] { "__EFMigrationsHistory" },
            DbAdapter = DbAdapter.Postgres
        });

        await respawner.ResetAsync(conn);
    }

    [Command("seed", "Fake data")]
    public async Task SeedData()
    {
        await Migrate();
        await FreshData();

        var users = new Faker<User>()
            .RuleFor(m => m.Name, f => f.Person.FullName)
            .RuleFor(m => m.Email, f => f.Person.Email)
            .Generate(50);

        await _context.Users.AddRangeAsync(users);
        await _context.SaveChangesAsync();

        var articles = new Faker<Article>()
            .RuleFor(a => a.Title, f => f.Lorem.Sentence().TrimEnd('.'))
            .RuleFor(a => a.Description, f => f.Lorem.Paragraphs(1))
            .RuleFor(a => a.Body, f => f.Lorem.Paragraphs(5))
            .RuleFor(a => a.Author, f => f.PickRandom(users))
            .RuleFor(a => a.CreatedAt, f => f.Date.Recent(90).ToUniversalTime())
            .RuleFor(a => a.Slug, (f, a) => a.Title.Replace(" ", "-").ToLowerInvariant())
            .Generate(500)
            .Select(a =>
            {
                new Faker<Comment>()
                    .RuleFor(a => a.Body, f => f.Lorem.Paragraphs(2))
                    .RuleFor(a => a.Author, f => f.PickRandom(users))
                    .RuleFor(a => a.CreatedAt, f => f.Date.Recent(7).ToUniversalTime())
                    .Generate(new Faker().Random.Number(10))
                    .ForEach(c => a.Comments.Add(c));

                return a;
            });

        await _context.Articles.AddRangeAsync(articles);
        await _context.SaveChangesAsync();
    }
}
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.Console/Program.cs" >}}

```cs
using KubeRocks.Application.Extensions;
using KubeRocks.Console.Commands;

var builder = ConsoleApp.CreateBuilder(args);

builder.ConfigureServices((ctx, services) =>
{
    services.AddKubeRocksServices(ctx.Configuration);
});

var app = builder.Build();

app.AddSubCommands<DbCommand>();

app.Run();
```

{{< /highlight >}}

Then launch the command:

```sh
dotnet run --project src/KubeRocks.Console db seed
```

Ensure with your favorite DB client that data is correctly inserted.

### Define endpoint access

All that's left is to create the endpoint. Let's define all DTO first:

```sh
dotnet add src/KubeRocks.WebApi package Mapster
```

{{< highlight host="kuberocks-demo" file="src/KubeRocks.WebApi/Models/ArticleListDto.cs" >}}

```cs
namespace KubeRocks.WebApi.Models;

public class ArticleListDto
{
    public required string Title { get; set; }

    public required string Slug { get; set; }

    public required string Description { get; set; }

    public required string Body { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public required AuthorDto Author { get; set; }
}
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.WebApi/Models/ArticleDto.cs" >}}

```cs
namespace KubeRocks.WebApi.Models;

public class ArticleDto : ArticleListDto
{
    public List<CommentDto> Comments { get; set; } = new();
}
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.WebApi/Models/AuthorDto.cs" >}}

```cs
namespace KubeRocks.WebApi.Models;

public class AuthorDto
{
    public required string Name { get; set; }
}
```

{{< /highlight >}}

{{< highlight host="kuberocks-demo" file="src/KubeRocks.WebApi/Models/CommentDto.cs" >}}

```cs
namespace KubeRocks.WebApi.Models;

public class CommentDto
{
    public required string Body { get; set; }

    public DateTime CreatedAt { get; set; }

    public required AuthorDto Author { get; set; }
}
```

{{< /highlight >}}

And finally the controller:

{{< highlight host="kuberocks-demo" file="src/KubeRocks.WebApi/Controllers/ArticlesController.cs" >}}

```cs
using KubeRocks.Application.Contexts;
using KubeRocks.WebApi.Models;
using Mapster;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KubeRocks.WebApi.Controllers;

[ApiController]
[Route("[controller]")]
public class ArticlesController
{
    private readonly AppDbContext _context;

    public record ArticlesResponse(IEnumerable<ArticleListDto> Articles, int ArticlesCount);

    public ArticlesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet(Name = "GetArticles")]
    public async Task<ArticlesResponse> Get([FromQuery] int page = 1, [FromQuery] int size = 10)
    {
        var articles = await _context.Articles
            .OrderByDescending(a => a.Id)
            .Skip((page - 1) * size)
            .Take(size)
            .ProjectToType<ArticleListDto>()
            .ToListAsync();

        var articlesCount = await _context.Articles.CountAsync();

        return new ArticlesResponse(articles, articlesCount);
    }

    [HttpGet("{slug}", Name = "GetArticleBySlug")]
    public async Task<ActionResult<ArticleDto>> GetBySlug(string slug)
    {
        var article = await _context.Articles
            .Include(a => a.Author)
            .Include(a => a.Comments.OrderByDescending(c => c.Id))
            .ThenInclude(c => c.Author)
            .FirstOrDefaultAsync(a => a.Slug == slug);

        if (article is null)
        {
            return new NotFoundResult();
        }

        return article.Adapt<ArticleDto>();
    }
}
```

{{< /highlight >}}

Launch the app and check that `/Articles` and `/Articles/{slug}` endpoints are working as expected.

## Deployment with database

### Database connection

It's time to connect our app to the production database. Create a demo DB & user through pgAdmin and create the appropriate secret:

{{< highlight host="demo-kube-flux" file="clusters/demo/kuberocks/secrets-demo-db.yaml" >}}

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: demo-db
type: Opaque
data:
  password: ZGVtbw==
```

{{< /highlight >}}

Generate the according sealed secret like previously chapters with `kubeseal` under `sealed-secret-demo-db.yaml` file and delete `secret-demo-db.yaml`.

```sh
cat clusters/demo/kuberocks/secret-demo.yaml | kubeseal --format=yaml --cert=pub-sealed-secrets.pem > clusters/demo/kuberocks/sealed-secret-demo.yaml
rm clusters/demo/kuberocks/secret-demo.yaml
```

Let's inject the appropriate connection string as environment variable:

{{< highlight host="demo-kube-flux" file="clusters/demo/kuberocks/deploy-demo.yaml" >}}

```yaml
# ...
spec:
  # ...
  template:
    # ...
    spec:
      # ...
      containers:
        - name: api
          # ...
          env:
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: demo-db
                  key: password
            - name: ConnectionStrings__DefaultConnection
              value: Host=postgresql-primary.postgres;Username=demo;Password='$(DB_PASSWORD)';Database=demo;
#...
```

{{< /highlight >}}

### Database migration

The DB connection should be done, but the database isn't migrated yet, the easiest is to add a migration step directly in startup app:

{{< highlight host="kuberocks-demo" file="src/KubeRocks.WebApi/Program.cs" >}}

```cs
// ...
var app = builder.Build();

using var scope = app.Services.CreateScope();
await using var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
await dbContext.Database.MigrateAsync();

// ...
```

{{< /highlight >}}

The database should be migrated on first app launch on next deploy. Go to `https://demo.kube.rocks/Articles` to confirm all is ok. It should return next empty response:

```json
{
  articles: []
  articlesCount: 0
}
```

{{< alert >}}
Don't hesitate to abuse of `klo -n kuberocks deploy/demo` to debug any troubleshooting when pod is on error state.
{{< /alert >}}

### Database seeding

We'll try to seed the database directly from local. Change temporarily the connection string in `appsettings.json` to point to the production database:

{{< highlight host="kuberocks-demo" file="src/KubeRocks.Console/appsettings.json" >}}

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost:54321;Username=demo;Password='xxx';Database=demo;"
  }
}
```

{{< /highlight >}}

Then:

```sh
# forward the production database port to local
kpf svc/postgresql -n postgres 54321:tcp-postgresql
# launch the seeding command
dotnet run --project src/KubeRocks.Console db seed
```

{{< alert >}}
We may obviously never do this on real production database, but as it's only for seeding, it will never concern them.
{{< /alert >}}

Return to `https://demo.kube.rocks/Articles` to confirm articles are correctly returned.

## 8th check ✅

We now have a little more realistic app. Go [next part]({{< ref "/posts/19-build-your-own-kubernetes-cluster-part-10" >}}), we'll talk about further monitoring integration and tracing with OpenTelemetry.
