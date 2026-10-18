## Setup

- Execute `npm install` from the root folder.

## Run

The unit tests run using [QUnit](https://qunitjs.com/).

- `npm run test-unit` runs the tests for `src/`.
- `npm run test-unit-addons` runs the tests for `examples/jsm/` that don't need a GPU.
- `npm run test-unit-gpu` runs the TSL tests that execute shaders, on `WebGPURenderer` with WebGPU and with the WebGL2 fallback. Each backend renders into a hidden SDL window, so a display and a GPU are needed.

`test/unit/setup.mjs` is loaded before the tests. It makes `fetch` read local files, resolving paths starting with `/` from the repository root. The `@kmamal/three` imports resolve to `src/` through the package's own `exports`.

To run a single file, pass it to QUnit directly:

```shell
npx qunit --require ./test/unit/setup.mjs test/unit/src/math/Vector3.tests.js
```

## Layout

- `three.source.unit.js` imports all the tests for `src/`.
- `three.addons.node.unit.js` imports the addon tests that run in Node.
- `three.addons.gpu.unit.js` imports the TSL tests under `addons/tsl/` that use `gpu-test-utils.js`.
- `utils/` has the custom QUnit assertions and the console wrapper.

