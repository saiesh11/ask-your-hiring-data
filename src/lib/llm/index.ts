// Public surface: the interface and the factory. Provider classes are an
// implementation detail — callers must go through `getLlmProvider`.
export type { LLMProvider } from "./provider";
export { getLlmProvider } from "./factory";
