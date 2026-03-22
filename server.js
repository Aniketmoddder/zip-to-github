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
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
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
// 🚀 MAIN ROUTE
// =========================
app.post("/upload", upload.single("zip"), async (req, res) => {
  try {
    console.log("📦 ZIP received");

    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();

    // detect root folder
    const rootFolder = entries[0].entryName.split("/")[0];

    const files = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      let filePath = entry.entryName;

      // remove root folder ONLY
      if (filePath.startsWith(rootFolder)) {
        filePath = filePath.slice(rootFolder.length + 1);
      }

      const content = entry.getData().toString("base64");

      files.push({
        path: filePath,
        content: content
      });
    }

    console.log(`📂 Files prepared: ${files.length}`);

    await uploadViaTree(files);

    console.log("🚀 Upload complete");
    res.json({ success: true });

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).send("Failed");
  }
});

// =========================
// 🌳 TREE API FUNCTION
// =========================
async function uploadViaTree(files) {

  // 1️⃣ Get latest commit
  const refRes = await fetch(
    `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/ref/heads/${BRANCH}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`
      }
    }
  );

  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;

  // 2️⃣ Get base tree
  const commitRes = await fetch(
    `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/commits/${latestCommitSha}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`
      }
    }
  );

  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 3️⃣ Create new tree
  const tree = files.map(file => ({
    path: file.path,
    mode: "100644",
    type: "blob",
    content: Buffer.from(file.content, "base64").toString("utf-8")
  }));

  const treeRes = await fetch(
    `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/trees`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: tree
      })
    }
  );

  const treeData = await treeRes.json();

  // 4️⃣ Create commit
  const commitRes2 = await fetch(
    `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/commits`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "🚀 Ultra fast ZIP upload",
        tree: treeData.sha,
        parents: [latestCommitSha]
      })
    }
  );

  const newCommit = await commitRes2.json();

  // 5️⃣ Update branch
  await fetch(
    `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/refs/heads/${BRANCH}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sha: newCommit.sha
      })
    }
  );
}

// =========================
// 🌐 START
// =========================
app.listen(PORT, () => {
  console.log(`🔥 Running: http://localhost:${PORT}`);
});
