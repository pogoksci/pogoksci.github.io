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

    // ✅ 6️⃣ edit 모드일 경우 기존 선택 반영 (그대로 유지)
    if (mode === "edit" && detail) applyExistingSelection(detail);

    console.log(`✅ 시약장 폼 초기화 완료 (${mode})`);
  }

  function applyExistingSelection(detail) {
    const areaBtn = document.querySelector(`#area-button-group button[data-value="${detail.area_id?.name}"]`);
    if (areaBtn) areaBtn.classList.add("active");

    const nameBtn = document.querySelector(`#cabinet_name_buttons button[data-value="${detail.name}"]`);
    if (nameBtn) {
      nameBtn.classList.add("active");
      document.querySelectorAll("#cabinet_name_buttons button").forEach((b) => (b.disabled = true));
    }
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.Forms = { initCabinetForm, handleSave, applyExistingSelection };
})();
