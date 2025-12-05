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
     
    return (queryFunction as any)(...args);
  };
