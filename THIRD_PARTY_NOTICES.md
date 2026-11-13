# Third-party notices

BetterClassifier is distributed under the MIT license. The complete license and copyright notices are in LICENSE.

The presentation adapters in `src/client/compat/` are derived from DeepSeek Harness 0.2.2-rc.2, commit `e8f7b93a344964de3dca1ace9e72b6e4d6de87cb`, copyright 2026 DeepSeek, MIT licensed: https://github.com/deepseek-ai/deepseek-harness.

Changes include plugin-owned child-slot and row-factory names, direct classification/tag rendering, a plugin-scoped list layout, and a lifecycle adapter that shares the native registration's injected actions and viewing store. Native files and installed host packages are never rewritten. The supported host version is pinned because these exported UI shares are pre-stable.

The module-loader wrapper and CSS Modules build follow the public DSH client bundle format. `scripts/remote-generator.mjs` uses the pinned published Typert generator in a disposable build workspace and adjusts recognition of directly imported protocol symbols in that build copy. It does not modify the installed generator or the user's DSH.

The bundled browser artifact includes code from zod (MIT), clsx (MIT), and pure DSH protocol/utility modules (MIT). Runtime services and React are provided by the DSH module loader.

## zod license

MIT License

Copyright (c) 2025 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## clsx license

MIT License

Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
