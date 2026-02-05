console.log("JS jalan");
// anti gagal katanya
document.addEventListener("DOMContentLoaded", () => {
document.getElementById("finishBtn").onclick = () => alert("TES LANGSUNG");



// simulasi foto dari folder Drive
const mockImages = [
  { id: "img_1", name: "DSC_1023.JPG", url: "https://picsum.photos/id/1011/300" },
  { id: "img_2", name: "DSC_1044.JPG", url: "https://picsum.photos/id/1015/300" },
  { id: "img_3", name: "DSC_1102.JPG", url: "https://picsum.photos/id/1025/300" },
  { id: "img_4", name: "DSC_1130.JPG", url: "https://picsum.photos/id/1035/300" },
  { id: "img_5", name: "DSC_1201.JPG", url: "https://picsum.photos/id/1041/300" },
  { id: "img_6", name: "DSC_1023.JPG", url: "https://picsum.photos/id/1011/300" },
  { id: "img_7", name: "DSC_1044.JPG", url: "https://picsum.photos/id/1015/300" },
  { id: "img_8", name: "DSC_1102.JPG", url: "https://picsum.photos/id/1025/300" },
  { id: "img_9", name: "DSC_1044.JPG", url: "https://picsum.photos/id/1015/300" },
  { id: "img_10", name: "DSC_1102.JPG", url: "https://picsum.photos/id/1025/300" },
  { id: "img_11", name: "DSC_1130.JPG", url: "https://picsum.photos/id/1035/300" },
  { id: "img_12", name: "DSC_1201.JPG", url: "https://picsum.photos/id/1041/300" }
];


const grid = document.getElementById("grid");
const loadBtn = document.getElementById("loadBtn");
const finishBtn = document.getElementById("finishBtn");
const folderInput = document.getElementById("folderInput");
const result = document.getElementById("result");
const resetBtn = document.getElementById("resetBtn");
const MAX_PER_FOLDER = 5;
const IS_CLIENT_MODE = true;


//limit foto per folder
function toggleSelect(id, el) {
  if (isLocked) return;

  // cari folder dari id
  const folder = mockFolders.find(f =>
    f.files.some(file => file.id === id)
  );

  const selectedInFolder = folder.files
    .map(f => f.id)
    .filter(fid => selectedImages.includes(fid));

  const index = selectedImages.indexOf(id);

  if (index > -1) {
    selectedImages.splice(index, 1);
    el.classList.remove("selected");
    return;
  }

  if (selectedInFolder.length >= MAX_PER_FOLDER) {
    alert(`Maksimal ${MAX_PER_FOLDER} foto untuk ${folder.folder}`);
    return;
  }

  selectedImages.push(id);
  el.classList.add("selected");
}

// readonly client mode
if (IS_CLIENT_MODE) {
  resetBtn.style.display = "none";
}

// ambil pilihan lama (kalau ada)
let storageKey = "";
let selectedImages = [];
let isLocked = false;
let isFolderLoaded = false;

loadBtn.onclick = () => {
  const folderLink = folderInput.value.trim();
  if (!folderLink) {
    alert("Paste link folder Google Drive dulu");
    return;
  }

  storageKey = "selectedImages_" + folderLink;
  selectedImages = JSON.parse(localStorage.getItem(storageKey)) || [];

  isLocked = false;
  isFolderLoaded = true; // 🔥 INI WAJIB

  result.innerHTML = "";
  renderImages();

  isFolderLoaded = true;

};


//render image
function renderImages() {
  grid.innerHTML = "";

  mockImages.forEach(imgData => {
    const img = document.createElement("img");
    img.src = imgData.url;

    if (selectedImages.includes(imgData.id)) {
      img.classList.add("selected");
    }

    img.onclick = () => toggleSelect(imgData.id, img);
    grid.appendChild(img);
  });
}



function toggleSelect(id, imgEl) {
  console.log("klik foto:", id);  
  if (!isFolderLoaded) return;
  if (isLocked) return;

  const index = selectedImages.indexOf(id);

  if (index > -1) {
    selectedImages.splice(index, 1);
    imgEl.classList.remove("selected");
  } else {
    selectedImages.push(id);
    imgEl.classList.add("selected");
  }

  localStorage.setItem(storageKey, JSON.stringify(selectedImages));
}

//finish 
 finishBtn.addEventListener("click", () => {
  if (selectedImages.length === 0) {
    alert("klik ok untuk melanjutkan");
    return;
  }

  isLocked = true;

  const selectedNames = mockImages
    .filter(img => selectedImages.includes(img.id))
    .map(img => img.name);

  result.innerHTML = `
    <h3>Selesai 🎉</h3>
    <p>Total foto terpilih: <b>${selectedNames.length}</b></p>

    <textarea id="resultText" style="width:100%; height:120px;" readonly>
${selectedNames.join("\n")}
    </textarea>

    <button id="copyBtn">Copy hasil</button>
    <span id="copyStatus" style="margin-left:8px;color:green;"></span>

    <p><small>Pilihan sudah dikunci. Klik Reset untuk mengulang.</small></p>
  `;

  const copyBtn = document.getElementById("copyBtn");
  const resultText = document.getElementById("resultText");
  const copyStatus = document.getElementById("copyStatus");

  copyBtn.addEventListener("click", () => {
    resultText.select();
    document.execCommand("copy");
    copyStatus.textContent = "✔ Copied!";
    setTimeout(() => (copyStatus.textContent = ""), 1500);
  });
});



finishBtn.onclick = () => {


  // 🔥 LOGIC COPY HARUS DI SINI
  const copyBtn = document.getElementById("copyBtn");
  const resultText = document.getElementById("resultText");
  const copyStatus = document.getElementById("copyStatus");

  copyBtn.onclick = () => {
    resultText.select();
    document.execCommand("copy");

    copyStatus.textContent = "✔ Copied!";
    setTimeout(() => {
      copyStatus.textContent = "";
    }, 1500);
  };
};

//readonly client mode
isLocked = true;

if (IS_CLIENT_MODE) {
  loadBtn.disabled = true;
  finishBtn.disabled = true;
}



// reset tombol
resetBtn.onclick = () => {
  const confirmReset = confirm(
    "Yakin mau reset pilihan? Semua pilihan foto akan dihapus."
  );

  if (!confirmReset) return;

  selectedImages = [];
  localStorage.removeItem(storageKey);

  isLocked = false;

  document.querySelectorAll(".selected").forEach(img => {
    img.classList.remove("selected");
  });

  result.innerHTML = "";

  localStorage.removeItem(storageKey);
selectedImages = [];

};



// lock img
isLocked = false;
isFolderLoaded = true;
finishBtn.onclick = () => {
  if (selectedImages.length === 0) {
    alert("Belum ada foto yang dipilih");
    return;
  }

  isLocked = true;

  
};



});

const themeToggle = document.getElementById("themeToggle");

// load theme tersimpan
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark");
  themeToggle.textContent = "☀️";
}

themeToggle.onclick = () => {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");
  themeToggle.textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("theme", isDark ? "dark" : "light");
};
