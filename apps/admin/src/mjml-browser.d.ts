// O mjml-browser não publica tipos. Só o que usamos.
declare module 'mjml-browser' {
  interface MjmlResult {
    html: string;
    errors: unknown[];
  }
  export default function mjml(input: string, options?: Record<string, unknown>): MjmlResult;
}
