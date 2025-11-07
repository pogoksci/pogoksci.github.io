// ================================================================
// /js/ui/forms.js — 폼 상태/UI 관리 (App.Forms)
// ================================================================
(function () {
  console.log("🧾 App.Forms 모듈 로드됨");

  // -------------------------------------------------
  // 전역 유틸 및 모듈 참조
  // -------------------------------------------------
  const { setupButtonGroup, makePayload } = App.Utils;
  const { set, get, reset, dump } = App.State;
  const { start: startCamera, setupModalListeners, processImage, updatePreview } = App.Camera;
  const supabase = App.Supabase; // ✅ Supabase 인스턴스

  // -------------------------------------------------
  // 💾 시약장 저장 (등록/수정)
  // -------------------------------------------------
  async function handleSave() {
    try {
      const state = dump();
      const payload = await makePayload(state);
      console.log("💾 시약장 payload:", payload);

      if (!payload.cabinet_name) return alert("시약장 이름을 선택하거나 입력하세요.");
      if (!payload.area_name) return alert("시약장 위치를 선택하세요.");

      if (state.mode === "create") {
        await App.Cabinet.createCabinet(payload);
        alert("✅ 시약장이 등록되었습니다.");
      } else {
        await App.Cabinet.updateCabinet(state.cabinetId, payload);
        alert("✅ 시약장 정보가 수정되었습니다.");
      }

      await App.includeHTML("pages/location-list.html", "form-container");
      App.Cabinet.loadList?.();
    } catch (err) {
      console.error("❌ handleSave 오류:", err);
      alert("저장 중 오류가 발생했습니다.");
    }
  }

  // -------------------------------------------------
  // 🧭 시약장 폼 초기화 (등록/수정 공용)
  // -------------------------------------------------
  async function initCabinetForm(mode = "create", detail = null) {
    console.log("🧭 initCabinetForm()", mode, detail);

    await App.includeHTML("pages/cabinet-form.html", "form-container");

    reset();
    set("mode", mode);
    if (detail) {
      Object.entries(detail).forEach(([k, v]) => set(k, v));
      set("cabinetId", detail.id);
      set("area_id", detail.area_id?.id || null);
      set("area_custom_name", detail.area_id?.name || null);
      set("cabinet_name", detail.name);
    }

    const title = document.querySelector("#cabinet-creation-form h2");
    const submitBtn = document.getElementById("cabinet-submit-button");
    const saveBtn = document.getElementById("cabinet-save-btn");
    const cancelBtn = document.getElementById("cancel-form-btn");

    if (title) title.textContent = mode === "edit" ? `${detail?.name || "시약장"} 정보 수정` : "시약장 등록";

    if (mode === "edit") {
      if (submitBtn) submitBtn.style.display = "none";
      if (saveBtn) {
        saveBtn.style.display = "inline-block";
        saveBtn.onclick = (e) => {
          e.preventDefault();
          handleSave();
        };
      }
    } else {
      if (submitBtn) {
        submitBtn.style.display = "inline-block";
        submitBtn.onclick = (e) => {
          e.preventDefault();
          handleSave();
        };
      }
      if (saveBtn) saveBtn.style.display = "none";
    }

    if (cancelBtn) cancelBtn.onclick = () => App.includeHTML("pages/location-list.html");

    // ✅ 버튼 그룹 초기화
    (function initButtonGroups() {
      const areaGroupEl = document.getElementById("area-button-group");
      const cabGroupEl = document.getElementById("cabinet_name_buttons");
      if (!areaGroupEl || !cabGroupEl) return;

      setupButtonGroup("area-button-group", (btn) => {
        areaGroupEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const val = btn.dataset.value;
        const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;

        if (val === "기타") {
          App.State.set("area_id", null);
          App.State.set("area", "기타");
          document.getElementById("area-other-group")?.classList.add("show");
          setTimeout(() => document.getElementById("area-other-input")?.focus(), 0);
        } else {
          App.State.set("area_id", id);
          App.State.set("area", val);
          App.State.set("area_custom_name", null);
          document.getElementById("area-other-group").style.display = "none";
        }
      });

      setupButtonGroup("cabinet_name_buttons", (btn) => {
        cabGroupEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const val = btn.dataset.value;

        if (val === "기타") {
          App.State.set("cabinet_name_buttons", "기타");
          document.getElementById("cabinet-other-group")?.classList.add("show");
          setTimeout(() => document.getElementById("cabinet-other-input")?.focus(), 0);
        } else {
          App.State.set("cabinet_name_buttons", val);
          document.getElementById("cabinet-other-group")?.classList.remove("show");
        }
      });

      ["door_vertical_split_buttons", "door_horizontal_split_buttons", "shelf_height_buttons", "storage_columns_buttons"].forEach((id) => {
        setupButtonGroup(id, (btn) => {
          const key = id.replace("_buttons", "");
          App.State.set(key, btn.dataset.value);
        });
      });
    })();

    // ✅ 사진/카메라
    const photoInput = document.getElementById("cabinet-photo-input");
    const cameraInput = document.getElementById("cabinet-camera-input");
    const previewBox = document.getElementById("cabinet-photo-preview");
    const cameraBtn = document.getElementById("cabinet-camera-btn");
    const photoBtn = document.getElementById("cabinet-photo-btn");

    const handleFile = (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        processImage(e.target.result, (resized) => {
          App.State.set("photo_320_base64", resized.base64_320);
          App.State.set("photo_160_base64", resized.base64_160);
          previewBox.innerHTML = `<img src="${resized.base64_320}" alt="Preview">`;
        });
      };
      reader.readAsDataURL(file);
    };

    if (photoBtn && photoInput) photoBtn.onclick = () => photoInput.click();
    if (cameraBtn && typeof startCamera === "function") cameraBtn.onclick = () => startCamera();
    setupModalListeners?.();
    if (photoInput) photoInput.onchange = (e) => handleFile(e.target.files[0]);
    if (cameraInput) cameraInput.onchange = (e) => handleFile(e.target.files[0]);

    if (mode === "edit" && detail?.photo_url_320) updatePreview(detail.photo_url_320, "cabinet-photo-preview");

    console.log(`✅ 시약장 폼 초기화 완료 (${mode})`);
  }

  // -------------------------------------------------
  // 🧪 약품 등록/수정 폼 초기화
  // -------------------------------------------------
  async function initInventoryForm(mode = "create", detail = null) {
    console.log("🧪 initInventoryForm()", mode, detail);
    App.State.reset();
    App.State.set("mode", mode);

    const title = document.querySelector("#inventory-form h1");
    const submitBtn = document.getElementById("inventory-submit-button");
    const statusMsg = document.getElementById("statusMessage");
    if (title) title.textContent = mode === "edit" ? "약품 정보 수정" : "약품 입고 정보 입력";

    // ✅ 수정 모드 시 기존 값 반영
    if (mode === "edit" && detail) {
      for (const [key, val] of Object.entries(detail)) {
        const el = document.querySelector(`[name='${key}']`);
        if (el) el.value = val ?? "";
      }
      if (detail.photo_url_320) {
        const preview = document.getElementById("photo-preview");
        preview.innerHTML = `<img src="${detail.photo_url_320}" alt="Preview">`;
      }
    }

    // ✅ 저장 버튼
    if (submitBtn) {
      submitBtn.onclick = async (e) => {
        e.preventDefault();
        statusMsg.textContent = "💾 저장 중...";
        try {
          const payload = await App.Utils.makePayload(App.State.dump());
          console.log("💾 약품 payload:", payload);

          if (mode === "edit" && detail?.id) {
            await App.Inventory.updateInventory(detail.id, payload);
            alert("✅ 약품 정보가 수정되었습니다.");
          } else {
            await App.Inventory.createInventory(payload);
            alert("✅ 새 약품이 등록되었습니다.");
          }

          await App.includeHTML("pages/inventory-list.html", "form-container");
          App.Inventory.loadList();
        } catch (err) {
          console.error("❌ 저장 오류:", err);
          statusMsg.textContent = "❌ 저장 실패. 콘솔을 확인하세요.";
        }
      };
    }

    // ✅ 버튼 그룹 (분류, 상태, 단위 등)
    ["classification_buttons", "state_buttons", "unit_buttons", "concentration_unit_buttons", "manufacturer_buttons"].forEach((id) => {
      App.Utils.setupButtonGroup(id, (btn) => {
        const key = id.replace("_buttons", "");
        App.State.set(key, btn.dataset.value);
        if (id === "manufacturer_buttons") {
          const otherGroup = document.getElementById("other_manufacturer_group");
          if (btn.dataset.value === "기타") {
            otherGroup.style.display = "block";
            document.getElementById("manufacturer_other").focus();
          } else {
            otherGroup.style.display = "none";
          }
        }
      });
    });

    // ✅ 사진 업로드
    const photoInput = document.getElementById("photo-input");
    const cameraInput = document.getElementById("camera-input");
    const preview = document.getElementById("photo-preview");
    const photoBtn = document.getElementById("photo-btn");
    const cameraBtn = document.getElementById("camera-btn");

    const handleFile = (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target.result;
        preview.innerHTML = `<img src="${src}" alt="Preview">`;
        App.State.set("photo_base64", src);
      };
      reader.readAsDataURL(file);
    };

    if (photoBtn && photoInput) photoBtn.onclick = () => photoInput.click();
    if (cameraBtn && cameraInput) cameraBtn.onclick = () => cameraInput.click();
    if (photoInput) photoInput.onchange = (e) => handleFile(e.target.files[0]);
    if (cameraInput) cameraInput.onchange = (e) => handleFile(e.target.files[0]);

    // ✅ 위치 선택 (Area / Cabinet)
    const areaSelect = document.getElementById("location_area_select");
    const cabSelect = document.getElementById("location_cabinet_select");

    if (areaSelect && supabase) {
      const { data: areas } = await supabase.from("Area").select("id, name").order("name");
      if (areas?.length) {
        areaSelect.innerHTML += areas.map((a) => `<option value="${a.id}">${a.name}</option>`).join("");
      }

      areaSelect.onchange = async (e) => {
        const areaId = e.target.value;
        App.State.set("area_id", areaId);
        cabSelect.disabled = !areaId;
        if (!areaId) return;
        const { data: cabs } = await supabase.from("Cabinet").select("id, name").eq("area_id", areaId);
        cabSelect.innerHTML =
          `<option value="">-- 선택 안 함 --</option>` +
          (cabs || []).map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
      };
    }

    if (cabSelect) {
      cabSelect.onchange = (e) => App.State.set("cabinet_id", e.target.value);
    }

    console.log(`✅ 약품 폼 초기화 완료 (${mode})`);
  }

  // -------------------------------------------------
  // ✍️ 시약장 폼 데이터 복원
  // -------------------------------------------------
  function applyExistingSelection(detail) {
    const preselect = (groupId, value) => {
      if (value == null) return;
      const btn = document.querySelector(`#${groupId} button[data-value="${value}"]`);
      btn?.classList.add("active");
    };
    preselect("door_vertical_split_buttons", detail.door_vertical_count);
    preselect("door_horizontal_split_buttons", detail.door_horizontal_count);
  }

  // -------------------------------------------------
  // 전역 등록
  // -------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.Forms = {
    initCabinetForm,
    initInventoryForm,
    handleSave,
    applyExistingSelection,
  };

  console.log("✅ App.Forms 모듈 초기화 완료");
})();
