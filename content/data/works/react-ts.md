[`React TS`](https://fr.reactjs.org/) implementation. It uses only pure function components thanks to [React Hooks](https://reactjs.org/docs/hooks-intro.html), which can be more or less related to `Vue 3 Composition API`.

It uses [React Context](https://beta.reactjs.org/reference/react/useContext) as minimalistic store system, without extra complexity from external libraries like [Redux](https://redux.js.org/) or [MobX](https://mobx.js.org).

Additional packages :

* [Generouted](https://github.com/oedotme/generouted), file based routing system with layout support, compatible with Vite

Compared to `Vue` implementation, it seems a bit less magical and more explicit, as it likes for `Symfony` VS `Laravel`. Don't require heavy Typescript IDE tooling like `Volar`, because it's just pure TS function components.
