import { getMediaDuration } from "./server/pipeline/ffmpeg";
import * as fs from "fs";

async function main() {
  const testFile = "test_media.mp4";

  // Create a dummy file
  fs.writeFileSync(testFile, "dummy");

  try {
    // Attempt command injection
    const maliciousPayload = `${testFile}"; touch evil.txt; echo "`;
    console.log("Testing with payload:", maliciousPayload);

    // We expect this to either fail because it's not a valid media file,
    // or return a duration. But we should definitely NOT see evil.txt created.
    await getMediaDuration(maliciousPayload);
  } catch (error: any) {
    console.log("Expected error (since it's not a real media file and ffprobe fails):", error.message);
  } finally {
    fs.unlinkSync(testFile);
  }

  // Check if injection was successful
  if (fs.existsSync("evil.txt")) {
    console.error("❌ VULNERABILITY DETECTED: Command injection was successful. evil.txt was created.");
    fs.unlinkSync("evil.txt");
    process.exit(1);
  } else {
    console.log("✅ SUCCESS: No command injection detected. evil.txt was not created.");
  }
}

main().catch(console.error);
