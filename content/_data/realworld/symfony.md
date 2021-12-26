[`Symfony 5.4`](https://symfony.com/) implementation on `PHP 8.1` with usage of [API Platform](https://api-platform.com/), a very powerful API crud generator that supports PHP 8 attributes. This project tries to be the most "API Platform" way to do it, with usage of [Data providers](https://api-platform.com/docs/core/data-providers/), [Data persiters](https://api-platform.com/docs/core/data-persisters/), [DTOs](https://api-platform.com/docs/core/dto/), simple action controllers with only one `__invoke` known as `ADR` pattern.

It was for me the less pleasant experience of all project, as I spent most of the time to fight against the tool instead of really develop the app, but it was the main purpose of this project, as I have already known the classical way to do it. `API Platform` is certainly a very powerful and flexible beast, but with some nasty caveats. It was nevertheless very instructive.

Main packages involved :

* [API Platform](https://api-platform.com/) as main API framework superset for symfony
* [Doctrine](https://www.doctrine-project.org/) as `DataMapper` ORM
* [Symfony JWT Bundle](https://github.com/lexik/LexikJWTAuthenticationBundle) implementation
* [Alice](https://github.com/nelmio/alice) as fixtures generator that relies on [PHP Faker](https://fakerphp.github.io/)
* [PHP CS Fixer](https://github.com/FriendsOfPHP/PHP-CS-Fixer) as formatter
* [PHPStan](https://phpstan.org/), as advanced code static analyzer
* [PHPUnit](https://phpunit.de/) as test framework
