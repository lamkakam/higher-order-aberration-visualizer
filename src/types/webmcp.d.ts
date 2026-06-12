export {};

type WebMcpJsonSchema = {
  readonly [key: string]: unknown;
};

interface WebMcpToolDefinition<TInput, TResult> {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: WebMcpJsonSchema;
  readonly execute: (input: TInput) => TResult | Promise<TResult>;
}

interface WebMcpRegisterToolOptions {
  readonly signal: AbortSignal;
}

interface DocumentModelContext {
  registerTool<TInput, TResult>(
    tool: WebMcpToolDefinition<TInput, TResult>,
    options: WebMcpRegisterToolOptions
  ): void;
}

declare global {
  interface Document {
    readonly modelContext?: DocumentModelContext;
  }
}
