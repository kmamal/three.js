# End-to-end tests

Every ported example in `examples/*.mjs` is run in an SDL window and its first frames are compared against the browser screenshot in `examples/screenshots`.

```shell
npm run test-e2e                                     # every example not listed in exceptions.json
npm run test-e2e -- webgl_animation_keyframes ...    # just these examples, even if they are listed
npm run test-e2e -- --exceptions                     # only the listed ones, reporting those that pass now
npm run test-e2e -- --resume                         # skip the examples that passed in the previous run
```

Other flags: `--bail` stops at the first failure, `--webgpu` keeps only the `webgpu_` examples, `--shard=i/n` runs one part of the list, `--max-diff=<percent>`, `--threshold=<0..1>` and `--timeout=<seconds>` tune the comparison.

## How it works

* `run.js` starts each example as a child process with `--import inject.js`.
* `inject.js` makes the run deterministic (seeded `Math.random`, `Date.now` and `performance.now` frozen at 0, see also `hooks.js`), opens the first window at 800x500, and drives `requestAnimationFrame` itself: it waits until loading has settled (`track.js` watches `fetch` and file reads), runs frames until one is presented, and then reads that frame back from the renderer (`readPixels` for `WebGLRenderer`, a texture copy for `WebGPURenderer`) into a PNG.
* Uncaught exceptions, unhandled rejections, `console.error` and Dawn validation messages fail the example.
* `run.js` downscales the frame to 400x250 and compares it with `image.js`. Failures leave the actual, expected and diff images in `output/`.
* `exceptions.json` lists the examples that are not expected to match, grouped by reason. `tolerances.json` raises the allowed percentage of different pixels for individual examples (the default is 1%).
