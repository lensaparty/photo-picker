const pickSourceBtn = document.getElementById("pickSource");
const pickOutputBtn = document.getElementById("pickOutput");
const startCopyBtn = document.getElementById("startCopy");
const exportText = document.getElementById("exportText");
const statusText = document.getElementById("statusText");

let sourceHandle = null;
let outputHandle = null;

const RAW_EXT = [".cr2", ".cr3", ".nef", ".arw", ".raf", ".dng", ".orf", ".rw2"];
const JPG_EXT = [".jpg", ".jpeg"];

function setStatus(msg) {
  statusText.textContent = msg;
}

function parseNames(text) {
  const names = [];
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const m = trimmed.match(/^\d+\.\s+(.+)$/);
    if (m) names.push(m[1].trim());
  });
  return names;
}

async function indexDirectory(dirHandle, index) {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file") {
      index.set(entry.name, entry);
    } else if (entry.kind === "directory") {
      await indexDirectory(entry, index);
    }
  }
}

async function copyFile(fileHandle, destDir) {
  const file = await fileHandle.getFile();
  const writable = await destDir.getFileHandle(file.name, { create: true });
  const stream = await writable.createWritable();
  await stream.write(await file.arrayBuffer());
  await stream.close();
}

async function copyByName(name, index, destDir) {
  const copied = [];
  if (index.has(name)) {
    await copyFile(index.get(name), destDir);
    copied.push(name);
    return copied;
  }

  const dot = name.lastIndexOf(".");
  const base = dot > -1 ? name.slice(0, dot) : name;
  for (const ext of [...JPG_EXT, ...RAW_EXT]) {
    const candidate = `${base}${ext}`;
    if (index.has(candidate)) {
      await copyFile(index.get(candidate), destDir);
      copied.push(candidate);
    }
  }
  return copied;
}

pickSourceBtn.addEventListener("click", async () => {
  sourceHandle = await window.showDirectoryPicker();
  setStatus("Folder sumber dipilih.");
});

pickOutputBtn.addEventListener("click", async () => {
  outputHandle = await window.showDirectoryPicker();
  setStatus("Folder output dipilih.");
});

startCopyBtn.addEventListener("click", async () => {
  if (!sourceHandle || !outputHandle) {
    setStatus("Pilih folder sumber dan output dulu.");
    return;
  }
  const names = parseNames(exportText.value);
  if (!names.length) {
    setStatus("Tidak ada nama file terdeteksi.");
    return;
  }

  setStatus("Membangun index file...");
  const index = new Map();
  await indexDirectory(sourceHandle, index);

  let copiedCount = 0;
  let missing = 0;
  for (const name of names) {
    const copied = await copyByName(name, index, outputHandle);
    if (copied.length === 0) {
      missing += 1;
    } else {
      copiedCount += copied.length;
    }
  }

  setStatus(`Selesai. Copied: ${copiedCount} file. Missing: ${missing}.`);
});
