# @kmamal/three

Fork of [three.js](https://github.com/mrdoob/three.js) that can render to real windows using [`@kmamal/sdl`](https://github.com/kmamal/node-sdl#readme), [`@kmamal/gl`](https://github.com/kmamal/headless-gl#readme) (WebGL2) and [`@kmamal/gpu`](https://github.com/kmamal/gpu#readme) (WebGPU).

## Installing

Install the fork and the packages for the renderers you use:

```json
{
  "dependencies": {
    "@kmamal/three": "*",
    "@kmamal/sdl": "*",
    "@kmamal/gl": "*",
    "@kmamal/gpu": "*"
  }
}
```

You only need `@kmamal/gl` for `WebGLRenderer` and `@kmamal/gpu` for WebGPU.

## Usage

Pass the SDL window to the renderer instead of a canvas.

```js
import sdl from '@kmamal/sdl'
import * as THREE from '@kmamal/three/webgpu'

const window = sdl.video.createWindow({ title: "Hello, Three!", webgpu: true, resizable: true })

const renderer = new THREE.WebGPURenderer({ window })
await renderer.init()
renderer.setClearColor(0xff0000)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera()

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera)
})

window.on('close', () => {
  renderer.dispose()
})
```

For `WebGLRenderer`, create the window with `opengl: true` and import from `'@kmamal/three'`.
`WebGPURenderer` also works with `forceWebGL: true` on an `opengl: true` window.

* `render()` presents the frame by itself. There is no `swap()` to call.
* Resizing is up to you, as in a browser: call `renderer.setSize(window.pixelWidth, window.pixelHeight, false)` and update the camera aspect from the window's `resize` event.
* `renderer.dispose()` does not destroy the window.
* `antialias: true` works on both renderers.

## Input

`renderer.domElement` is an object with the parts of the DOM that three.js addons use: `addEventListener`, `getBoundingClientRect()`, `clientWidth`, `ownerDocument`, `setPointerCapture()` and so on.
SDL mouse, wheel and keyboard events arrive as `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `wheel`, `keydown` and `keyup`, followed by the compatibility events a browser sends: `mousedown`, `mousemove`, `mouseup`, `click`, `dblclick`, `auxclick` and `contextmenu` (canceling `pointerdown` suppresses the `mouse*` ones, as in a browser).
Each event is a single object dispatched to the canvas, then `ownerDocument`, then `ownerDocument.defaultView`; `target` stays the canvas and `stopPropagation()` ends the walk.
`key` comes from the keyboard layout and `code` from the physical key (the SDL scancode), so `KeyW` is the same key on every layout.

`requestPointerLock()` on the canvas or on `document.body` turns on the window's relative mouse mode and sets `document.pointerLockElement`; pointer events then target the locked element and carry `movementX`/`movementY`. `document.exitPointerLock()`, Escape and losing focus release it, and `pointerlockchange` fires on the document each time.

Touch input arrives as single-pointer mouse events.
SDL captures the mouse while a button is held, so a drag that leaves the window keeps delivering `pointermove` events (with coordinates outside the window) and ends with a `pointerup`. `setPointerCapture()` itself is a no-op.

## Loading assets

* Images are decoded with [`sharp`](https://sharp.pixelplumbing.com/), so `TextureLoader`, `ImageLoader`, `CubeTextureLoader` and `GLTFLoader` read PNG, JPEG, WebP, GIF, TIFF, SVG and HEIF from `http(s):`, `file:`, `data:` and `blob:` URLs, and from plain file paths relative to the current directory.
* `FileLoader` reads local files too.
* `ImageBitmapLoader` works and `GLTFLoader` uses it. Bitmaps are decoded by `sharp` and honor `imageOrientation: 'flipY'` and `premultiplyAlpha: 'premultiply'`; `platform.createImageBitmap` and `platform.isImageBitmap` are the hooks.
* `platform.setFetchRoot(dir)` makes `platform.fetch` resolve paths starting with `/`, such as `/models/a.glb`, under `dir`, like a web server root. The real absolute path is not tried while a root is set. `file:` URLs and relative paths are unaffected. `platform.setFetchRoot(null)` turns this off again.

## 2D canvas

`document.createElement('canvas')` and `new OffscreenCanvas()` are available through the platform, backed by [`@napi-rs/canvas`](https://github.com/Brooooooklyn/canvas) (Skia).
Use `createCanvasElement()` or `platform.createElement('canvas')` to create one, and `platform.OffscreenCanvas` and `platform.ImageData` for the other classes.

* `CanvasTexture` works on all renderers, including text drawn with `fillText()`, alpha, and redrawing with `needsUpdate`.
* Text uses the system fonts that Skia finds. Register more with `GlobalFonts` from `@napi-rs/canvas`.

## How it works

`src/platform/Platform.js` is a registry of everything three.js used to take from browser globals: `requestAnimationFrame`, `navigator.gpu`, `fetch`, presenting a frame, canvas and element creation and the browser classes (`platform.Image`, `ImageBitmap`, `OffscreenCanvas`, `ImageData`, `DOMParser`, `ProgressEvent`). Ported code replaces a global with the same name on `platform`, for example `new DOMParser()` becomes `new platform.DOMParser()` and `window.innerWidth` becomes `platform.window.innerWidth`. The `GPUBufferUsage`, `GPUTextureUsage` and `GPUMapMode` constants are plain numbers in `WebGPUConstants.js`, so importing the WebGPU renderer does not load `@kmamal/gpu` until it is used.
There is no browser implementation: `platform` is backed by `src/platform/sdl/`, which provides an `SDLCanvas`, the event bridge, image decoding and a `fetch` for local files. `setPlatform()` can still override individual hooks, for example to stub them in tests. The package entry points (`@kmamal/three`, `@kmamal/three/webgpu`, `@kmamal/three/tsl`) resolve straight to `src/`, so addons that import `'@kmamal/three'` always share this one instance.

## Limitations

* The window surface for `WebGPURenderer` is `bgra8unorm`, like a browser canvas.
