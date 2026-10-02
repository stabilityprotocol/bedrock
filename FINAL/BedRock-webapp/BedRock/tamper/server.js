import express from "express";
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname, join, extname, basename } from "path";
import { mkdirSync, existsSync, unlinkSync } from "fs";
import { stat } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { randomBytes } from "crypto";
import { readFile, writeFile } from "fs/promises";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 4000;
const SEG_SIZE = 1_310_720; // 1.25 MB — matches BedRock

const UPLOADS_DIR = join(__dirname, "uploads");
const OUTPUT_DIR = join(__dirname, "output");
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR);
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR);

const upload = multer({ dest: UPLOADS_DIR });

app.use(express.json({ limit: "50mb" }));
app.use(express.static(join(__dirname, "public")));

// ─── Upload ────────────────────────────────────────────────
app.post("/api/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video file provided" });
  }
  const { filename, originalname, size, path: filepath } = req.file;
  res.json({ id: filename, originalName: originalname, size, path: filepath });
});

// ─── Analyze (ffprobe packet discovery) ────────────────────
app.get("/api/analyze/:id", async (req, res) => {
  const filepath = join(UPLOADS_DIR, req.params.id);
  if (!existsSync(filepath)) {
    return res.status(404).json({ error: "File not found" });
  }

  try {
    const fileStat = await stat(filepath);

    // Get video format info
    const { stdout: formatOut } = await execFileAsync("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      "-select_streams", "v:0",
      filepath,
    ]);
    const formatInfo = JSON.parse(formatOut);
    const stream = formatInfo.streams?.[0] || {};
    const format = formatInfo.format || {};
    let duration = parseFloat(format.duration || stream.duration || "0");
    const codec = stream.codec_name || "unknown";

    // Get packet info for video stream
    const { stdout: packetOut } = await execFileAsync("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_packets",
      "-select_streams", "v:0",
      filepath,
    ], { maxBuffer: 100 * 1024 * 1024 });
    const packetInfo = JSON.parse(packetOut);
    const allPackets = (packetInfo.packets || []).map((p) => ({
      pts_time: parseFloat(p.pts_time || "0"),
      pos: parseInt(p.pos || "0", 10),
      size: parseInt(p.size || "0", 10),
      keyframe: (p.flags || "").includes("K"),
    }));

    // WebM often lacks explicit duration — derive from last packet timestamp
    if (duration === 0 && allPackets.length > 0) {
      duration = Math.max(...allPackets.map((p) => p.pts_time));
    }

    // Determine tamper target window
    const TARGET_START = duration > 6 ? 6.0 : Math.max(0, duration / 2 - 1);
    const TARGET_END = TARGET_START + 2.5;

    const targetPackets = allPackets.filter(
      (p) => p.pts_time >= TARGET_START && p.pts_time <= TARGET_END && p.pos > 0 && p.size > 0
    );

    // Calculate affected BedRock segments
    const affectedSegments = new Set();
    for (const p of targetPackets) {
      const segStart = Math.floor(p.pos / SEG_SIZE);
      const segEnd = Math.floor((p.pos + p.size - 1) / SEG_SIZE);
      for (let s = segStart; s <= segEnd; s++) affectedSegments.add(s);
    }

    const totalSegments = Math.ceil(fileStat.size / SEG_SIZE);

    // Find a representative byte offset for the tamper window (for hex diff later)
    const tamperByteStart = targetPackets.length > 0 ? targetPackets[0].pos : 0;

    res.json({
      file: {
        size: fileStat.size,
        name: format.filename ? format.filename.split("/").pop() : req.params.id,
        duration,
        codec,
        format: format.format_name || "unknown",
      },
      totalSegments,
      segSize: SEG_SIZE,
      targetWindow: { start: TARGET_START, end: TARGET_END },
      targetPackets,
      tamperByteStart,
      affectedSegments: [...affectedSegments].sort((a, b) => a - b),
      totalBytesToCorrupt: targetPackets.reduce((sum, p) => sum + p.size, 0),
    });
  } catch (err) {
    if (err.code === "ENOENT" && err.path === "ffprobe") {
      return res.status(500).json({
        error: "ffprobe not found. Install ffmpeg: brew install ffmpeg",
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── Tamper ─────────────────────────────────────────────────
// Direct byte injection — no re-encode, file size stays identical.
// Finds the middle I-frame (IDR NAL unit), skips the first 32 bytes
// (NAL + slice header), then floods the second half of the slice body
// with 0xFF/0x00 alternating. This biases H.264 chroma residuals toward
// magenta/pink while leaving luma partially intact so the frame is
// visibly corrupted but the video recovers cleanly on the next frame.
app.post("/api/tamper/:id", async (req, res) => {
  const filepath = join(UPLOADS_DIR, req.params.id);
  if (!existsSync(filepath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const { targetPackets, originalName, tamperedName } = req.body;
  if (!targetPackets || targetPackets.length === 0) {
    return res.status(400).json({ error: "No packet data provided" });
  }

  const ext = extname(originalName || ".mp4");
  const base = basename(originalName || "video", ext).replace(/\s+/g, "_");
  const outputName = `${base}_tampered${ext}`;
  const outputPath = join(OUTPUT_DIR, outputName);

  // If a byte-tampered file already exists for this video, use it as the
  // source so the face swap is layered on top of the byte modification.
  const tamperedSourcePath = tamperedName ? join(OUTPUT_DIR, tamperedName) : null;
  if (tamperedSourcePath && existsSync(tamperedSourcePath)) {
    filepath = tamperedSourcePath;
  }

  try {
    // Read the full file into memory (files are typically <50 MB for demo)
    const buf = await readFile(filepath);
    const fileSize = buf.length;

    // ── Find the middle keyframe ──────────────────────────────
    const keyframes = targetPackets.filter((p) => p.keyframe && p.pos > 0 && p.size > 32);
    if (keyframes.length === 0) {
      return res.status(400).json({ error: "No keyframes found in packet data" });
    }
    // Pick the keyframe closest to the middle of all keyframes (not duration midpoint,
    // since we want a frame that's well into the video for maximum demo impact)
    const midIdx = Math.floor(keyframes.length / 2);
    const targetKf = keyframes[midIdx];

    // ── Walk NAL units at the keyframe's byte position ────────
    // MP4 uses length-prefixed NAL units: [4-byte length][NAL data]
    // We collect all contiguous NAL units within the keyframe packet boundary.
    const pktEnd = targetKf.pos + targetKf.size;
    let cursor = targetKf.pos;
    const nalUnits = [];

    while (cursor + 5 < pktEnd && cursor + 5 < fileSize) {
      const nalLen = buf.readUInt32BE(cursor);
      if (nalLen === 0 || cursor + 4 + nalLen > fileSize) break;
      const nalType = buf[cursor + 4] & 0x1f; // low 5 bits of NAL header byte
      nalUnits.push({ offset: cursor + 4, length: nalLen, type: nalType });
      cursor += 4 + nalLen;
    }

    // IDR slices = NAL type 5 (H.264) or type 19/20 (H.265 — treated same way)
    const idrNals = nalUnits.filter((n) => n.type === 5 || n.type === 19 || n.type === 20);

    // Fallback: if no typed IDR NALs found (e.g. WebM/VP8 lacks NAL structure),
    // treat the whole keyframe packet body as one unit to corrupt.
    const targetsToCorrupt = idrNals.length > 0
      ? idrNals
      : [{ offset: targetKf.pos, length: targetKf.size, type: -1 }];

    // ── Apply chroma flood ────────────────────────────────────
    // Skip first 32 bytes of each NAL (header + slice header), then flood
    // the SECOND HALF of the remaining slice body with 0xFF/0x00 alternating.
    // 0xFF in H.264 chroma residuals = maximum positive delta → vivid magenta/pink.
    let totalBytesCorrupted = 0;
    const patchRegions = []; // [{offset, size}] for hex diff

    for (const nal of targetsToCorrupt) {
      const sliceBodyStart = nal.offset + 32;
      const sliceBodyEnd = nal.offset + nal.length;
      const sliceBodyLen = sliceBodyEnd - sliceBodyStart;
      if (sliceBodyLen < 64) continue; // too small to corrupt meaningfully

      const chromaStart = sliceBodyStart + Math.floor(sliceBodyLen / 2);
      const chromaEnd = sliceBodyEnd;

      for (let i = chromaStart; i < chromaEnd && i < fileSize; i++) {
        buf[i] = i % 2 === 0 ? 0xff : 0x00;
      }
      totalBytesCorrupted += chromaEnd - chromaStart;
      patchRegions.push({ offset: chromaStart, size: chromaEnd - chromaStart });
    }

    if (totalBytesCorrupted === 0) {
      return res.status(500).json({ error: "Could not locate patchable NAL slice body" });
    }

    // ── Write output (same size as original) ─────────────────
    await writeFile(outputPath, buf);

    // ── Build hex diff from the first patch region ────────────
    const origBuf = await readFile(filepath);
    const hexDiffs = [];
    const SAMPLE_SIZE = 128;

    for (const region of patchRegions.slice(0, 5)) {
      const end = Math.min(region.offset + SAMPLE_SIZE, origBuf.length, buf.length);
      if (region.offset + SAMPLE_SIZE > origBuf.length) continue;
      const origSlice = origBuf.slice(region.offset, end);
      const tampSlice = buf.slice(region.offset, end);
      hexDiffs.push({
        offset: region.offset,
        size: end - region.offset,
        original: origSlice.toString("hex"),
        tampered: tampSlice.toString("hex"),
        truncated: region.size > SAMPLE_SIZE,
      });
    }

    res.json({
      outputName,
      outputPath: `/api/download/${encodeURIComponent(outputName)}`,
      totalBytesCorrupted,
      originalSize: fileSize,
      tamperedSize: buf.length,
      targetKeyframe: {
        pts_time: targetKf.pts_time,
        pos: targetKf.pos,
        size: targetKf.size,
      },
      nalUnitsFound: idrNals.length,
      hexDiffs,
    });
  } catch (err) {
    console.error("Tamper error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Face Swap ──────────────────────────────────────────────
// Accepts the uploaded video ID + a replacement face image.
// Spawns deepfake.py which does frame-by-frame Haar cascade detection
// and overlays the replacement face with elliptical feathering.
const faceUpload = multer({ dest: UPLOADS_DIR });

app.post("/api/faceswap/:id", faceUpload.single("face"), async (req, res) => {
  const videoPath = join(UPLOADS_DIR, req.params.id);
  if (!existsSync(videoPath)) {
    return res.status(404).json({ error: "Video file not found" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "No face image provided" });
  }

  const facePath   = req.file.path;
  const origName   = req.body.originalName || "video.mp4";
  const tamperedName = req.body.tamperedName || null;
  const ext        = extname(origName) || ".mp4";
  const base       = basename(origName, ext).replace(/\s+/g, "_");
  const outputName = `${base}_faceswap${ext}`;
  const outputPath = join(OUTPUT_DIR, outputName);
  const scriptPath = join(__dirname, "deepfake.py");

  // Use the byte-tampered file as source if it exists, so the face swap
  // layers on top of the byte injection rather than the clean original.
  const tamperedSourcePath = tamperedName ? join(OUTPUT_DIR, tamperedName) : null;
  const sourcePath = (tamperedSourcePath && existsSync(tamperedSourcePath))
    ? tamperedSourcePath
    : videoPath;

  // Stream progress back via SSE so the UI can show a progress bar
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    await new Promise((resolve, reject) => {
      const child = execFile("python3", [scriptPath, sourcePath, facePath, outputPath]);

      child.stdout.on("data", (chunk) => {
        for (const line of chunk.toString().split("\n").filter(Boolean)) {
          if (line.startsWith("progress:")) {
            send({ type: "progress", value: parseInt(line.split(":")[1], 10) });
          } else if (line.startsWith("done:")) {
            send({ type: "done", outputName, outputPath: `/api/download/${encodeURIComponent(outputName)}` });
          } else if (line.startsWith("playable:")) {
            const playName = line.split(":").slice(1).join(":").trim().split("/").pop();
            send({ type: "playable", outputName: playName, outputPath: `/api/download/${encodeURIComponent(playName)}` });
          }
        }
      });

      child.stderr.on("data", (chunk) => {
        const msg = chunk.toString().trim();
        if (msg) console.error("[deepfake]", msg);
      });

      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`deepfake.py exited with code ${code}`));
      });
    });
  } catch (err) {
    send({ type: "error", message: err.message });
  } finally {
    if (existsSync(facePath)) unlinkSync(facePath);
    res.end();
  }
});

// ─── Download (genesis-hash-preserving raw file) ──────────
app.get("/api/download/:filename", (req, res) => {
  const filepath = join(OUTPUT_DIR, req.params.filename);
  if (!existsSync(filepath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.download(filepath);
});

// ─── Stream (re-encoded playable copy for browser) ────────
app.get("/api/stream/:filename", (req, res) => {
  // Serve the _play.mp4 version for in-browser <video> playback
  const raw = req.params.filename;
  const ext = extname(raw);
  const base = basename(raw, ext);
  const playable = join(OUTPUT_DIR, `${base}_play${ext}`);
  // Fall back to raw file if no playable copy exists
  const filepath = existsSync(playable) ? playable : join(OUTPUT_DIR, raw);
  if (!existsSync(filepath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.setHeader("Content-Type", "video/mp4");
  res.sendFile(filepath);
});

// ─── Play in VLC ──────────────────────────────────────────
app.post("/api/play/:filename", (req, res) => {
  const filepath = join(OUTPUT_DIR, req.params.filename);
  if (!existsSync(filepath)) {
    return res.status(404).json({ error: "File not found" });
  }
  execFile("open", ["-a", "VLC", filepath], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// ─── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Tamper demo running at http://localhost:${PORT}`);
});
