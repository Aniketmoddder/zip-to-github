import express from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import fetch from "node-fetch";
import path from "path";

const app = express();
const PORT = 3000;

// =========================
// 🔐 HARDCODE CONFIG
// =========================
const GITHUB_USERNAME = "Aniketmoddder";
const GITHUB_TOKEN = "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";
const REPO_NAME = "smmpanelrg";
const BRANCH = "main";

// =========================
// 📁 STATIC FRONTEND
// =========================
app.use(express.static("public"));

// =========================
// 📤 MULTER MEMORY (FAST)
// =========================
const upload = multer({ storage: multer.memoryStorage() });

// =========================
// 🚀 MAIN UPLOAD ROUTE
// =========================
app.post("/upload", upload.single("zip"), async (req, res) => {
  try {
    console.log("📦 ZIP received");

    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();

    const uploads = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const filePath = entry.entryName;
      const content = entry.getData().toString("base64");

      uploads.push(() => uploadToGitHub(filePath, content));
    }

    // ⚡ Chunked parallel upload (VERY IMPORTANT)
    const chunkSize = 20;

    for (let i = 0; i < uploads.length; i += chunkSize) {
      const chunk = uploads.slice(i, i + chunkSize);
      await Promise.all(chunk.map(fn => fn()));
    }

    console.log("🚀 Upload complete");

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).send("Upload failed");
  }
});

// =========================
// 📡 GITHUB API FUNCTION
// =========================
async function uploadToGitHub(filePath, content) {
  const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${filePath}`;

  // Check existing file
  const check = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`
    }
  });

  let sha = null;

  if (check.status === 200) {
    const data = await check.json();
    sha = data.sha;
  }

  // Upload
  await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "🚀 Uploaded via PRO ZIP tool",
      content,
      branch: BRANCH,
      sha
    })
  });
}

// =========================
// 🌐 START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`🔥 Running: http://localhost:${PORT}`);
});
