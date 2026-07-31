declare global {
  type D1Value = null | number | string | ArrayBuffer;

  interface D1Result<T = Record<string, unknown>> {
    results: T[];
    success: boolean;
  }

  interface D1PreparedStatement {
    bind(...values: D1Value[]): D1PreparedStatement;
    all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    run(): Promise<D1Result>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  }

  var __VLEARN_ENV__:
    | {
    DB?: D1Database;
      }
    | undefined;
}

export {};
