/** Per-request selections shared by the chat and its composer. */
export interface ChatSettings {
  model: "mistral-medium-latest" | "gpt-6-luna";
  webSearch: boolean;
  extendedThinking: boolean;
}
