type StrictlyTypedFetcher<T> = (context: {
  pageParam: {
    cursor: number | undefined;
    direction: 'forward' | 'backward' | undefined;
  };
}) => Promise<T>;

type LooselyTypedFetcher<T> = () => Promise<T>;

export const wrapPaginatedFetcher =
  <T>(queryFunction: StrictlyTypedFetcher<T>): LooselyTypedFetcher<T> =>
  (...args) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (queryFunction as any)(...args);
  };
