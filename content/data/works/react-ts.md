[`React TS`](https://fr.reactjs.org/) implementation. It uses only pure function components thanks to [React Hooks](https://reactjs.org/docs/hooks-intro.html), which can be more or less related to `Vue 3 Composition API`.

It uses [React Context](https://beta.reactjs.org/reference/react/useContext) as minimalistic store system, without extra complexity from external libraries like [Redux](https://redux.js.org/) or [MobX](https://mobx.js.org).

Compared to `Vue` implementation, it seems less magical and more explicit, as it likes for `Symfony` VS `Laravel`. Don't require heavy Typescript IDE tooling like `Volar`, because it's just pure TS function components.

Finally, maybe thanks to `Typescript`, the DX between these 2 frameworks is far more similar than before. At the time of Vue 2 (Options API) and React <16.8 (class components), Vue was a totally different option than React. But now with `Composition API` and `React Hooks`, the gap is much smaller and is just a matter of taste, `JSX` vs `Vue template`, tooling, community, etc.
