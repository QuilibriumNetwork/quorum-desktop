import * as React from 'react';

export function useForceUpdate() {
  const [, setValue] = React.useState(0);
  return () => setValue((value) => value + 1);
}

export default useForceUpdate;
