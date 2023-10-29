[`NestJS 9`](https://nestjs.com/) implementation under `Node.js 20` using [`Typescript 5`](https://www.typescriptlang.org/) and [`pnpm`](https://pnpm.io/) as fast package manager. It relies by default on [`express`](https://github.com/expressjs/express) as NodeJS HTTP server implementation. NestJS offers a nice OpenAPI documentation generator thanks to Typescript which provides strong typing.

Main packages involved :

* [Prisma 5](https://www.prisma.io/) as ORM entirely built up for Typescript. Include migrations, models generator based on specific schema specification
* [Faker](https://fakerjs.dev/) for generating seeders
* [ESLint](https://eslint.org/) with [Prettier](https://prettier.io/) for linting and code formatting
* [Jest](https://jestjs.io) as main test framework
