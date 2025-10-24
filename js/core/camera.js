// ================================================================
// /js/core/camera.js — 사진 촬영 및 미리보기 / Base64 업로드 지원
// ================================================================
(function () {
  /**
   * 전역 상태 — 사진 Base64 데이터 저장
   */
  globalThis.selectedCabinetPhoto320 = null;
  globalThis.selectedCabinetPhoto160 = null;

  // ------------------------------------------------------------
  // 1️⃣ 파일 선택 업로드
  // ------------------------------------------------------------
  const fileInput = document.getElementById("cabinet-photo-input");
  const previewBox = document.getElementById("cabinet-photo-preview");

  if (fileInput && previewBox) {
    const selectBtn = document.getElementById("cabinet-photo-btn");
    if (selectBtn) {
      selectBtn.addEventListener("click", () => fileInput.click());
    }

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result;
        updatePhotoPreview(base64Data);
        processAndStorePhoto(base64Data);
      };
      reader.readAsDataURL(file);
    });
  }

  // ------------------------------------------------------------
  // 2️⃣ 카메라 촬영
  // ------------------------------------------------------------
  const cameraBtn = document.getElementById("cabinet-camera-btn");
  const cameraModal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-view");
  const captureBtn = document.getElementById("capture-btn");
  const cancelBtn = document.getElementById("cancel-camera-btn");
  const canvas = document.getElementById("photo-canvas");

  let stream = null;

  if (cameraBtn && cameraModal && video && captureBtn && cancelBtn) {
    cameraBtn.addEventListener("click", async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        cameraModal.style.display = "flex";
      } catch (err) {
        console.error("📸 카메라 접근 실패:", err);
        alert("카메라 접근을 허용해주세요.");
      }
    });

    captureBtn.addEventListener("click", async () => {
      if (!canvas || !video) return;
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const base64Data = canvas.toDataURL("image/jpeg");
      stopCameraStream();
      cameraModal.style.display = "none";

      updatePhotoPreview(base64Data);
      await processAndStorePhoto(base64Data);
    });

    cancelBtn.addEventListener("click", () => {
      stopCameraStream();
      cameraModal.style.display = "none";
    });
  }

  // ------------------------------------------------------------
  // 3️⃣ 공용 유틸 — 카메라 종료
  // ------------------------------------------------------------
  function stopCameraStream() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
  }

  // ------------------------------------------------------------
  // 4️⃣ 공용 유틸 — 미리보기 업데이트
  // ------------------------------------------------------------
  function updatePhotoPreview(base64Data) {
    if (!previewBox) return;
    previewBox.innerHTML = `<img src="${base64Data}" alt="사진 미리보기" style="width:100%; height:100%; object-fit:cover;">`;
  }

  // ------------------------------------------------------------
  // 5️⃣ 공용 유틸 — Base64 리사이즈 후 전역 저장
  // ------------------------------------------------------------
  async function processAndStorePhoto(base64Data) {
    try {
      const resized320 = await resizeBase64(base64Data, 320);
      const resized160 = await resizeBase64(base64Data, 160);

      globalThis.selectedCabinetPhoto320 = resized320;
      globalThis.selectedCabinetPhoto160 = resized160;

      console.log("📷 Base64 저장 완료:", {
        "320px": resized320?.length,
        "160px": resized160?.length,
      });
    } catch (err) {
      console.error("📸 사진 처리 중 오류:", err);
    }
  }

  // ------------------------------------------------------------
  // 6️⃣ 이미지 리사이즈 (canvas 기반)
  // ------------------------------------------------------------
  function resizeBase64(base64, size) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = size / Math.max(img.width, img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = base64;
    });
  }

  // ------------------------------------------------------------
  // 7️⃣ 전역 노출
  // ------------------------------------------------------------
  globalThis.updatePhotoPreview = updatePhotoPreview;
  globalThis.processAndStorePhoto = processAndStorePhoto;
  globalThis.resizeBase64 = resizeBase64;
})();
