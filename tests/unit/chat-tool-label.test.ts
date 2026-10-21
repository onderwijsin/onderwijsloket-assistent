import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { chatToolLabel } from "../../app/utils/chat-tool-label";

describe("chat tool activity labels", () => {
  it("describes every knowledge tool currently exposed by the MCP server", () => {
    // Scheduling is server-only in this phase; its UI activity labels are deferred.
    const serverOnly = new Set(["book_appointment", "get_scheduling_link", "get_scheduling_slots"]);
    const names = readdirSync(new URL("../../server/mcp/tools/", import.meta.url));
    for (const file of names.filter((name) => name.endsWith(".ts"))) {
      const name = file.slice(0, -3).replaceAll("-", "_");
      if (serverOnly.has(name)) continue;
      expect(chatToolLabel(name), name).not.toBe("Kennisbron raadplegen");
    }
    expect(chatToolLabel("search_programs")).toBe("Opleidingen doorzoeken");
    expect(chatToolLabel("get_article")).toBe("Artikel lezen");
    expect(chatToolLabel("get_route_questions")).toBe("Vragen voor jouw onderwijsroute ophalen");
  });

  it("handles partial inputs and resolves known prompt workflows", () => {
    expect(chatToolLabel("mcp_get_prompt")).toBe("Aanpak voor je vraag ophalen");
    expect(chatToolLabel("mcp_get_prompt", { name: "compare-programs" })).toBe(
      "Opleidingsvergelijking voorbereiden"
    );
    expect(chatToolLabel("mcp_get_prompt", { name: "toString" })).toBe(
      "Aanpak voor je vraag ophalen"
    );
    expect(chatToolLabel("future_tool")).toBe("Kennisbron raadplegen");
    expect(chatToolLabel("web_search")).toBe("Zoeken op internet");
  });
});
