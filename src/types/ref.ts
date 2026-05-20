/**
 * Platform-agnostic ref wrapper.
 *
 * Services should depend on this rather than `React.MutableRefObject<T>` so
 * that they remain free of React types. `React.MutableRefObject<T>` is
 * structurally compatible with `Ref<T>`, so MessageDB and other React-land
 * callers can pass their existing refs directly without changes.
 */
export interface Ref<T> {
  current: T;
}
