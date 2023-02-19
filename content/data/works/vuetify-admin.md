My most personal open-source 2020 *Mammoth* project. It's a full admin framework similar as [React Admin](https://marmelab.com/react-admin/) but for `VueJS 2` and using `Vuetify 2` as material frontend framework.

It's a complete frontend project mainly written in `Javascript`, with multiple usable [NPM packages](https://www.npmjs.com/package/vuetify-admin), a backend [Laravel bridge](https://github.com/okami101/laravel-admin), all inside a mono-repo managed by [Lerna](https://lerna.js.org/). A [Vue CLI plugin](https://www.npmjs.com/package/vue-cli-plugin-vuetify-admin) was also created for quick starting.

I put many efforts into writing [a complete documentation](https://www.okami101.io/vuetify-admin) on [VuePress](https://vuepress.vuejs.org/), with [complete tutorials](https://www.okami101.io/vuetify-admin/guide/tutorial.html), including integration within [Laravel](https://www.okami101.io/vuetify-admin/guide/laravel.html) and [Symfony API Platform](https://www.okami101.io/vuetify-admin/guide/api-platform.html). This documentation has clearly represented not far from **80%** of all work ! It also has [many samples](https://github.com/okami101/vuetify-admin/tree/master/examples) and [a complete demo](https://va-demo.okami101.io/).

But I had to decide to stop this project after a couple of months because multiple reasons :

* Less time available
* Too much effort to maintain and evolve it
* Not written on `Typescript` that allows proper refactoring
* No unit tests from the beginning, what has proved to be **HUGE** mistake
* `Vite`, `Vue 3` with real `Typescript` support and `Vuetify 3` are in the corner, which necessitates full rewrite and new *next* repo

Nevertheless, it was a very instructive project that shows me the **real amount work for a good documentation** and the **cost of missing proper unit/integration/e2e tests**.
