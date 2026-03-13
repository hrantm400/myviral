import { describe, it, expect, mock, beforeAll } from "bun:test";
import { extractHighlights, ai } from "./gemini";

describe("extractHighlights (Gemini Parsing)", () => {
  beforeAll(() => {
    // Override the instance directly instead of module mocking to prevent real API calls
    if (ai) {
      ai.models = {
        generateContent: async (options: any) => {
          const text = options.contents[0].parts[0].text;

          if (text.includes("BAD_JSON")) {
            return { text: "I found some highlights: [ { bad json" };
          }
          if (text.includes("EMPTY_ARRAY")) {
            return { text: "```json\n[]\n```" };
          }
          if (text.includes("NO_BRACKETS")) {
            return { text: "Here is the response without brackets." };
          }

          // Happy path
          return { text: `[{"start": "00:00:10", "end": "00:00:30"}, {"start": "00:01:00", "end": "00:01:25"}]` };
        }
      };
    }
  });

  it("should successfully parse valid JSON arrays from Gemini response", async () => {
    const highlights = await extractHighlights("fake.mp4", "GOOD_TRANSCRIPT", 120);
    expect(highlights).toBeArray();
    expect(highlights).toHaveLength(2);
    expect(highlights[0].start).toBe("00:00:10");
  });

  it("should return a fallback 30s highlight if Gemini returns broken JSON", async () => {
    const highlights = await extractHighlights("fake.mp4", "BAD_JSON", 120);
    expect(highlights).toBeArray();
    expect(highlights).toHaveLength(1);
    expect(highlights[0].start).toBe("00:00:00");
    expect(highlights[0].end).toBe("00:00:30");
  });

  it("should return a fallback highlight if Gemini returns an empty array", async () => {
    const highlights = await extractHighlights("fake.mp4", "EMPTY_ARRAY", 120);
    expect(highlights).toBeArray();
    expect(highlights).toHaveLength(1);
    expect(highlights[0].end).toBe("00:00:30");
  });

  it("should fallback gracefully if response contains no brackets at all", async () => {
    const highlights = await extractHighlights("fake.mp4", "NO_BRACKETS", 120);
    expect(highlights).toBeArray();
    expect(highlights).toHaveLength(1);
    expect(highlights[0].start).toBe("00:00:00");
  });

  it("should cap fallback end time to videoDuration if video is very short", async () => {
    const highlights = await extractHighlights("fake.mp4", "BAD_JSON", 10);
    expect(highlights[0].end).toBe("00:00:10"); // Min(30, 10) -> 10
  });
});
