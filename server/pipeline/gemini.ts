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

function fixWordTimestamps(
  words: Array<{ word: string; start: number; end: number }>,
  audioDuration: number
): Array<{ word: string; start: number; end: number }> {
  if (words.length === 0) return words;

  const fixed = words.map((w) => ({
    word: w.word,
    start: Math.round(w.start * 100) / 100,
    end: Math.round(w.end * 100) / 100,
  }));

  for (let i = 0; i < fixed.length; i++) {
    if (fixed[i].end <= fixed[i].start) {
      fixed[i].end = fixed[i].start + 0.15;
    }
    fixed[i].start = Math.max(0, fixed[i].start);
    fixed[i].end = Math.min(audioDuration, fixed[i].end);
  }

  for (let i = 1; i < fixed.length; i++) {
    if (fixed[i].start < fixed[i - 1].end) {
      fixed[i].start = fixed[i - 1].end + 0.01;
    }
    if (fixed[i].end <= fixed[i].start) {
      fixed[i].end = fixed[i].start + 0.15;
    }
  }

  for (let i = 0; i < fixed.length - 1; i++) {
    const gap = fixed[i + 1].start - fixed[i].end;
    if (gap > 0 && gap < 0.3) {
      fixed[i].end = fixed[i + 1].start;
    }
  }

  for (const w of fixed) {
    w.start = Math.max(0, Math.min(w.start, audioDuration - 0.1));
    w.end = Math.min(w.end, audioDuration);
    if (w.end <= w.start) {
      w.end = Math.min(w.start + 0.15, audioDuration);
    }
  }

  return fixed;
}

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
            text: `You are a professional audio transcription engine. Transcribe this audio file with PRECISE word-level timestamps.

CRITICAL RULES:
1. Listen to the EXACT timing of each word in the audio — do NOT estimate or approximate
2. Each word must have start and end timestamps in SECONDS with 2 decimal places (centisecond precision)
3. Timestamps MUST be monotonically increasing — each word starts after the previous word ends
4. The first word's start time should match when speech actually begins in the audio
5. The last word's end time should match when speech actually ends in the audio
6. Total audio duration is approximately ${duration.toFixed(2)} seconds — do not exceed this
7. Pay special attention to pauses between sentences — reflect them accurately in timestamp gaps
8. Include EVERY spoken word, no omissions

Return ONLY a valid JSON object (no markdown, no code blocks, no explanation):
{"text": "full transcription here", "words": [{"word": "first", "start": 0.10, "end": 0.35}, {"word": "second", "start": 0.40, "end": 0.70}]}`,
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
  const rawWords = parsed.words || [];
  const fixedWords = fixWordTimestamps(rawWords, duration);

  return {
    duration,
    words: fixedWords,
    text: parsed.text || "",
  };
}

export async function extractHighlights(
  sourceVideoPath: string,
  transcript: string,
  videoDuration: number
): Promise<Array<{ start: string; end: string }>> {
  // Simplistic logic for highlights extraction: prompt Gemini with full transcript
  // to give back JSON array of timecodes
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are analyzing a ${formatTimestamp(videoDuration)} long video/podcast.
The transcript is:
"${transcript}"

Extract 3 of the most interesting, viral, emotional, or educational moments. Each moment should be a complete thought and last between 15 to 45 seconds.

Return ONLY a valid JSON array of timecodes, no markdown:
[{"start": "00:00:10", "end": "00:00:35"}, {"start": "00:01:30", "end": "00:01:50"}]
`,
          },
        ],
      },
    ],
    config: { maxOutputTokens: 8192 },
  });

  const responseText = response.text || "";
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [{ start: "00:00:00", end: formatTimestamp(Math.min(30, videoDuration)) }];
  }

  try {
    const segments = JSON.parse(jsonMatch[0]);
    return Array.isArray(segments) && segments.length > 0 ? segments : [{ start: "00:00:00", end: formatTimestamp(Math.min(30, videoDuration)) }];
  } catch {
    return [{ start: "00:00:00", end: formatTimestamp(Math.min(30, videoDuration)) }];
  }
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

  const frameParts = frameFiles
    .map((f, i) => {
      const frameData = fs.readFileSync(path.join(framesDir, f));
      const timestamp = i * frameInterval;
      return [
        {
          inlineData: {
            mimeType: "image/jpeg" as const,
            data: frameData.toString("base64"),
          },
        },
        {
          text: `Frame at ${formatTimestamp(timestamp)}`,
        },
      ];
    })
    .flat();

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
      return [
        {
          start: "00:00:00",
          end: formatTimestamp(Math.min(targetDuration, videoDuration)),
        },
      ];
    }
    return segments;
  } catch {
    return [
      {
        start: "00:00:00",
        end: formatTimestamp(Math.min(targetDuration, videoDuration)),
      },
    ];
  }
}

function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
