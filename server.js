import express from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import fetch from "node-fetch";

const app = express();
const PORT = 3000;

// =========================
// 🔐 CONFIG
// =========================
const GITHUB_USERNAME = "Aniketmoddder";
const GITHUB_TOKEN = "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";
const REPO_NAME = "smmpanelrg";
const BRANCH = "main";

// =========================
// 📁 STATIC
// =========================
app.use(express.static("public"));

// =========================
// 📤 MULTER
// =========================
const upload = multer({ storage: multer.memoryStorage() });

// =========================
// 🚀 UPLOAD ROUTE
// =========================
app.post("/upload", upload.single("zip"), async (req, res) => {
  try {
    console.log("📦 ZIP received");

    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();

    const uploads = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      // 🔥 FIX PATH (remove root folder)
      const filePath = entry.entryName.replace(/^.*?\//, "");
      const content = entry.getData().toString("base64");

      uploads.push(() => uploadToGitHub(filePath, content));
    }

    // ⚡ chunk upload
    const chunkSize = 20;

    for (let i = 0; i < uploads.length; i += chunkSize) {
      const chunk = uploads.slice(i, i + chunkSize);
      await Promise.all(chunk.map(fn => fn()));
    }

    console.log("🚀 Upload complete");
    res.json({ success: true });

  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    res.status(500).send("Upload failed");
  }
});

// =========================
// 📡 GITHUB UPLOAD
// =========================
async function uploadToGitHub(filePath, content) {
  const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${filePath}`;

  try {
    // check file exists
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

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "🚀 Uploaded via ZIP tool",
        content,
        branch: BRANCH,
        sha
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ GitHub Error:", filePath, result);
    } else {
      console.log("✅ Uploaded:", filePath);
    }

  } catch (err) {
    console.error("❌ Upload Failed:", filePath, err);
  }
}

// =========================
// 🌐 START
// =========================
app.listen(PORT, () => {
  console.log(`🔥 Running: http://localhost:${PORT}`);
});
