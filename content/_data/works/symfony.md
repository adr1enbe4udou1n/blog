[`Symfony 6.0`](https://symfony.com/) implementation on `PHP 8.1` that supports PHP 8 attributes. I excluded the usage of [API Platform](https://api-platform.com/) here, which is a very powerful API crud generator but really not well suited for real customized API in my taste.

Contrary to Laravel, the usage of **DataMapper** pattern ORM involve classic POPO models. The additional usage of plain PHP DTO classes facilitates the OpenAPI spec models generation without writing all schemas by hand. On the downside the Nelmio package is far more verbose than the Laravel OpenAPI version.

Main packages involved :

* [Doctrine](https://www.doctrine-project.org/) as **DataMapper** ORM
* [SensioFrameworkExtraBundle](https://github.com/sensiolabs/SensioFrameworkExtraBundle) for ParamConverter helper with Doctrine
* [FOSRestBundle](https://github.com/FriendsOfSymfony/FOSRestBundle) only for some helpers as DTO automatic converters and validation
* [NelmioApiDocBundle](https://github.com/nelmio/NelmioApiDocBundle) as **OpenAPI** generator
* [Symfony JWT Bundle](https://github.com/lexik/LexikJWTAuthenticationBundle) implementation
* [Alice](https://github.com/nelmio/alice) as fixtures generator that relies on [PHP Faker](https://fakerphp.github.io/)
* [PHP CS Fixer](https://github.com/FriendsOfPHP/PHP-CS-Fixer) as formatter
* [PHPStan](https://phpstan.org/), as advanced code static analyzer
* [PHPUnit](https://phpunit.de/) as test framework
