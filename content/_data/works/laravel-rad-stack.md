A heavily customized `Laravel 8` boilerplate starter-kit with complete BO solution, with posts management as main demo feature. On frontend/assets side it's relies on last technologies, i.e. `pnpm` + `Vue 3` + `Typescript` with nice [template setup](https://v3.vuejs.org/api/sfc-script-setup.html) as default syntactic sugar, and finally `WindiCSS` as CSS utility framework. You can easily ditch WindiCSS for `Tailwind` if you prefer, as it's almost the same API.

The BO dev API is similar to my last `Vuetify Admin` project but rewritten in more customizable components. You have complete **DataTable** with pagination, sorts, global search, filters, Excel export, customizable row actions with nice Dev-side API. It has a nice **BaseForm** which reduces forms code boilerplate, with a few supported form inputs (you can easily create your own). It's also support direct right-aside editing with proper URL context (see users management on demo). All BO relies on [Inertia](https://inertiajs.com/) for minimal API glue boilerplate.

This project has full covered test suite written in [`Pest`](https://pestphp.com/) and uses the most known Dev tools for proper QA assurance as :

* `Larastan` as static analyszer,
* `PHP CS Fixer` as code formatter
* `Laravel IDE Helper` for proper IDE integration
* `Clockwork` for debugging (notably N+1 SQL problems)
* `PHPUnit Watcher` for full `TDD` experience
* Perfect `VS Code` integration with recommended plugins
* `Docker` support
