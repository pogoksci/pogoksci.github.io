// ================================================================
// /js/ui/forms.js — 폼 상태/UI 관리 (App.Forms)
// ================================================================
(function () {
  console.log("🧾 App.Forms 모듈 로드됨");

  const { setupButtonGroup, makePayload } = App.Utils;
  const { set, reset, dump } = App.State;
  const { start: startCamera, setupModalListeners, processImage, updatePreview } = App.Camera;
  const supabase = App.Supabase;

  // -------------------------------------------------
  // 💾 시약장 저장
  // -------------------------------------------------
  async function handleSave() {
    try {
      const state = dump();
      const payload = await makePayload(state);
      if (!payload.cabinet_name) return alert("시약장 이름을 입력하거나 선택하세요.");
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
  // 🧭 시약장 폼 초기화
  // -------------------------------------------------
  async function initCabinetForm(mode = "create", detail = null) {
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
    ["area-button-group", "cabinet_name_buttons", "door_vertical_split_buttons", "door_horizontal_split_buttons", "shelf_height_buttons", "storage_columns_buttons"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) setupButtonGroup(id, (btn) => set(id.replace("_buttons", ""), btn.dataset.value));
    });

    // ✅ 사진 처리
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
          set("photo_320_base64", resized.base64_320);
          set("photo_160_base64", resized.base64_160);
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
  // 🧪 약품 등록/수정 폼 초기화 (+도어/단/열 자동 표시)
  // -------------------------------------------------
  async function initInventoryForm(mode = "create", detail = null) {
    console.log("🧪 initInventoryForm()", mode, detail);
    reset();
    set("mode", mode);

    const title = document.querySelector("#inventory-form h1");
    const submitBtn = document.getElementById("inventory-submit-button");
    const statusMsg = document.getElementById("statusMessage");
    if (title) title.textContent = mode === "edit" ? "약품 정보 수정" : "약품 입고 정보 입력";

    // ✅ 수정 모드 기본 데이터 반영
    if (mode === "edit" && detail) {
      ["cas_rn", "purchase_volume", "concentration_value", "purchase_date"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = detail[id]?.split?.("T")[0] || detail[id] || "";
      });
      if (detail.photo_url_320) {
        const preview = document.getElementById("photo-preview");
        preview.innerHTML = `<img src="${detail.photo_url_320}" alt="Preview">`;
      }
    }

    // ✅ 버튼 그룹 초기화 및 복원
    ["classification_buttons", "state_buttons", "unit_buttons", "concentration_unit_buttons", "manufacturer_buttons"].forEach((id) => {
      setupButtonGroup(id, (btn) => {
        const key = id.replace("_buttons", "");
        set(key, btn.dataset.value);
        if (id === "manufacturer_buttons") {
          const group = document.getElementById("other_manufacturer_group");
          if (btn.dataset.value === "기타") group.style.display = "block";
          else group.style.display = "none";
        }
      });
      if (mode === "edit" && detail) {
        const key = id.replace("_buttons", "");
        const val = detail[key];
        if (val) {
          const btn = document.querySelector(`#${id} button[data-value="${val}"]`);
          if (btn) btn.classList.add("active");
          set(key, val);
        }
      }
    });

    // ✅ 사진 처리
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
        set("photo_base64", src);
      };
      reader.readAsDataURL(file);
    };
    if (photoBtn && photoInput) photoBtn.onclick = () => photoInput.click();
    if (cameraBtn && cameraInput) cameraBtn.onclick = () => cameraInput.click();
    if (photoInput) photoInput.onchange = (e) => handleFile(e.target.files[0]);
    if (cameraInput) cameraInput.onchange = (e) => handleFile(e.target.files[0]);

    // ✅ 위치 (Area → Cabinet → 도어/단/열)
    const areaSelect = document.getElementById("location_area_select");
    const cabSelect = document.getElementById("location_cabinet_select");

    if (areaSelect && supabase) {
      const { data: areas } = await supabase.from("Area").select("id, name").order("name");
      if (areas?.length) {
        areaSelect.innerHTML += areas.map((a) => `<option value="${a.id}">${a.name}</option>`).join("");
      }

      // 수정모드: area/cabinet 복원
      if (mode === "edit" && detail.area_id) {
        areaSelect.value = detail.area_id;
        const { data: cabs } = await supabase.from("Cabinet").select("*").eq("area_id", detail.area_id);
        cabSelect.innerHTML =
          `<option value="">-- 선택 안 함 --</option>` +
          (cabs || []).map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
        cabSelect.disabled = false;
        if (detail.cabinet_id) cabSelect.value = detail.cabinet_id;
        await renderCabinetButtons(detail.cabinet_id, detail);
      }

      areaSelect.onchange = async (e) => {
        const areaId = e.target.value;
        set("area_id", areaId);
        cabSelect.disabled = !areaId;
        if (!areaId) {
          cabSelect.innerHTML = `<option value="">-- 선택 안 함 --</option>`;
          return;
        }
        const { data: cabs } = await supabase.from("Cabinet").select("*").eq("area_id", areaId);
        cabSelect.innerHTML =
          `<option value="">-- 선택 안 함 --</option>` +
          (cabs || []).map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
      };
    }

    if (cabSelect) {
      cabSelect.onchange = async (e) => {
        const cabId = e.target.value;
        set("cabinet_id", cabId);
        await renderCabinetButtons(cabId, null);
      };
    }

    // ✅ 저장 로직
    if (submitBtn) {
      submitBtn.onclick = async (e) => {
        e.preventDefault();
        statusMsg.textContent = "💾 저장 중...";

        try {
          const state = dump();
          const payload = {
            cas_rn: document.getElementById("cas_rn").value.trim(),
            classification: state.classification,
            state: state.state,
            purchase_volume: document.getElementById("purchase_volume").value || null,
            unit: state.unit,
            concentration_value: document.getElementById("concentration_value").value || null,
            concentration_unit: state.concentration_unit,
            manufacturer: state.manufacturer === "기타"
              ? document.getElementById("manufacturer_other").value.trim()
              : state.manufacturer,
            purchase_date: document.getElementById("purchase_date").value || null,
            area_id: state.area_id || null,
            cabinet_id: state.cabinet_id || null,
            door_vertical: state.door_vertical || null,
            door_horizontal: state.door_horizontal || null,
            internal_shelf_level: state.internal_shelf_level || null,
            storage_column: state.storage_column || null,
            photo_base64: state.photo_base64 || null,
            created_at: new Date().toISOString(),
          };

          if (!payload.cas_rn) {
            alert("CAS 번호는 필수 입력 항목입니다.");
            statusMsg.textContent = "";
            return;
          }

          if (mode === "edit" && detail?.id) {
            const { error } = await supabase.from("Inventory").update(payload).eq("id", detail.id);
            if (error) throw error;
            alert("✅ 약품 정보가 수정되었습니다.");
          } else {
            const { error } = await supabase.from("Inventory").insert(payload);
            if (error) throw error;
            alert("✅ 약품이 성공적으로 등록되었습니다.");
          }

          await App.includeHTML("pages/inventory-list.html", "form-container");
          App.Inventory.loadList();
        } catch (err) {
          console.error("❌ 저장 오류:", err);
          statusMsg.textContent = "❌ 저장 실패. 콘솔을 확인하세요.";
        }
      };
    }

    console.log(`✅ 약품 폼 초기화 완료 (${mode})`);
  }

  // -------------------------------------------------
  // 🧩 도어·단·열 버튼 렌더링
  // -------------------------------------------------
  async function renderCabinetButtons(cabinetId, detail = null) {
    if (!cabinetId) return;
    const { data, error } = await supabase.from("Cabinet").select("*").eq("id", cabinetId).maybeSingle();
    if (error || !data) return console.warn("⚠️ 캐비닛 정보 없음");

    const vBox = document.getElementById("location_door_vertical_group");
    const hBox = document.getElementById("location_door_horizontal_group");
    const sBox = document.getElementById("location_internal_shelf_group");
    const cBox = document.getElementById("location_storage_column_group");

    const makeBtns = (n, key) =>
      Array.from({ length: n }, (_, i) => `<button type="button" data-value="${i + 1}">${i + 1}</button>`).join("");

    if (vBox && data.door_vertical) {
      vBox.innerHTML = makeBtns(data.door_vertical, "door_vertical");
      setupButtonGroup("location_door_vertical_group", (btn) => set("door_vertical", btn.dataset.value));
      if (detail?.door_vertical)
        vBox.querySelector(`button[data-value="${detail.door_vertical}"]`)?.classList.add("active");
    }

    if (hBox && data.door_horizontal) {
      hBox.innerHTML = makeBtns(data.door_horizontal, "door_horizontal");
      setupButtonGroup("location_door_horizontal_group", (btn) => set("door_horizontal", btn.dataset.value));
      if (detail?.door_horizontal)
        hBox.querySelector(`button[data-value="${detail.door_horizontal}"]`)?.classList.add("active");
    }

    if (sBox && data.internal_shelf_level) {
      sBox.innerHTML = makeBtns(data.internal_shelf_level, "internal_shelf_level");
      setupButtonGroup("location_internal_shelf_group", (btn) => set("internal_shelf_level", btn.dataset.value));
      if (detail?.internal_shelf_level)
        sBox.querySelector(`button[data-value="${detail.internal_shelf_level}"]`)?.classList.add("active");
    }

    if (cBox && data.storage_column) {
      cBox.innerHTML = makeBtns(data.storage_column, "storage_column");
      setupButtonGroup("location_storage_column_group", (btn) => set("storage_column", btn.dataset.value));
      if (detail?.storage_column)
        cBox.querySelector(`button[data-value="${detail.storage_column}"]`)?.classList.add("active");
    }
  }

  // -------------------------------------------------
  // 전역 등록
  // -------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.Forms = {
    initCabinetForm,
    initInventoryForm,
    handleSave,
  };

  console.log("✅ App.Forms 모듈 초기화 완료 (도어 자동 표시 버전)");
})();
