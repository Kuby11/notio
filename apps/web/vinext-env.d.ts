/// <reference types="vite/client" />

// vinext reimplements the Next.js API surface. These declaration sets stand in
// for the `next` package so the app type-checks without it installed: the first
// declares the `next` and `next/*` modules, the second adds vinext extensions.
import 'vinext/types';
import 'vinext/types/augmentations';
