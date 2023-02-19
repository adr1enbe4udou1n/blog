[`Vue 3 TS`](https://vuejs.org/) implementation written with Composition API. Main packages involved :

* [Pinia](https://pinia.vuejs.org/) as main store system
* [vue-tsc](https://github.com/johnsoncodehk/volar/tree/master/packages/vue-tsc) as main TS checker and compiler for Vue components, with full VS Code support with [Volar](https://github.com/johnsoncodehk/volar) plugin
* [VueUse](https://vueuse.org/) for many composition function helpers

Additional packages that reduce boilerplate and improve DX :

* [unplugin-auto-import](https://github.com/antfu/unplugin-auto-import) and [unplugin-vue-components](https://github.com/antfu/unplugin-vue-components) for reactivity functions and components auto import, while preserving TS support
* [vite-plugin-pages](https://github.com/hannoeru/vite-plugin-pages) and [vite-plugin-vue-layouts](https://github.com/JohnCampionJr/vite-plugin-vue-layouts) for file-based route system with layout support, preventing us maintenance of separated route file, which made the DX similar to [Nuxt](https://nuxtjs.org/)
