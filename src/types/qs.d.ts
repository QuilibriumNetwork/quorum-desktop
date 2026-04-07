declare module 'qs' {
  export function stringify(obj: Record<string, any>, options?: any): string;
  export function parse(str: string, options?: any): Record<string, any>;
  const qs: { stringify: typeof stringify; parse: typeof parse };
  export default qs;
}
