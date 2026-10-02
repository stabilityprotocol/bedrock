const $ = (sel) => document.querySelector(sel);

let state = { fileId: null, originalName: null, analysis: null, tamperResult: null };

// ─── Upload handling ───────────────────────────────────────
const uploadZone = $("#upload-zone");
const fileInput = $("#file-input");

uploadZone.addEventListener("click", () => fileInput.click());
uploadZone.addEventListener("dragover", (e) => { e.preventDefault(); uploadZone.classList.add("drag-over"); });
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => { if (fileInput.files.length) handleFile(fileInput.files[0]); });

async function handleFile(file) {
  showLoading("Analyzing video packets...");
  state.originalName = file.name;

  const form = new FormData();
  form.append("video", file);

  const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
  const uploadData = await uploadRes.json();
  state.fileId = uploadData.id;

  const analyzeRes = await fetch(`/api/analyze/${state.fileId}`);
  state.analysis = await analyzeRes.json();

  if (state.analysis.error) {
    hideLoading();
    alert("Error: " + state.analysis.error);
    return;
  }

  hideLoading();
  renderVideoInfo();
  renderStats();
  renderHexPlaceholder();
  $("#dashboard").classList.remove("hidden");
  showFaceSwapZone();
  uploadZone.classList.add("hidden");
}

// ─── Video Info ────────────────────────────────────────────
function renderVideoInfo() {
  const { file } = state.analysis;
  const rows = [
    ["Filename", state.originalName],
    ["Format", file.format],
    ["Codec", file.codec],
    ["Duration", file.duration.toFixed(2) + "s"],
    ["File Size", formatBytes(file.size)],
  ];
  $("#video-details").innerHTML = rows
    .map(([l, v]) => `<div class="file-detail"><span class="file-detail-label">${l}</span><span class="file-detail-value">${v}</span></div>`)
    .join("");
}

// ─── Stats ─────────────────────────────────────────────────
function renderStats() {
  const { targetPackets, totalBytesToCorrupt, targetWindow } = state.analysis;
  $("#stats-cards").innerHTML = `
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-label">Bytes</div>
        <div class="stat-value highlight">${formatBytes(totalBytesToCorrupt)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Packets</div>
        <div class="stat-value highlight">${targetPackets.length}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">From</div>
        <div class="stat-value">${targetWindow.start.toFixed(2)}s</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">To</div>
        <div class="stat-value">${targetWindow.end.toFixed(2)}s</div>
      </div>
    </div>`;
}

// ─── Hex placeholder ───────────────────────────────────────
function renderHexPlaceholder() {
  $("#hex-diff").innerHTML = '<div class="hex-empty">Awaiting corruption...</div>';
  $("#hex-status").textContent = "Waiting for tamper...";
}

