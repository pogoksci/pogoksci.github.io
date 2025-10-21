// js/core/camera.js
(function () {
  let stream = null;

  async function startCamera() {
    const modal = document.getElementById("camera-modal");
    const view = document.getElementById("camera-view");

    if (!navigator.mediaDevices?.getUserMedia) {
      alert("브라우저가 카메라를 지원하지 않습니다.");
      return;
    }

    try {
      modal.style.display = "flex";
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      view.srcObject = stream;
    } catch (err) {
      alert("카메라 접근 오류: " + err.message);
      stopCamera();
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    const modal = document.getElementById("camera-modal");
    if (modal) modal.style.display = "none";
  }

  async function takePicture(targetPreviewId = "photo-preview") {
    const canvas = document.getElementById("photo-canvas");
    const view = document.getElementById("camera-view");
    const preview = document.getElementById(targetPreviewId);
    if (!view || !canvas) return null;

    canvas.width = view.videoWidth;
    canvas.height = view.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(view, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/png");

    const resized = await resizeImage(base64, 320);
    preview.innerHTML = `<img src="${resized}" alt="preview">`;

    stopCamera();
    return resized;
  }

  async function resizeImage(base64, size) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const aspect = img.width / img.height;
        let w = size,
          h = size;
        if (aspect > 1) h = size / aspect;
        else w = size * aspect;
        canvas.width = size;
        canvas.height = size;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
    });
  }

  globalThis.App = globalThis.App || {};
  App.Camera = { startCamera, stopCamera, takePicture, resizeImage };
})();
