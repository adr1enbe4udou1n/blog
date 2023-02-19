[`NestJS 9`](https://nestjs.com/) implementation under `NodeJS` using [`Typescript`](https://www.typescriptlang.org/) and [`pnpm`](https://pnpm.io/) as fast package manager. It relies by default on [`express`](https://github.com/expressjs/express) as NodeJS HTTP server implementation. NestJS offers a nice OpenAPI documentation generator thanks to Typescript which provides strong typing.

The separated ORM package take the best ideas from both known Doctrine and Eloquent PHP ORM :

* **DataMapper** pattern with POTO objects like Doctrine, with similar migrations generator.
* A **Model Factory** with seeder system for quick seeding dummy data inside database, with help of [Faker](https://github.com/faker-js/faker), as Laravel does.

Main packages involved :

* [MikroORM](https://mikro-orm.io/) on **latest v5** as `DataMapper` ORM that relies on Typescript, including migrations and seeders with as dummy data generator
* [ESLint](https://eslint.org/) with [Prettier](https://prettier.io/) for linting and code formatting
* [Jest](https://jestjs.io) as main test framework
