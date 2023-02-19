Instead of using outdated [Bootstrap v4 alpha 2 theme](https://github.com/gothinkster/conduit-bootstrap-template), I rewrite it on [UnoCSS](https://github.com/unocss/unocss), an awesome efficient Tailwind-like utility-first CSS framework, with Dark Mode support.

For API communication, as we have full proper OpenAPI spec, it's a real benefit to have a generated Typescript client for full autocompletion feature. The well known [OpenAPI Generator](https://github.com/OpenAPITools/openapi-generator) is okay for this task but generate massive amount of code as it generates a complete client SDK.

Thankfully this [openapi-typescript](https://github.com/drwpow/openapi-typescript) package is a for more lightweight solution. It simply translates the OpenAPI spec to a simple Typescript file, with only types. No code generation involved ! In order to work, we need to use a specific **fetch** tool which will use all advanced features of Typescript 4 in order to guess type all the API with only a single TS file in runtime !

Common packages involved :

* [Vite](https://vitejs.dev/) as main bundler
* [ESLint](https://eslint.org/) with [Prettier](https://prettier.io/) for linting and code formatting
* [Iconify](https://github.com/iconify/iconify) as universal icons
* [TanStack Query](https://tanstack.com/query), compatible with `Vue` and `React` for nice API communication and powerful caching system
