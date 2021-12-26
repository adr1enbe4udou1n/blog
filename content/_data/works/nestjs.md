[`NestJS 8`](https://nestjs.com/) implementation under `NodeJS 16` using [`Typescript`](https://www.typescriptlang.org/) and [`pnpm`](https://pnpm.io/) as fast package manager.

It can rely on [`fastify`](https://www.fastify.io/) as modern NodeJS HTTP server implementation. NestJS offers a nice OpenAPI documentation generator thanks to Typescript which provides strong typing.

Main packages involved :

* [MikroORM](https://mikro-orm.io/) as `DataMapper` ORM that relies on Typescript, including migrations
* [faker.js](https://github.com/marak/Faker.js/) as dummy data generator
* [ESLint](https://eslint.org/) with [Prettier](https://prettier.io/) for linting and code formatting
* [Jest](https://jestjs.io) as main test framework
