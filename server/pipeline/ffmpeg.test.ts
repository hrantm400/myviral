import { expect, test, describe } from "bun:test";
import { generateASS } from "./ffmpeg";

describe("generateASS", () => {
  test("should generate correct ASS header", () => {
    const result = generateASS([]);
    expect(result).toContain("[Script Info]");
    expect(result).toContain("[V4+ Styles]");
    expect(result).toContain("[Events]");
    expect(result).toContain("Format: Name, Fontname, Fontsize");
  });

  test("should handle a single word correctly", () => {
    const words = [{ word: "Hello", start: 1, end: 2 }];
    const result = generateASS(words, "minimal_white"); // minimal_white has uppercase: false

    // minimal_white colors: primary &H00CCCCCC, highlight &H00FFFFFF, scale 112
    expect(result).toContain("Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,");
    expect(result).toContain("{\\c&H00FFFFFF\\fscx112\\fscy112}Hello{\\c&H00CCCCCC\\fscx100\\fscy100}");
  });

  test("should highlight words in sequence for a 4-word chunk", () => {
    const words = [
      { word: "one", start: 0, end: 1 },
      { word: "two", start: 1, end: 2 },
      { word: "three", start: 2, end: 3 },
      { word: "four", start: 3, end: 4 },
    ];
    const result = generateASS(words, "minimal_white");

    const lines = result.trim().split("\n").filter(l => l.startsWith("Dialogue:"));
    // 4 highlights + 1 hold text at the end of chunk
    expect(lines.length).toBe(5);

    // Line 1 highlights "one". Splitting 4 words: 2 on first line, 2 on second.
    expect(lines[0]).toContain("{\\c&H00FFFFFF\\fscx112\\fscy112}one{\\c&H00CCCCCC\\fscx100\\fscy100} two\\Nthree four");
    // Line 2 highlights "two"
    expect(lines[1]).toContain("one {\\c&H00FFFFFF\\fscx112\\fscy112}two{\\c&H00CCCCCC\\fscx100\\fscy100}\\Nthree four");
    // Line 3 highlights "three"
    expect(lines[2]).toContain("one two\\N{\\c&H00FFFFFF\\fscx112\\fscy112}three{\\c&H00CCCCCC\\fscx100\\fscy100} four");
    // Line 4 highlights "four"
    expect(lines[3]).toContain("one two\\Nthree {\\c&H00FFFFFF\\fscx112\\fscy112}four{\\c&H00CCCCCC\\fscx100\\fscy100}");
  });

  test("should handle chunking (5 words)", () => {
    const words = [
      { word: "one", start: 0, end: 1 },
      { word: "two", start: 1, end: 2 },
      { word: "three", start: 2, end: 3 },
      { word: "four", start: 3, end: 4 },
      { word: "five", start: 4, end: 5 },
    ];
    const result = generateASS(words, "minimal_white");

    const lines = result.split("\n").filter(l => l.startsWith("Dialogue:"));
    // 4 from first chunk + 1 from second chunk = 5 lines (no gaps)
    expect(lines.length).toBe(5);

    // Check first word of second chunk
    expect(lines[4]).toContain("0:00:04.00,0:00:05.00");
    expect(lines[4]).toContain("{\\c&H00FFFFFF\\fscx112\\fscy112}five{\\c&H00CCCCCC\\fscx100\\fscy100}");
  });

  test("should generate hold text during gaps between chunks", () => {
    const words = [
      { word: "one", start: 0, end: 1 },
      { word: "two", start: 1, end: 2 },
      { word: "three", start: 2, end: 3 },
      { word: "four", start: 3, end: 4 },
      // Gap here! nextChunkStart would be 5, but we stop here.
    ];
    // Actually, to test the gap between chunks logic:
    const wordsWithGap = [
      { word: "one", start: 0, end: 1 },
      { word: "two", start: 1, end: 2 },
      { word: "three", start: 2, end: 3 },
      { word: "four", start: 3, end: 4 }, // chunk 1 ends at 4
      { word: "five", start: 5, end: 6 }, // chunk 2 starts at 5. Gap of 1s.
    ];

    const result = generateASS(wordsWithGap, "minimal_white");
    const lines = result.trim().split("\n").filter(l => l.startsWith("Dialogue:"));

    // chunk 1 (4 lines) + hold text for gap (4.00-4.30) (1 line) + chunk 2 (1 line)
    // total 6 lines
    expect(lines.length).toBe(6);
    expect(lines[4]).toContain("0:00:04.00,0:00:04.30,Default,,0,0,0,,one two\\Nthree four");
  });

  test("should apply uppercase style", () => {
    const words = [{ word: "hello", start: 0, end: 1 }];
    const result = generateASS(words, "capcut_green"); // capcut_green has uppercase: true
    expect(result).toContain("HELLO");
    expect(result).not.toContain("hello");
  });
});
