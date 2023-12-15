[`Spring Boot 3.2`](https://spring.io/projects/spring-boot) implementation using `Gradle 8` & `Java 21`. Similar to the [official Spring Boot implementation](https://github.com/gothinkster/spring-boot-realworld-example-app) but with usage of `Spring Data JPA` instead of `MyBatis`. [Here is another nice one](https://github.com/raeperd/realworld-springboot-java) that explicitly follows `DDD`.

Main packages involved :

* [springdoc-openapi](https://springdoc.org/) as API documentation generator
* [Java JWT](https://github.com/jwtk/jjwt) as JWT implementation
* [Spring Data JPA](https://spring.io/projects/spring-data-jpa/) with Hibernate as default JPA implementation
* [Flyway](https://flywaydb.org/) as proper migration tool based on SQL language as first party
* [Lombok](https://projectlombok.org/) for less boring POO encapsulation boilerplate
* `JUnit 5` with [REST Assured](https://rest-assured.io/) for fluent API assertions
* [Spotless Formatter](https://github.com/diffplug/spotless) with proper `Vs Code` integration
* [Java Faker](http://dius.github.io/java-faker/) as fake data generator