// ─── Tamper button ─────────────────────────────────────────
$("#tamper-btn").addEventListener("click", async () => {
  const btn = $("#tamper-btn");
  btn.disabled = true;
  btn.querySelector(".tamper-btn-text").textContent = "Processing...";
  btn.querySelector(".tamper-btn-sub").textContent = "Applying visual effect via ffmpeg";
  showLoading("Re-encoding with overlay...");

  const res = await fetch(`/api/tamper/${state.fileId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetPackets: state.analysis.targetPackets,
      originalName: state.originalName,
    }),
  });
  state.tamperResult = await res.json();

  hideLoading();
  const kf = state.tamperResult.targetKeyframe;
  btn.querySelector(".tamper-btn-text").textContent = "Bytes Injected";
  btn.querySelector(".tamper-btn-sub").textContent =
    formatBytes(state.tamperResult.totalBytesCorrupted) + " bytes altered" +
    (kf ? ` @ ${kf.pts_time.toFixed(2)}s keyframe` : "");
  $("#status-badge").textContent = "Tampered";
  $("#status-badge").style.color = "var(--red)";
  $("#status-badge").style.background = "var(--red-dim)";
  renderHexDiff();
  renderDownloadBar();
  showVideoPreview(state.tamperResult.outputName);
  playInVLC(state.tamperResult.outputName);
});

// ─── Hex Diff ──────────────────────────────────────────────
function renderHexDiff() {
  const { hexDiffs } = state.tamperResult;
  if (!hexDiffs || !hexDiffs.length) {
    $("#hex-diff").innerHTML = '<div class="hex-empty">No diff data</div>';
    return;
  }

  $("#hex-status").textContent = `${hexDiffs.length} regions modified`;

  let html = '<table class="hex-table"><thead><tr><th>Offset</th><th>Original</th><th>Tampered</th></tr></thead><tbody>';

  for (const diff of hexDiffs) {
    const origBytes = diff.original.match(/.{2}/g) || [];
    const tampBytes = diff.tampered.match(/.{2}/g) || [];

    for (let row = 0; row < origBytes.length; row += 8) {
      const offset = diff.offset + row;
      const origSlice = origBytes.slice(row, row + 8);
      const tampSlice = tampBytes.slice(row, row + 8);

      const origHtml = origSlice.map((b) => `<span class="hex-original">${b}</span>`).join(" ");

      const tampHtml = tampSlice.map((b, i) => {
        const changed = b !== origSlice[i];
        return `<span class="${changed ? "hex-changed" : "hex-original"}">${b}</span>`;
      }).join(" ");

      html += `<tr><td class="hex-offset">0x${offset.toString(16).padStart(8, "0")}</td><td>${origHtml}</td><td>${tampHtml}</td></tr>`;
    }

    if (diff.truncated) {
      html += `<tr class="hex-separator"><td colspan="3">+${(diff.size - 128).toLocaleString()} bytes</td></tr>`;
    }
  }

  html += "</tbody></table>";
  $("#hex-diff").innerHTML = html;
}

// ─── Download bar ──────────────────────────────────────────
function renderDownloadBar() {
  const { outputName, outputPath } = state.tamperResult;
  showDownload(outputName, outputPath);
}

function showDownload(outputName, outputPath) {
  $("#download-path").textContent = outputName;
  $("#download-btn").onclick = () => { window.location.href = outputPath; };
  $("#play-btn").onclick = () => playInVLC(outputName);
  $("#download-bar").classList.remove("hidden");
}

function showVideoPreview(outputName) {
  // Use /api/stream/ which serves the re-encoded _play.mp4 for browser playback
  const player = $("#preview-player");
  player.src = `/api/stream/${encodeURIComponent(outputName)}`;
  $("#video-preview").classList.remove("hidden");
  player.play().catch(() => {});
}

function playInVLC(filename) {
  fetch(`/api/play/${encodeURIComponent(filename)}`, { method: "POST" });
}

// ─── Face Swap ─────────────────────────────────────────────
const faceInput = $("#face-input");
const faceUploadLabel = $("#face-upload-label");

faceInput.addEventListener("change", () => {
  if (faceInput.files.length) {
    $("#face-upload-text").textContent = faceInput.files[0].name;
    $("#faceswap-btn").disabled = false;
  }
});

$("#faceswap-btn").addEventListener("click", async () => {
  if (!faceInput.files.length || !state.fileId) return;

  const btn = $("#faceswap-btn");
  btn.disabled = true;
  btn.textContent = "Processing...";
  $("#faceswap-badge").textContent = "Running";
  $("#faceswap-badge").style.color = "var(--purple-light)";
  $("#faceswap-badge").style.background = "rgba(103,80,164,0.15)";
  $("#faceswap-progress-wrap").classList.remove("hidden");

  const form = new FormData();
  form.append("face", faceInput.files[0]);
  form.append("originalName", state.originalName);
  // If byte injection has already run, send the tampered filename so the
  // face swap layers on top of it instead of the clean original.
  if (state.tamperResult?.outputName) {
    form.append("tamperedName", state.tamperResult.outputName);
  }

  // Use fetch + ReadableStream to consume SSE
  const resp = await fetch(`/api/faceswap/${state.fileId}`, { method: "POST", body: form });
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop();
    for (const part of parts) {
      const line = part.replace(/^data: /, "").trim();
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === "progress") {
          $("#faceswap-progress-bar").style.width = msg.value + "%";
          $("#faceswap-progress-label").textContent = msg.value + "%";
        } else if (msg.type === "done") {
          $("#faceswap-progress-bar").style.width = "100%";
          $("#faceswap-progress-label").textContent = "100%";
          $("#faceswap-badge").textContent = "Done";
          $("#faceswap-badge").style.color = "var(--success)";
          $("#faceswap-badge").style.background = "rgba(16,185,129,0.1)";
          btn.textContent = "Completed";
          // Download = genesis-hash-preserving file
          showDownload(msg.outputName, msg.outputPath);
          showVideoPreview(msg.outputName);
        } else if (msg.type === "playable") {
          // Auto-open the re-encoded playable copy in VLC
          state.playableName = msg.outputName;
          $("#play-btn").onclick = () => playInVLC(msg.outputName);
          playInVLC(msg.outputName);
        } else if (msg.type === "error") {
          $("#faceswap-badge").textContent = "Error";
          $("#faceswap-badge").style.color = "var(--error)";
          btn.textContent = "Failed — retry";
          btn.disabled = false;
          alert("Face swap error: " + msg.message);
        }
      } catch (_) {}
    }
  }
});

// Show face swap zone after analysis
function showFaceSwapZone() {
  $("#faceswap-zone").classList.remove("hidden");
}

// ─── Loading overlay ───────────────────────────────────────
function showLoading(text) {
  const overlay = document.createElement("div");
  overlay.className = "loading-overlay";
  overlay.id = "loading";
  overlay.innerHTML = `<div class="spinner"></div><div class="loading-text">${text || "Processing..."}</div>`;
  document.body.appendChild(overlay);
}

function hideLoading() {
  const el = $("#loading");
  if (el) el.remove();
}

// ─── Helpers ───────────────────────────────────────────────
function formatBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / (1024 * 1024)).toFixed(2) + " MB";
}
