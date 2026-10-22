/** Per-request selections shared by the chat and its composer. */
export interface ChatSettings {
  model: "mistral-medium-latest" | "gpt-6-luna";
  webSearch: boolean;
  extendedThinking: boolean;
}

/** Initial selections for a new conversation; copy before editing. */
export const DEFAULT_CHAT_SETTINGS: Readonly<ChatSettings> = {
  model: "gpt-6-luna",
  webSearch: false,
  extendedThinking: true
};
