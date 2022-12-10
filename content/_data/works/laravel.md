[`Laravel 9`](https://laravel.com/) implementation on `PHP 8.2` with extensive usage of last attributes support. The particularity of this framework is to give you almost of all you need for quickly develop any complex application. So minimal external packages need.

I obviously made usage of **Eloquent** as a very expressive **Active Record** ORM, and the Laravel factories system based on [PHP Faker](https://fakerphp.github.io/) is already perfect for dummy data generator.

Contrary to most others projects, there is no usage of DTO classes, so it's required to write all schema declarations for proper OpenAPI models generation.

Main packages involved :

* [PHP JWT](https://github.com/lcobucci/jwt) as JWT implementation, with proper integration to Laravel using custom guard
* [Laravel Routes Attribute](https://github.com/spatie/laravel-route-attributes) for Laravel routing that leverage on last PHP 8 attributes feature
* [Laravel OpenAPI](https://github.com/vyuldashev/laravel-openapi) that also use PHP 8 attributes for API documentation
* [Laravel IDE Helper](https://github.com/barryvdh/laravel-ide-helper) for proper IDE integration, perfectly suited for **VS Code** with [Intelephense](https://marketplace.visualstudio.com/items?itemName=bmewburn.vscode-intelephense-client) extension
* [PHP CS Fixer](https://github.com/FriendsOfPHP/PHP-CS-Fixer) as formatter with Laravel style guide
* [Larastan](https://github.com/nunomaduro/larastan), a Laravel wrapper of [PHPStan](https://phpstan.org/), as advanced code static analyzer
* [Pest](https://pestphp.com/) as nice Jest-like API superset of existing PHPUnit
