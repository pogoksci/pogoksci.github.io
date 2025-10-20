// ====================================================================
// 카메라 및 이미지 처리 관련 함수
// ====================================================================
let cameraStream = null;

async function startCamera() {
  const cameraModal = document.getElementById("camera-modal");
  const cameraView = document.getElementById("camera-view");
  if (!cameraModal || !cameraView) return;

  cameraModal.style.display = "flex";
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    cameraView.srcObject = cameraStream;
  } catch (err) {
    alert("카메라 접근 실패: " + err.message);
    stopCamera();
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  const cameraModal = document.getElementById("camera-modal");
  if (cameraModal) cameraModal.style.display = "none";
}

function takePicture() {
  const cameraView = document.getElementById("camera-view");
  const canvas = document.getElementById("photo-canvas");
  if (!cameraView || !canvas) return;

  canvas.width = cameraView.videoWidth;
  canvas.height = cameraView.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(cameraView, 0, 0);
  const base64 = canvas.toDataURL("image/png");

  processImage(base64, (resized) => {
    const preview = document.getElementById("photo-preview");
    preview.innerHTML = `<img src="${resized.base64_320}">`;
  });
  stopCamera();
}

function resizeToFit(img, size) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const ratio = img.width / img.height;
  let w = size, h = size;
  if (ratio > 1) h = size / ratio; else w = size * ratio;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/png");
}

function processImage(base64, cb) {
  const img = new Image();
  img.src = base64;
  img.onload = () => {
    cb({ base64_320: resizeToFit(img, 320), base64_160: resizeToFit(img, 160) });
  };
}
