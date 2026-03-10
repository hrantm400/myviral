import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export async function transcribeAudio(
  audioPath: string
): Promise<{
  duration: number;
  words: Array<{ word: string; start: number; end: number }>;
  text: string;
}> {
  const audioBuffer = fs.readFileSync(audioPath);
  const base64Audio = audioBuffer.toString("base64");
  const ext = path.extname(audioPath).toLowerCase();
  const mimeType = ext === ".wav" ? "audio/wav" : "audio/mpeg";

  const { stdout: durationStr } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`
  );
  const duration = parseFloat(durationStr.trim());

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
          {
            text: `Transcribe this audio with word-level timestamps. Return ONLY a valid JSON object with this exact structure, no markdown formatting:
{"text": "full transcription text", "words": [{"word": "first", "start": 0.0, "end": 0.3}, {"word": "second", "start": 0.35, "end": 0.6}]}

Rules:
- Every word must have a start and end timestamp in seconds
- Timestamps must be accurate and sequential
- Include ALL words spoken in the audio
- Return ONLY the JSON, no explanation or markdown code blocks`,
          },
        ],
      },
    ],
    config: { maxOutputTokens: 8192 },
  });

  const responseText = response.text || "";
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse transcription response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    duration,
    words: parsed.words || [],
    text: parsed.text || "",
  };
}

export async function curateVideoSegments(
  sourceVideoPath: string,
  transcript: string,
  targetDuration: number
): Promise<Array<{ start: string; end: string }>> {
  const { stdout: durationStr } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${sourceVideoPath}"`
  );
  const videoDuration = parseFloat(durationStr.trim());

  const framesDir = path.join(path.dirname(sourceVideoPath), "frames");
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }

  const frameInterval = Math.max(5, Math.floor(videoDuration / 20));
  await execAsync(
    `ffmpeg -y -i "${sourceVideoPath}" -vf "fps=1/${frameInterval},scale=320:-1" "${framesDir}/frame_%04d.jpg"`,
    { timeout: 120000 }
  );

  const frameFiles = fs
    .readdirSync(framesDir)
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .slice(0, 15);

  const frameParts = frameFiles.map((f, i) => {
    const frameData = fs.readFileSync(path.join(framesDir, f));
    const timestamp = i * frameInterval;
    return [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: frameData.toString("base64"),
        },
      },
      {
        text: `Frame at ${formatTimestamp(timestamp)}`,
      },
    ];
  }).flat();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          ...frameParts,
          {
            text: `You are analyzing frames from a ${formatTimestamp(videoDuration)} long video. The frames are sampled every ${frameInterval} seconds.

The video will be used to create a vertical Short/Reel with this voiceover:
"${transcript}"

The voiceover is ${targetDuration.toFixed(1)} seconds long. I need you to select the MOST engaging, action-packed, or emotionally compelling segments from this video that together total approximately ${targetDuration.toFixed(1)} seconds.

Look for:
- High-emotion moments (reactions, expressions)
- Key action scenes
- Dramatic moments
- Visually interesting compositions

Return ONLY a valid JSON array of timecodes, no markdown:
[{"start": "00:00:10", "end": "00:00:18"}, {"start": "00:01:30", "end": "00:01:40"}]

Requirements:
- Total duration of all segments must equal approximately ${targetDuration.toFixed(1)} seconds
- Each segment should be at least 3 seconds long
- Segments should be in chronological order
- Use HH:MM:SS format
- Do not exceed the video duration of ${formatTimestamp(videoDuration)}`,
          },
        ],
      },
    ],
    config: { maxOutputTokens: 8192 },
  });

  const responseText = response.text || "";
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    const segmentDuration = Math.min(targetDuration, videoDuration);
    return [{ start: "00:00:00", end: formatTimestamp(segmentDuration) }];
  }

  try {
    const segments = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(segments) || segments.length === 0) {
      return [{ start: "00:00:00", end: formatTimestamp(Math.min(targetDuration, videoDuration)) }];
    }
    return segments;
  } catch {
    return [{ start: "00:00:00", end: formatTimestamp(Math.min(targetDuration, videoDuration)) }];
  }
}

function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
