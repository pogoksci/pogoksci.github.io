// ================================================================
// /js/core/camera.js — 카메라 촬영 + 파일 업로드 + Base64 리사이즈 (전역 호출형)
// ================================================================
(function () {
  globalThis.App = globalThis.App || {};

  let stream = null;

  // ------------------------------------------------------------
  // 📸 1️⃣ startCamera — 카메라 실행 (forms.js나 cabinet.js에서 호출 가능)
  // ------------------------------------------------------------
  async function startCamera() {
    const modal = document.getElementById("camera-modal");
    const video = document.getElementById("camera-view");

    if (!modal || !video) {
      alert("카메라 모달 요소를 찾을 수 없습니다.");
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      video.srcObject = stream;
      modal.style.display = "flex";
    } catch (err) {
        console.error("📸 카메라 접근 실패:", err);
        if (err.name === "NotAllowedError") {
            alert("카메라 접근 권한이 차단되었습니다.\n브라우저 및 운영체제의 카메라 권한 설정을 확인해주세요.");
        } else if (err.name === "NotFoundError") {
            alert("컴퓨터에 연결된 카메라를 찾을 수 없습니다.");
        } else {
            alert("카메라를 시작하는 중 알 수 없는 오류가 발생했습니다.");
        }
    }
  }

  // ------------------------------------------------------------
  // 🧹 3️⃣ 카메라 종료
  // ------------------------------------------------------------
  function stopCameraStream() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
  }

  // ------------------------------------------------------------
  // 🖼️ 4️⃣ 미리보기 업데이트
  // ------------------------------------------------------------
  function updatePreview(base64Data, previewId = "cabinet-photo-preview") {
    // ⬇️ [수정됨] 어떤 폼인지 스스로 판단
    const formId = globalThis.App.State.get('mode') === 'create' ? 'inventory-form' : 'cabinet-creation-form';
    const form = document.getElementById(formId);
    if (!form) return;

    const previewBox = form.querySelector(`#${previewId}`);
    if (previewBox) {
        previewBox.innerHTML = `<img src="${base64Data}" alt="사진 미리보기" style="width:100%;height:100%;object-fit:cover;">`;
    }
  }

  // ------------------------------------------------------------
  // 🔧 6️⃣ 리사이즈 유틸
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
  // 🧩 5️⃣ 이미지 리사이즈 및 Base64 저장
  // ------------------------------------------------------------
  async function processAndStorePhoto(base64Data) {
    try {
      const resized320 = await resizeBase64(base64Data, 320);
      const resized160 = await resizeBase64(base64Data, 160);
        App.State.set("photo_320_base64", resized320);
        App.State.set("photo_160_base64", resized160);
      console.log("📷 Base64 저장 완료:");
    } catch (err) {
      console.error("📸 사진 처리 중 오류:", err);
    }
  }

  // ------------------------------------------------------------
  // 📷 2️⃣ setupModalListeners — 모달 버튼 이벤트 (촬영, 취소)
  // ------------------------------------------------------------
  function setupModalListeners() {
    const modal = document.getElementById("camera-modal");
    const video = document.getElementById("camera-view");
    const canvas = document.getElementById("photo-canvas");
    const captureBtn = document.getElementById("capture-btn");
    const cancelBtn = document.getElementById("cancel-camera-btn");

    if (!modal || !video || !canvas || !captureBtn || !cancelBtn) return;

    captureBtn.onclick = async () => {
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const base64 = canvas.toDataURL("image/jpeg");
      stopCameraStream();
      modal.style.display = "none";

      // ⬇️ [수정됨] App.Camera 객체를 통해 함수 호출
        App.Camera.updatePreview(base64); 
        await App.Camera.processImage(base64);
    };

    cancelBtn.onclick = () => {
      stopCameraStream();
      modal.style.display = "none";
    };
  }

  // ------------------------------------------------------------
  // 🌍 7️⃣ 전역 등록 (forms.js/cabinet.js 모두에서 사용 가능)
  // ------------------------------------------------------------
  globalThis.App.Camera = {
    start: startCamera,
    setupModalListeners: setupModalListeners,
    updatePreview: updatePreview,
    processImage: processImage,
    resizeBase64: resizeBase64
  };
})();
