# @kmamal/three

Fork of [three.js](https://github.com/mrdoob/three.js), published as `@kmamal/three`.

Import from `'@kmamal/three'`, `'@kmamal/three/webgpu'`, `'@kmamal/three/tsl'` and `'@kmamal/three/addons/...'` where you would import from `'three'`. The entry points resolve straight to `src/`; there is no build step.

Examples that use npm packages which import `three` rely on `node_modules/three` being `utils/three-alias`, a package named `three` whose files are this package's, so both names load the same modules.
