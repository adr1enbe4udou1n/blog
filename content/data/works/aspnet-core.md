[`ASP.NET Core 8`](https://docs.microsoft.com/aspnet/core/) implementation, using minimal APIs, mature since 8.0, following `DDD` principle, implemented with `Hexa architecture` and `CQRS` pattern. [Swashbuckle](https://github.com/domaindrivendev/Swashbuckle.AspNetCore) is used as default main OpenAPI generator.

Main packages involved :

* [Carter](https://github.com/CarterCommunity/Carter/) for seamless endpoints grouping
* [EF Core](https://docs.microsoft.com/ef/) as strongly typed ORM
* [MediatR](https://github.com/jbogard/MediatR) for easy mediator implementation. It allows strong decoupling between all ASP.NET controllers and the final application which is cutted into small queries and commands
* [Fluent Validation](https://fluentvalidation.net/) for strongly typed validation
* [dotnet-format](https://github.com/dotnet/format) as official formatter
* [xUnit.net](https://xunit.net/) as framework test
* [Bogus](https://github.com/bchavez/Bogus) for strongly typed fake data generator
* [Bullseye](https://github.com/adamralph/bullseye) as a nice CLI publisher tool with dependency graph
