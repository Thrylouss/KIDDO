import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// Modul kengaytmasi (declaration merging): interfeyslar ataylab bo'sh va vitest'dagi tip parametrlari bilan bir xil bo'lishi shart
/* eslint-disable @typescript-eslint/no-empty-object-type */
declare module "vitest" {
  interface Matchers<R = void, T = {}> extends TestingLibraryMatchers<T, R> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}
