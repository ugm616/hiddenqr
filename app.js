// HiddenQR - QR Video Encoder/Decoder
// Core logic for encoding, decoding, encryption, compression, and steganography

// UI Elements
const encodeTab = document.getElementById("encodeTab");
const decodeTab = document.getElementById("decodeTab");
const encodePanel = document.getElementById("encodePanel");
const decodePanel = document.getElementById("decodePanel");

const inputData = document.getElementById("inputData");
const encryptToggle = document.getElementById("encryptToggle");
const encryptKey = document.getElementById("encryptKey");
const compressionMethod = document.getElementById("compressionMethod");
const stegMethod = document.getElementById("stegMethod");
const generateVideoBtn = document.getElementById("generateVideo");
const previewVideo = document.getElementById("previewVideo");
const downloadLink = document.getElementById("downloadLink");

const videoInput = document.getElementById("videoInput");
const decryptKey = document.getElementById("decryptKey");
const decodeVideoBtn = document.getElementById("decodeVideo");
const outputData = document.getElementById("outputData");

// Tab Switching
encodeTab.onclick = () => {
  encodePanel.style.display = "block";
  decodePanel.style.display = "none";
};
decodeTab.onclick = () => {
  encodePanel.style.display = "none";
  decodePanel.style.display = "block";
};

// Utility Functions
function textToUint8(text) {
  return new TextEncoder().encode(text);
}
function uint8ToText(uint8) {
  return new TextDecoder().decode(uint8);
}

// Compression
function compressData(data, method) {
  if (method === "gzip") {
    return pako.gzip(data);
  }
  return data;
}
function decompressData(data, method) {
  if (method === "gzip") {
    return pako.ungzip(data);
  }
  return data;
}

// Encryption
async function encryptData(data, password) {
  const keyMaterial = await getKeyMaterial(password);
  const key = await deriveKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return combined;
}

async function decryptData(data, password) {
  const keyMaterial = await getKeyMaterial(password);
  const key = await deriveKey(keyMaterial);
  const iv = data.slice(0, 12);
  const encrypted = data.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  return new Uint8Array(decrypted);
}

function getKeyMaterial(password) {
  return crypto.subtle.importKey(
    "raw",
    textToUint8(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
}

function deriveKey(keyMaterial) {
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: textToUint8("hiddenqr"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// QR Chunking
function chunkData(data, chunkSize) {
  const chunks = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

// QR Rendering
function renderQR(data, stegMode) {
  const canvas = document.createElement("canvas");
  const qr = qrcode(0, "L");
  qr.addData(data);
  qr.make();
  canvas.width = canvas.height = 177;
  const ctx = canvas.getContext("2d");
  const tileW = canvas.width / qr.getModuleCount();
  const tileH = canvas.height / qr.getModuleCount();

  for (let row = 0; row < qr.getModuleCount(); row++) {
    for (let col = 0; col < qr.getModuleCount(); col++) {
      ctx.fillStyle = qr.isDark(row, col) ? "#000" : "#fff";
      ctx.fillRect(col * tileW, row * tileH, tileW, tileH);
    }
  }

  if (stegMode === "grayscale") {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const avg = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
      imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = avg;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

// Video Generation
generateVideoBtn.onclick = async () => {
  let raw = textToUint8(inputData.value);
  const method = compressionMethod.value;
  const steg = stegMethod.value;
  const encrypt = encryptToggle.checked;
  const password = encryptKey.value;

  // Compression
  raw = compressData(raw, method);

  // Encryption
  if (encrypt && password) {
    raw = await encryptData(raw, password);
  }

  // Chunking
  const chunks = chunkData(raw, 1000); // conservative QR payload size
  const canvases = chunks.map((chunk, i) => {
    const payload = `${i}|${chunks.length}|${Array.from(chunk).join(",")}`;
    return renderQR(payload, steg);
  });

  // Record video
  const stream = canvases[0].getContext("2d").canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  const chunksOut = [];

  recorder.ondataavailable = (e) => chunksOut.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunksOut, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    previewVideo.src = url;
    downloadLink.href = url;
    downloadLink.style.display = "inline-block";
  };

  recorder.start();

  let frameIndex = 0;
  const ctx = canvases[0].getContext("2d");
  const interval = setInterval(() => {
    if (frameIndex >= canvases.length) {
      clearInterval(interval);
      recorder.stop();
      return;
    }
    ctx.drawImage(canvases[frameIndex], 0, 0);
    frameIndex++;
  }, 1000 / 30);
};
// Video Decoding
decodeVideoBtn.onclick = async () => {
  const file = videoInput.files[0];
  if (!file) return;

  const steg = stegMethod.value;
  const decrypt = decryptKey.value;
  const method = compressionMethod.value;

  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const chunks = [];
  let frameCount = 0;

  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    video.play();
  };

  video.onplay = () => {
    const interval = setInterval(() => {
      if (video.paused || video.ended) {
        clearInterval(interval);
        processChunks(chunks, decrypt, method);
        return;
      }

      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, canvas.width, canvas.height);

      if (result && result.data) {
        chunks.push(result.data);
      }

      frameCount++;
    }, 1000 / 30);
  };
};

// Reassemble Payload
async function processChunks(frames, password, compression) {
  const totalFrames = frames.length;
  const sorted = new Array(totalFrames);

  for (const frame of frames) {
    const [index, total, data] = frame.split("|");
    const bytes = new Uint8Array(data.split(",").map(Number));
    sorted[parseInt(index)] = bytes;
  }

  let combined = new Uint8Array(sorted.reduce((acc, chunk) => acc + chunk.length, 0));
  let offset = 0;
  for (const chunk of sorted) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Decrypt
  if (password) {
    try {
      combined = await decryptData(combined, password);
    } catch (e) {
      outputData.value = "Decryption failed. Check your password.";
      return;
    }
  }

  // Decompress
  try {
    combined = decompressData(combined, compression);
  } catch (e) {
    outputData.value = "Decompression failed.";
    return;
  }

  outputData.value = uint8ToText(combined);
}
