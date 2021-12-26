`ASP.NET Core 6` implementation, follows `DDD` principle, implemented with `Hexa architecture` and `CQRS` pattern. Similar to the [official ASP.NET implementation](https://github.com/gothinkster/aspnetcore-realworld-example-app) but rewritten from scratch with further decoupling with dedicated project for each Hexa area, aka domain/application/infrastructure. Main packages involved :

* [EF Core](https://docs.microsoft.com/ef/) as strongly typed ORM
* [MediatR](https://github.com/jbogard/MediatR) for easy mediator implementation. It allows strong decoupling between all ASP.NET controllers and the final application which is cutted into small queries and commands
* [AutoMapper](https://automapper.org/) for minimal DTOs boilerplate
* [Fluent Validation](https://fluentvalidation.net/) for strongly typed validation
* [dotnet-format](https://github.com/dotnet/format) as official formatter
* [xUnit.net](https://xunit.net/) as framework test
* [Fluent Assertions](https://fluentassertions.com/) for strongly typed assertions within the API
* [Respawn](https://github.com/jbogard/Respawn) as for optimal integration tests isolation
* [Bogus](https://github.com/bchavez/Bogus) for strongly typed fake data generator
* [Bullseye](https://github.com/adamralph/bullseye) as a nice CLI publisher tool with dependency graph
