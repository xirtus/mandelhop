# Third-party notices

MANDELHOP contains no verbatim copied source files. Two algorithmic systems
were studied and adapted in spirit/structure from MIT-licensed projects by
Owen Yuwono, whose licenses are reproduced here as required:

## poseidon — https://github.com/owenyuwono/poseidon
Spectral ocean water (JONSWAP spectrum, FFT cascades, foam/scatter shading),
itself porting gasgiant/FFT-Ocean (MIT). MANDELHOP's js/water.js adapts the
spectral amplitude-distribution and dispersion ideas into an analytic
multi-wave WebGL2 shader.

## gaia — https://github.com/owenyuwono/gaia
Procedural grass (ribbon blade geometry, per-vertex swayFactor, wind model of
primary gust + irrational turbulence + cross-sway, mulberry32 PRNG, genome
morphospace). MANDELHOP's js/vegetation.js and js/rng.js adapt these.

MIT License

Copyright (c) 2026 owenyuwono

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

## three.js — https://github.com/mrdoob/three.js
MIT License © 2010-2026 three.js authors. Loaded from CDN at runtime.
