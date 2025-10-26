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

    // ✅ 3️⃣ DOM 요소 가져오기 (이제 폼이 존재함)
    const title = document.querySelector("#cabinet-creation-form h2");
    const submitBtn = document.getElementById("cabinet-submit-button");
    const cancelBtn = document.getElementById("cancel-form-btn");

    // ✅ 4️⃣ 제목, 버튼 텍스트, 이벤트 핸들러
    if (title)
      title.textContent =
        mode === "edit" ? `${detail.name} 정보 수정` : "시약장 등록";

    if (submitBtn) {
      submitBtn.textContent =
        mode === "edit" ? "수정 내용 저장" : "시약장 등록";
      submitBtn.onclick = (e) => {
        e.preventDefault();
        handleSave();
      };
    }

    if (cancelBtn)
      cancelBtn.onclick = () =>
        App.Router?.go?.("cabinets") ??
        App.includeHTML("pages/location-list.html");

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
      })
    );

    if (App.Fab && typeof App.Fab.bindEvents === "function") {
      App.Fab.bindEvents(); // 필요 시 FAB 관련 버튼 재활성화
    }

    // ✅ 6️⃣ edit 모드일 경우 기존 선택 반영 (그대로 유지)
    if (mode === "edit" && detail) applyExistingSelection(detail);

    // ✅ 기존 사진 미리보기 표시
    if (mode === "edit" && detail?.photo_url_320) {
      updatePhotoPreview(detail.photo_url_320);
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

    // ③ 나머지 선택 항목 자동 반영
    const mapping = [
      { id: "door_vertical_split_buttons", key: "door_vertical_count" },
      { id: "door_horizontal_split_buttons", key: "door_horizontal_count" },
      { id: "shelf_height_buttons", key: "shelf_height" },
      { id: "storage_columns_buttons", key: "storage_columns" },
    ];

    mapping.forEach(({ id, key }) => {
      const value = String(detail[key]).trim();

      // 모든 버튼의 data-value와 비교
      document.querySelectorAll(`#${id} button`).forEach(btn => {
        const btnValue = btn.dataset.value?.trim();
        if (btnValue === value || btnValue.includes(value)) {
          btn.classList.add("active");
        }
      });
    });
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.Forms = { initCabinetForm, handleSave, applyExistingSelection };
})();
