[`Vue 3 TS`](https://vuejs.org/) implementation written with Composition API. Instead of using outdated [Bootstrap v4 alpha 2 theme](https://github.com/gothinkster/conduit-bootstrap-template), I rewrite it on [UnoCSS](https://github.com/unocss/unocss), an awesome efficient Tailwind-like utility-first CSS framework, with Dark Mode support.

For API communication, as we have full proper OpenAPI spec, it's a real benefit to have a generated Typescript client for full autocompletion feature. I generally hate generated boilerplate code and the well known [OpenAPI Generator](https://github.com/OpenAPITools/openapi-generator) is not very nice to use.

Thankfully this [openapi-typescript](https://github.com/drwpow/openapi-typescript) package was the perfect solution. It simply translates the OpenAPI spec to a simple Typescript file, with only types. No code generation involved ! In order to work, we need to use a specific **fetch** tool which will use all advanced features of Typescript 4 in order to guess type all the API with only a single TS file in runtime !

Main packages involved :

* [Vite](https://vitejs.dev/) as main bundler
* [vue-tsc](https://github.com/johnsoncodehk/volar/tree/master/packages/vue-tsc) as main TS checker and compiler for Vue components, with full VS Code support with [Volar](https://github.com/johnsoncodehk/volar) plugin
* [ESLint](https://eslint.org/) with [Prettier](https://prettier.io/) for linting and code formatting
* [UnoCSS](https://github.com/unocss/unocss) as utility-first CSS framework
* [Iconify](https://github.com/iconify/iconify) as universal icons
* [Pinia](https://pinia.vuejs.org/) as main store system
* [VueUse](https://vueuse.org/) for many composition function helpers
* [unplugin-auto-import](https://github.com/antfu/unplugin-auto-import) and [unplugin-vue-components](https://github.com/antfu/unplugin-vue-components) for vue 3 reactivity functions and components auto import, while preserving TS support
* [vite-plugin-pages](https://github.com/hannoeru/vite-plugin-pages) and [vite-plugin-vue-layouts](https://github.com/JohnCampionJr/vite-plugin-vue-layouts) for file-based route system with layout support, preventing us maintenance of separated route file, which made the DX similar to [Nuxt](https://nuxtjs.org/)
* [openapi-typescript](https://github.com/drwpow/openapi-typescript) as advanced minimal client-side OpenAPI generator which use advanced Typescript features for autodiscovering all API types without any boilerplate code thanks to [separated fetcher](https://github.com/ajaishankar/openapi-typescript-fetch)
