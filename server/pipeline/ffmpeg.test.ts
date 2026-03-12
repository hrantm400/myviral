import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import * as child_process from "child_process";

// We mock child_process completely using mock.module
mock.module("child_process", () => {
  return {
    execFile: mock(),
    exec: mock(),
  };
});

// Import getMediaDuration AFTER mocking the module,
// otherwise the original module bindings might be used depending on imports
import { getMediaDuration } from "./ffmpeg";

describe("getMediaDuration", () => {
  let mockExecFile: import("bun:test").Mock<any>;

  beforeEach(() => {
    mockExecFile = child_process.execFile as import("bun:test").Mock<any>;
    mockExecFile.mockReset();
  });

  afterEach(() => {
    mock.restore();
  });

  it("should return the duration when ffprobe succeeds and returns a valid number", async () => {
    const mockFilePath = "test-video.mp4";
    const expectedDuration = 15.42;

    // We mock the execFile implementation to invoke the callback
    mockExecFile.mockImplementation((file: string, args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void) => {
      callback(null, "15.42\n", "");
    });

    const duration = await getMediaDuration(mockFilePath);

    expect(duration).toBe(expectedDuration);
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    expect(mockExecFile).toHaveBeenCalledWith(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mockFilePath],
      expect.any(Function) // The promisified callback
    );
  });

  it("should throw an error when ffprobe process fails", async () => {
    const mockFilePath = "missing-video.mp4";
    const mockError = new Error("Command failed: ffprobe ...");

    mockExecFile.mockImplementation((file: string, args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void) => {
      callback(mockError, "", "Error opening file");
    });

    await expect(getMediaDuration(mockFilePath)).rejects.toThrow(mockError);
    expect(mockExecFile).toHaveBeenCalledTimes(1);
  });

  it("should throw an error when ffprobe output cannot be parsed as a number", async () => {
    const mockFilePath = "corrupt-video.mp4";

    mockExecFile.mockImplementation((file: string, args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void) => {
      callback(null, "N/A\n", "");
    });

    await expect(getMediaDuration(mockFilePath)).rejects.toThrow("Failed to parse duration from output: N/A\n");
    expect(mockExecFile).toHaveBeenCalledTimes(1);
  });
});
