// ================================================================
// /js/ui/forms.js — 폼 상태/UI 관리 (App.Forms)
// ================================================================
(function () {
  const { setupButtonGroup, makePayload } = App.Utils;
  const { set, get, reset, dump } = App.State;

  async function handleSave() {
    try {
      const state = dump();
      const payload = makePayload(state);

      if (!payload.name) return alert("시약장 이름을 선택하거나 입력하세요.");
      if (!payload.area_id) return alert("시약장 위치를 선택하세요.");

      if (state.mode === "create") {
        await App.Cabinet.createCabinet(payload);
        alert("✅ 시약장이 등록되었습니다.");
      } else {
        await App.Cabinet.updateCabinet(state.cabinetId, payload);
        alert("✅ 시약장 정보가 수정되었습니다.");
      }
      await App.includeHTML("pages/location-list.html", "form-container");
    } catch (err) {
      console.error("❌ handleSave 오류:", err);
      alert("저장 중 오류가 발생했습니다.");
    }
  }

  async function initCabinetForm(mode = "create", detail = null) {
    console.log("🧭 initCabinetForm()", mode, detail);

    // ✅ 1️⃣ 폼 HTML을 먼저 로드 (이게 핵심 변경점)
    await App.includeHTML("pages/cabinet-form.html", "form-container");

    // ✅ 카메라 모달 리스너 재설정 (새 폼 로드 후 다시 연결)
    if (typeof setupCameraModalListeners === "function") {
      setupCameraModalListeners();
    }

    // ✅ 파일 업로드 버튼(예: <input type="file" id="photo-upload">) 이벤트도 추가
    const fileInput = document.getElementById("photo-upload");
    if (fileInput) {
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const base64 = ev.target.result;
          updatePhotoPreview(base64);
          await processAndStorePhoto(base64);
        };
        reader.readAsDataURL(file);
      };
    }

    // ✅ 2️⃣ 기존 초기화 로직 그대로 유지
    reset();
    set("mode", mode);
    if (detail) Object.entries(detail).forEach(([k, v]) => set(k, v));
    if (mode === 'edit') set("cabinetId", detail.id);

    // ✅ 3️⃣ DOM 요소 가져오기 (이제 폼이 존재함)
    const title = document.querySelector("#cabinet-creation-form h2");
    const submitBtn = document.getElementById("cabinet-submit-button");
    const saveBtn = document.getElementById("cabinet-save-btn"); // 수정 버튼
    const cancelBtn = document.getElementById("cancel-form-btn");

    // ✅ 4️⃣ 제목, 버튼 텍스트, 이벤트 핸들러
    if (title)
      title.textContent =
        mode === "edit" ? `${detail.name} 정보 수정` : "시약장 등록";

    // 등록/수정 버튼 표시 및 이벤트 연결
    if (mode === "edit") {
        if (submitBtn) submitBtn.style.display = "none";
        if (saveBtn) {
            saveBtn.style.display = "inline-block";
            saveBtn.onclick = (e) => { e.preventDefault(); handleSave(); };
        }
    } else {
        if (submitBtn) {
            submitBtn.style.display = "inline-block";
            submitBtn.onclick = (e) => { e.preventDefault(); handleSave(); };
        }
        if (saveBtn) saveBtn.style.display = "none";
    }

    if (cancelBtn)
      cancelBtn.onclick = () => App.includeHTML("pages/location-list.html");

    // ✅ 5️⃣ 버튼 그룹 초기화 (그대로 유지)
    [
      "area-button-group",
      "cabinet_name_buttons",
      "door_vertical_split_buttons",
      "door_horizontal_split_buttons",
      "shelf_height_buttons",
      "storage_columns_buttons",
    ].forEach((id) =>
      setupButtonGroup(id, (btn) => {
        const key = id.replace("_buttons", "");
        App.State.set(key, btn.dataset.value);
        if (id === 'area-button-group') {
            App.State.set('area_id', btn.dataset.id ? parseInt(btn.dataset.id) : null);
        }
      })
    );

    // ⬇️ [수정됨] 6️⃣ 사진/카메라 기능 초기화 (올바른 ID 사용)
    const photoInput = document.getElementById("cabinet-photo-input");
    const cameraInput = document.getElementById("cabinet-camera-input");
    const previewBox = document.getElementById("cabinet-photo-preview");
    const cameraBtn = document.getElementById("cabinet-camera-btn");
    const photoBtn = document.getElementById("cabinet-photo-btn");

    if (photoBtn && photoInput) {
        photoBtn.onclick = () => photoInput.click();
    }
    if (cameraBtn && typeof App.Camera.start === "function") {
        cameraBtn.onclick = () => App.Camera.start();
    }
    if (typeof App.Camera.setupModalListeners === "function") {
        App.Camera.setupModalListeners();
    }

    const handleFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            App.Camera.processImage(e.target.result, (resized) => {
                App.State.set("photo_320_base64", resized.base64_320);
                App.State.set("photo_160_base64", resized.base64_160);
                if (previewBox) {
                    previewBox.innerHTML = `<img src="${resized.base64_320}" alt="Preview">`;
                }
            });
        };
        reader.readAsDataURL(file);
    };

    if (photoInput) photoInput.onchange = (e) => handleFile(e.target.files[0]);
    if (cameraInput) cameraInput.onchange = (e) => handleFile(e.target.files[0]);
    
    // ✅ 7️⃣ edit 모드일 경우 기존 선택 반영
    if (mode === "edit" && detail) {
        applyExistingSelection(detail);
        if (detail.photo_url_320) {
            App.Camera.updatePreview(detail.photo_url_320, 'cabinet-photo-preview');
        }
    }

    console.log(`✅ 시약장 폼 초기화 완료 (${mode})`);

    // ✅ 1️⃣ 위치 기타 버튼
    const areaOtherBtn = document.getElementById("area-other-btn");
    const areaOtherGroup = document.getElementById("area-other-group");
    const areaOtherInput = document.getElementById("area-other-input");

    if (areaOtherBtn && areaOtherGroup && areaOtherInput) {
      areaOtherBtn.addEventListener("click", () => {
        document.querySelectorAll("#area-button-group button").forEach(btn => btn.classList.remove("active"));
        areaOtherBtn.classList.add("active");
        areaOtherGroup.style.display = "block";
        areaOtherInput.focus();
        App.State.set("area_id", "기타");
      });

      areaOtherInput.addEventListener("input", (e) => {
        App.State.set("area_custom_name", e.target.value.trim());
      });

      // ✅ 다른 버튼 클릭 시 입력창 숨김
      document.querySelectorAll("#area-button-group button:not(#area-other-btn)").forEach(btn => {
        btn.addEventListener("click", () => {
          areaOtherGroup.style.display = "none";
        });
      });
    }

    // ✅ 2️⃣ 시약장 이름 기타 버튼
    const cabinetOtherBtn = document.getElementById("cabinet-other-btn");
    const cabinetOtherGroup = document.getElementById("cabinet-other-group");
    const cabinetOtherInput = document.getElementById("cabinet-other-input");

    if (cabinetOtherBtn && cabinetOtherGroup && cabinetOtherInput) {
      cabinetOtherBtn.addEventListener("click", () => {
        document.querySelectorAll("#cabinet_name_buttons button").forEach(btn => btn.classList.remove("active"));
        cabinetOtherBtn.classList.add("active");
        cabinetOtherGroup.style.display = "block";
        cabinetOtherInput.focus();
        App.State.set("cabinet_name", "기타");
      });

      cabinetOtherInput.addEventListener("input", (e) => {
        App.State.set("cabinet_custom_name", e.target.value.trim());
      });
    }

    document.querySelectorAll("#area-button-group button:not(#area-other-btn)").forEach(btn => {
      btn.addEventListener("click", () => {
        const otherGroup = document.getElementById("area-other-group");
        if (otherGroup) otherGroup.style.display = "none";
      });
    });

    // ✅ 다른 시약장 이름 버튼 클릭 시 기타 입력란 숨김
    document.querySelectorAll("#cabinet_name_buttons button:not(#cabinet-other-btn)").forEach(btn => {
      btn.addEventListener("click", () => {
        const otherGroup = document.getElementById("cabinet-other-group");
        if (otherGroup) otherGroup.style.display = "none";
      });
    });
  }

  function applyExistingSelection(detail) {
    console.log("🎯 applyExistingSelection", detail);

    // ① 장소 버튼
    if (detail.area_id?.name === "기타") {
      const otherGroup = document.getElementById("area-other-group");
      const otherInput = document.getElementById("area-other-input");
      const btn = document.getElementById("area-other-btn");
      if (btn) btn.classList.add("active");
      if (otherGroup && otherInput) {
        otherGroup.style.display = "block";
        otherInput.value = detail.area_id?.custom_name || "";
      }
    } else {
      const areaBtn = document.querySelector(
        `#area-button-group button[data-value="${detail.area_id?.name}"]`
      );
      if (areaBtn) areaBtn.classList.add("active");
    }

     // ② 시약장 이름 버튼
    if (detail.name === "기타") {
      const otherGroup = document.getElementById("cabinet-other-group");
      const otherInput = document.getElementById("cabinet-other-input");
      const btn = document.getElementById("cabinet-other-btn");
      if (btn) btn.classList.add("active");
      if (otherGroup && otherInput) {
        otherGroup.style.display = "block";
        otherInput.value = detail.cabinet_custom_name || "";
      }
    } else {
      const nameBtn = document.querySelector(
        `#cabinet_name_buttons button[data-value="${detail.name}"]`
      );
      if (nameBtn) {
        nameBtn.classList.add("active");
        // 이름은 수정 불가
        document
          .querySelectorAll("#cabinet_name_buttons button")
          .forEach((b) => (b.disabled = true));
      }
    }

    // ⬇️ [수정됨] ③ 나머지 선택 항목 자동 반영 (맵 사용)
    const verticalMap = { 3: "상중하도어", 2: "상하도어", 1: "단일도어(상하분리없음)" };
    const horizontalMap = { 2: "좌우분리도어", 1: "단일도어" };

    const preselect = (groupId, value) => {
        if (value == null) return;
        const btn = document.querySelector(`#${groupId} button[data-value="${value}"]`);
        if (btn) btn.classList.add("active");
    };

    preselect("door_vertical_split_buttons", verticalMap[detail.door_vertical_count]);
    preselect("door_horizontal_split_buttons", horizontalMap[detail.door_horizontal_count]);
    preselect("shelf_height_buttons", detail.shelf_height?.toString());
    preselect("storage_columns_buttons", detail.storage_columns?.toString());
}

  globalThis.App = globalThis.App || {};
  globalThis.App.Forms = { initCabinetForm, handleSave, applyExistingSelection };
})();
