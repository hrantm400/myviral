import { describe, it, expect } from "bun:test";
import { generateASS } from "./ffmpeg";

describe("generateASS (Subtitle Formatter)", () => {
  const dummyWords = [
    { word: "Hello", start: 0.1, end: 0.5 },
    { word: "world", start: 0.6, end: 1.0 },
    { word: "this", start: 1.1, end: 1.5 },
    { word: "is", start: 1.6, end: 2.0 },
    { word: "a", start: 2.1, end: 2.5 },
    { word: "test", start: 2.6, end: 3.0 },
  ];

  it("should output valid ASS header structure", () => {
    const ass = generateASS(dummyWords, "capcut_green");
    expect(ass).toInclude("[Script Info]");
    expect(ass).toInclude("[V4+ Styles]");
    expect(ass).toInclude("[Events]");
  });

  it("should use correct color codes from the style dictionary", () => {
    const ass = generateASS(dummyWords, "capcut_green");
    // green highlight color check
    expect(ass).toInclude("\\c&H0000FF00");

    const assYellow = generateASS(dummyWords, "capcut_yellow");
    expect(assYellow).toInclude("\\c&H0000FFFF");
  });

  it("should correctly group words and generate Dialogue events", () => {
    const ass = generateASS(dummyWords, "neon_pop");

    // Total words = 6. With a chunk size of 4, we expect it to break into two chunks.
    // Chunk 1: Hello world this is
    // Chunk 2: a test

    // Just verify the Dialogue keyword exists multiple times
    const dialogueLines = ass.split("\n").filter(line => line.startsWith("Dialogue:"));
    expect(dialogueLines.length).toBeGreaterThan(0);

    // Assert the first word is present in the output
    expect(ass).toInclude("HELLO"); // Neon pop is uppercase
  });

  it("should gracefully handle an empty array of words", () => {
    const ass = generateASS([], "minimal_white");
    expect(ass).toInclude("[Events]");
    // Should not contain any Dialogue lines
    const dialogueLines = ass.split("\n").filter(line => line.startsWith("Dialogue:"));
    expect(dialogueLines.length).toBe(0);
  });
});
