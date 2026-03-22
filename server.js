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
const REPO_NAME = "smmpanelrg";
const BRANCH = "main";
const TOKEN = process.env.GITHUB_TOKEN;

// =========================
// 📤 MULTER
// =========================
const upload = multer({ storage: multer.memoryStorage() });

// =========================
// 🚀 MAIN ROUTE
// =========================
app.post("/upload", upload.single("zip"), async (req, res) => {
  try {
    console.log("📦 ZIP received");

    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();

    // =========================
    // 🧠 DETECT ROOT FOLDER
    // =========================
    let root = entries[0].entryName.split("/")[0];

    const tree = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      let filePath = entry.entryName;

      // remove root folder ONLY if exists
      if (filePath.startsWith(root + "/")) {
        filePath = filePath.slice(root.length + 1);
      }

      const content = entry.getData().toString("base64");

      tree.push({
        path: filePath,
        mode: "100644",
        type: "blob",
        content: Buffer.from(content, "base64").toString("utf-8")
      });
    }

    console.log("📂 Files prepared:", tree.length);

    // =========================
    // 🔁 GET LATEST COMMIT SHA
    // =========================
    const refRes = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/ref/heads/${BRANCH}`,
      {
        headers: {
          Authorization: `token ${TOKEN}`
        }
      }
    );

    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // =========================
    // 📦 GET BASE TREE
    // =========================
    const commitRes = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/commits/${latestCommitSha}`,
      {
        headers: {
          Authorization: `token ${TOKEN}`
        }
      }
    );

    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // =========================
    // 🌳 CREATE NEW TREE
    // =========================
    const treeRes = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/trees`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree
        })
      }
    );

    const treeData = await treeRes.json();

    // =========================
    // 🧾 CREATE COMMIT
    // =========================
    const newCommitRes = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/commits`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "🚀 Ultra upload via ZIP",
          tree: treeData.sha,
          parents: [latestCommitSha]
        })
      }
    );

    const newCommitData = await newCommitRes.json();

    // =========================
    // 🔄 UPDATE BRANCH
    // =========================
    await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/refs/heads/${BRANCH}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `token ${TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sha: newCommitData.sha
        })
      }
    );

    console.log("🚀 Upload complete (ULTRA FAST)");
    res.json({ success: true });

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).send("Failed");
  }
});

// =========================
// 🌐 START
// =========================
app.listen(PORT, () => {
  console.log(`🔥 Running on http://localhost:${PORT}`);
});
