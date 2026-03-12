import { test, expect, mock, describe, beforeEach } from "bun:test";
import path from "path";
import { execUtils } from "./execUtils";
import { extractVideoSegments } from "./ffmpeg";

const mockExecAsync = mock(async (cmd: string, opts?: any) => {
    return { stdout: "", stderr: "" };
});

describe("extractVideoSegments", () => {
  beforeEach(() => {
    mockExecAsync.mockClear();
    execUtils.execAsync = mockExecAsync as any;
  });

  test("should successfully extract segments (happy path)", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });

    const sourceVideoPath = "input.mp4";
    const timecodes = [
      { start: "00:00:00", end: "00:00:05" },
      { start: "00:00:10", end: "00:00:15" }
    ];
    const outputDir = "/tmp/out";

    const result = await extractVideoSegments(sourceVideoPath, timecodes, outputDir);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(path.join(outputDir, "segment_0.mp4"));
    expect(result[1]).toBe(path.join(outputDir, "segment_1.mp4"));

    expect(mockExecAsync).toHaveBeenCalledTimes(2);
    expect(mockExecAsync.mock.calls[0][0]).toContain("-ss 00:00:00");
    expect(mockExecAsync.mock.calls[0][0]).toContain("-to 00:00:05");
    expect(mockExecAsync.mock.calls[1][0]).toContain("-ss 00:00:10");
    expect(mockExecAsync.mock.calls[1][0]).toContain("-to 00:00:15");
  });

  test("should throw an error and stop processing if exec fails on the first segment", async () => {
    const errorToThrow = new Error("Command failed: ffmpeg timeout or error");

    mockExecAsync.mockImplementation(async () => {
        throw errorToThrow;
    });

    const sourceVideoPath = "input.mp4";
    const timecodes = [
      { start: "00:00:00", end: "00:00:05" },
      { start: "00:00:10", end: "00:00:15" }
    ];
    const outputDir = "/tmp/out";

    await expect(extractVideoSegments(sourceVideoPath, timecodes, outputDir)).rejects.toThrow(errorToThrow);
    expect(mockExecAsync).toHaveBeenCalledTimes(1);
  });

  test("should throw an error and stop processing if exec fails on a subsequent segment", async () => {
    const errorToThrow = new Error("Command failed on second run");

    let callCount = 0;
    mockExecAsync.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
            return { stdout: "", stderr: "" };
        } else {
            throw errorToThrow;
        }
    });

    const sourceVideoPath = "input.mp4";
    const timecodes = [
      { start: "00:00:00", end: "00:00:05" },
      { start: "00:00:10", end: "00:00:15" },
      { start: "00:00:20", end: "00:00:25" }
    ];
    const outputDir = "/tmp/out";

    await expect(extractVideoSegments(sourceVideoPath, timecodes, outputDir)).rejects.toThrow(errorToThrow);
    expect(mockExecAsync).toHaveBeenCalledTimes(2);
  });
});
