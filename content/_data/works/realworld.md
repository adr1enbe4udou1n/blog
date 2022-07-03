Main purpose of this projects is to have personal extensive API training on multiple backend languages or framework. It's following the very known [Conduit project](https://github.com/gothinkster/realworld), a `Medium` clone. Each project respect following conditions :

* `VS Code` as only main editor !
* 100% compatible by the official [OpenAPI Spec](https://realworld-docs.netlify.app/docs/specs/backend-specs/endpoints)
* Proper OpenAPI documentation
* Testable with [last Postman collection of Conduit](https://github.com/gothinkster/realworld/tree/main/api)
* Fully tested
* High QA by following best practices for linting, formatting, with static analyzers for non strongly typed languages
* Community-driven with usage of the most well-known packages
* `PostgreSQL` as main databases
* Use ORM whenever possible that follows any `DataMapper` or `Active Record` patterns
* Proper seeder / faker for quick starting with filled DB
* Proper suited QA + production Dockerfile
* Complete CI/CD deployment on Kubernetes with [Concourse](https://concourse.okami101.io/)
