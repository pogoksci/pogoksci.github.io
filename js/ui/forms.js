// ================================================================
// /js/ui/forms.js — 폼 상태/UI 관리 (App.Forms)
// ================================================================
(function () {
  console.log("🧾 App.Forms 모듈 로드됨");

  const { setupButtonGroup, makePayload } = App.Utils;
  const { set, reset, dump, get } = App.State;
  const { start: startCamera, setupModalListeners, processImage } = App.Camera;
  const supabase = App.supabase;

  // -------------------------------------------------
  // 💾 시약장 저장
  // -------------------------------------------------

  // -------------------------------------------------
  // 🧮 공병 질량 계산 함수
  // -------------------------------------------------
  function calculateBottleMass(volume, type) {
    if (!volume || !type) return null;

    const v = Number(volume);
    const t = String(type).trim().replace(/\s+/g, ""); // 공백 제거

    // 1. 유리 (갈색유리, 투명유리)
    if (t.includes("유리")) {
      if (v === 25) return 65;
      if (v === 100) return 120;
      if (v === 500) return 400;
      if (v === 1000) return 510;
    }

    // 2. 플라스틱
    if (t.includes("플라스틱")) {
      if (v === 500) {
        if (t.includes("반투명")) return 40;
        if (t.includes("갈색")) return 80;
        if (t.includes("흰색")) return 75;
      }
    }

    return null; // 매칭되는 조건 없음
  }
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
  // 🧭 시약장 폼 초기화 (create / edit 모드 완전 복원)
  // -------------------------------------------------
  async function initCabinetForm(mode = "create", detail = null) {
    await App.includeHTML("pages/cabinet-form.html", "form-container");
    reset();
    set("mode", mode);

    // ✅ state 세팅
    if (detail) {
      Object.entries(detail).forEach(([k, v]) => set(k, v));
      set("cabinetId", detail.id);
      set("area_id", detail.area_id?.id || null);
      set("area_custom_name", detail.area_id?.area_name || null);
      set("cabinet_name", detail.cabinet_name);
    }

    // ------------------------------------------------------------
    // 제목 & 버튼 제어
    // ------------------------------------------------------------
    const title = document.querySelector("#cabinet-creation-form h2");
    const submitBtn = document.getElementById("cabinet-submit-button");
    const saveBtn = document.getElementById("cabinet-save-btn");
    const cancelBtn = document.getElementById("cancel-form-btn");

    if (title)
      title.textContent =
        mode === "edit"
          ? `${detail?.cabinet_name || "시약장"} 정보 수정`
          : "시약장 등록";

    if (mode === "edit") {
      if (submitBtn) submitBtn.style.display = "none";
      if (saveBtn) {
        saveBtn.style.display = "inline-block";
        saveBtn.onclick = (e) => {
          e.preventDefault();
          console.log("📌 State before payload:", App.State.dump());
          handleSave();
        };
      }
    } else {
      if (submitBtn) {
        submitBtn.style.display = "inline-block";
        submitBtn.onclick = (e) => {
          e.preventDefault();
          console.log("📌 State before payload:", App.State.dump());
          handleSave();
        };
      }
      if (saveBtn) saveBtn.style.display = "none";
    }

    if (cancelBtn)
      cancelBtn.onclick = () => App.includeHTML("pages/location-list.html");

    // ------------------------------------------------------------
    // 1️⃣ 장소 버튼 그룹 (기타 처리)
    // ------------------------------------------------------------
    const areaGroup = document.getElementById("area-button-group");
    const areaOtherGroup = document.getElementById("area-other-group");
    const areaOtherInput = document.getElementById("area-other-input");

    if (areaGroup) {
      setupButtonGroup("area-button-group", (btn) => {
        const value = btn.dataset.value?.trim() || btn.textContent.trim();

        if (value === "기타") {
          areaOtherGroup.style.display = "block";
          areaOtherInput.value = "";
          areaOtherInput.focus();
          set("area_custom_name", "");
          set("area_buttons", null);
        } else {
          areaOtherGroup.style.display = "none";
          set("area_buttons", value);
          set("area_custom_name", null);
        }
      });

      // 입력란 직접 타이핑 시 State 동기화
      areaOtherInput.addEventListener("input", (e) => {
        set("area_custom_name", e.target.value.trim());
      });
    }

    // ------------------------------------------------------------
    // 2️⃣ 시약장 이름 버튼 그룹 (기타 처리)
    // ------------------------------------------------------------
    const cabGroup = document.getElementById("cabinet_name_buttons");
    const cabOtherGroup = document.getElementById("cabinet_other-group");
    const cabOtherInput = document.getElementById("cabinet_other_input");

    if (cabGroup) {
      setupButtonGroup("cabinet_name_buttons", (btn) => {
        const value = btn.dataset.value?.trim() || btn.textContent.trim();

        if (value === "기타") {
          cabOtherGroup.style.display = "block";
          cabOtherInput.value = "";
          cabOtherInput.focus();
          set("cabinet_custom_name", "");
          set("cabinet_name_buttons", null);
        } else {
          cabOtherGroup.style.display = "none";
          set("cabinet_name_buttons", value);
          set("cabinet_custom_name", null);
        }
      });

      // 입력란 직접 타이핑 시 State 동기화
      cabOtherInput.addEventListener("input", (e) => {
        set("cabinet_custom_name", e.target.value.trim());
      });
    }

    // ------------------------------------------------------------
    // 3️⃣ 사진 업로드 처리
    // ------------------------------------------------------------
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
          previewBox.innerHTML = `<img src="${resized.base64_320}" alt="시약장 사진">`;
        });
      };
      reader.readAsDataURL(file);
    };

    if (photoBtn && photoInput) photoBtn.onclick = () => photoInput.click();
    if (cameraBtn && typeof startCamera === "function")
      cameraBtn.onclick = () => startCamera();
    setupModalListeners?.();
    if (photoInput) photoInput.onchange = (e) => handleFile(e.target.files[0]);
    if (cameraInput) cameraInput.onchange = (e) => handleFile(e.target.files[0]);

    // ------------------------------------------------------------
    // 4️⃣ edit 모드 — 기존 값 복원
    // ------------------------------------------------------------
    if (mode === "edit" && detail) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // 🏷 장소 복원
          const areaName = detail.area_id?.area_name;
          const areaBtns = document.querySelectorAll("#area-button-group button");
          let areaMatched = false;
          areaBtns.forEach((btn) => {
            if (btn.textContent.trim() === areaName) {
              btn.classList.add("active");
              areaMatched = true;
            }
          });
          if (!areaMatched && areaOtherGroup) {
            areaOtherGroup.style.display = "block";
            areaOtherInput.value = areaName || "";

            // ✅ 기타 버튼도 눌린 상태로 표시
            const areaOtherBtn = document.querySelector("#area-button-group button[data-value='기타']");
            if (areaOtherBtn) areaOtherBtn.classList.add("active");
          }

          // 🏷 시약장 이름 복원
          const cabBtns = document.querySelectorAll("#cabinet_name_buttons button");
          let cabMatched = false;
          cabBtns.forEach((btn) => {
            if (btn.textContent.trim() === detail.cabinet_name) {
              btn.classList.add("active");
              cabMatched = true;
            }
          });
          if (!cabMatched && cabOtherGroup) {
            cabOtherGroup.style.display = "block";
            cabOtherInput.value = detail.cabinet_name || "";

            // ✅ 시약장 이름의 기타 버튼도 눌린 상태로 표시
            const cabOtherBtn = document.querySelector("#cabinet_name_buttons button[data-value='기타']");
            if (cabOtherBtn) cabOtherBtn.classList.add("active");
          }

          // 🧱 도어/선반/열 복원 (edit 모드)
          const vLabelByNum = { 1: "단일도어(상하분리없음)", 2: "상하도어", 3: "상중하도어" };
          const hLabelByNum = { 1: "단일도어", 2: "좌우분리도어" };

          // 4️⃣ 외부 도어의 상하분리 형태
          document.querySelectorAll("#door_vertical_split_buttons button").forEach((btn) => {
            const label = (btn.dataset.value || btn.textContent).trim();
            const need = vLabelByNum[Number(detail.door_vertical_count)];
            if (label === need) btn.classList.add("active");
          });

          // 5️⃣ 외부 도어의 좌우분리 형태
          document.querySelectorAll("#door_horizontal_split_buttons button").forEach((btn) => {
            const label = (btn.dataset.value || btn.textContent).trim();
            const need = hLabelByNum[Number(detail.door_horizontal_count)];
            if (label === need) btn.classList.add("active");
          });

          // 6️⃣ 선반 층수
          document.querySelectorAll("#shelf_height_buttons button").forEach((btn) => {
            const val = Number(btn.dataset.value);
            if (val === Number(detail.shelf_height)) btn.classList.add("active");
          });

          // 7️⃣ 수납 열 수
          document.querySelectorAll("#storage_columns_buttons button").forEach((btn) => {
            const val = Number(btn.dataset.value);
            if (val === Number(detail.storage_columns)) btn.classList.add("active");
          });

          // 🖼 사진 복원 (비율 유지)
          if (detail.photo_url_320 || detail.photo_url_160) {
            const url = detail.photo_url_320 || detail.photo_url_160;
            previewBox.innerHTML = `<img src="${url}" alt="시약장 사진">`;
          } else {
            previewBox.innerHTML = `<span>사진 없음</span>`;
          }

          // ✅ edit 모드에서도 버튼 클릭이 가능하도록 이벤트 재연결
          [
            "door_vertical_split_buttons",
            "door_horizontal_split_buttons",
            "shelf_height_buttons",
            "storage_columns_buttons"
          ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
              setupButtonGroup(id, (btn) => {
                const value = btn.dataset.value || btn.textContent.trim();
                set(id.replace("_buttons", ""), value);
              });
            }
          });
        });
      });
    }

    console.log(`✅ 시약장 폼 초기화 완료 (${mode})`);
  }

  // -------------------------------------------------
  // 🧪 약품 등록/수정 폼 초기화 (+도어/단/열 자동 표시)
  // -------------------------------------------------
  async function initInventoryForm(mode = "create", detail = null) {
    console.log("🧪 initInventoryForm()", mode, detail);
    reset();
    set("mode", mode);

    if (mode === "edit" && detail) {
      console.log("📝 Edit Mode Detail:", detail);
    }

    const title = document.querySelector("#inventory-form h1");
    const submitBtn = document.getElementById("inventory-submit-button");
    const statusMsg = document.getElementById("statusMessage");
    if (title) title.textContent = mode === "edit" ? "약품 정보 수정" : "약품 입고 정보 입력";

    const BUTTON_GROUP_IDS = [
      "classification_buttons",
      "state_buttons",
      "unit_buttons",
      "concentration_unit_buttons",
      "unit_buttons",
      "bottle_type_buttons", // ✅ 추가
      "concentration_unit_buttons",
      "manufacturer_buttons",
    ];

    // ✅ Substance 정보 저장 (계산용)
    if (detail?.Substance) {
      set("substance_info", detail.Substance);
    } else {
      set("substance_info", null);
    }

    // ✅ 수정 모드 기본 데이터 반영
    if (mode === "edit" && detail) {
      const fieldMap = {
        cas_rn: detail.Substance?.cas_rn ?? "",
        purchase_volume: detail.initial_amount ?? "",
        concentration_value: detail.concentration_value ?? "",
        purchase_date: detail.purchase_date ?? "",
      };

      Object.entries(fieldMap).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const normalized = typeof value === "string" ? value.split("T")[0] : value ?? "";
        el.value = normalized;
        set(id, normalized);
      });

      const existingPhoto = detail.photo_url_320 || detail.photo_url_160 || null;
      if (existingPhoto) {
        const preview = document.getElementById("photo-preview");
        if (preview) {
          preview.innerHTML = `<img src="${existingPhoto}" alt="Preview">`;
        }
        set("photo_base64", existingPhoto);
      }
      set("photo_updated", false);
    } else {
      const clearInputs = ["cas_rn", "purchase_volume", "concentration_value", "purchase_date", "manufacturer_other"];
      clearInputs.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.value = "";
          el.setAttribute("value", ""); // DOM 속성도 강제 초기화
        }
      });
      BUTTON_GROUP_IDS.forEach((groupId) => {
        const group = document.getElementById(groupId);
        if (group) group.querySelectorAll(".active").forEach((btn) => btn.classList.remove("active"));
      });
      ["classification", "state", "unit", "bottle_type", "concentration_unit", "manufacturer"].forEach((key) => set(key, null));
      const otherGroup = document.getElementById("other_manufacturer_group");
      if (otherGroup) otherGroup.style.display = "none";
      const otherInput = document.getElementById("manufacturer_other");
      if (otherInput) otherInput.value = "";
      set("msds_pdf_file", null);
      set("photo_base64", null);
      set("photo_updated", false);
    }

    // ✅ 버튼 그룹 초기화 및 복원
    const buttonFieldMap = {
      classification_buttons: (d) => d?.classification ?? null,
      state_buttons: (d) => d?.state ?? null,
      unit_buttons: (d) => d?.unit ?? null,
      bottle_type_buttons: (d) => d?.bottle_type ?? null, // ✅ 추가 (DB에 bottle_type 컬럼이 없어도 state 관리를 위해 사용 권장, 현재는 bottle_mass만 저장하지만 UI 복원을 위해 필요하다면 bottle_type도 저장해야 함. 사용자 요청은 bottle_mass만 저장. 하지만 UI 복원을 위해 bottle_type도 어딘가 저장하거나, bottle_mass 역산은 불가능하므로 bottle_type도 저장하는 것이 좋음. 일단 요청대로 bottle_mass만 저장하고, UI 복원은 생략하거나 추후 논의. -> 아, "조합조건은 나중에 수정할 수도 있으니까" 라고 했으니 bottle_type도 저장하는게 맞을듯? 아니면 bottle_mass만 저장하라고 했으니... 일단 UI state는 관리해야 함.)
      // *수정*: 사용자가 "db에 저장을 할 때에는 버튼 값을 저장하는게 아니고... bottle_mass 컬럼에 저장할거야" 라고 명시함.
      // 즉, bottle_type 컬럼은 없을 가능성이 높음. 그렇다면 Edit 모드에서 이 버튼을 어떻게 복원하지?
      // 복원 못함. (bottle_mass만으로는 역산 불가).
      // 사용자 의도는 "입력 편의"를 위한 도구로 보임. Edit 모드에서 복원 안 되어도 되는지?
      // 일단 state에는 저장해서 "등록" 시에는 계산되게 함. Edit 시에는 빈 값으로 둠.
      concentration_unit_buttons: (d) => d?.concentration_unit ?? null,
      manufacturer_buttons: (d) => d?.manufacturer ?? null,
    };

    Object.entries(buttonFieldMap).forEach(([groupId, getter]) => {
      const stateKey = groupId.replace("_buttons", "");
      setupButtonGroup(groupId, (btn) => {
        set(stateKey, btn.dataset.value);
        if (groupId === "manufacturer_buttons") {
          const group = document.getElementById("other_manufacturer_group");
          if (group) group.style.display = btn.dataset.value === "기타" ? "block" : "none";
        }
      });

      if (mode === "edit" && detail) {
        const raw = getter(detail);
        const normalizedValue = raw == null ? "" : String(raw).trim();
        if (!normalizedValue) return;
        const buttons = Array.from(document.querySelectorAll(`#${groupId} button`));
        const sanitize = (v) => v.replace(/\s+/g, "").toLowerCase();
        let targetBtn = buttons.find((btn) => {
          const candidate = (btn.dataset.value || btn.textContent || "").trim();
          return candidate === normalizedValue;
        });
        if (!targetBtn) {
          targetBtn = buttons.find((btn) => {
            const candidate = (btn.dataset.value || btn.textContent || "").trim();
            return sanitize(candidate) === sanitize(normalizedValue);
          });
        }
        if (targetBtn) {
          buttons.forEach((btn) => btn.classList.remove("active"));
          targetBtn.classList.add("active");
          const appliedValue = targetBtn.dataset.value || targetBtn.textContent.trim();
          set(stateKey, appliedValue);
          if (groupId === "manufacturer_buttons") {
            const group = document.getElementById("other_manufacturer_group");
            if (group) group.style.display = appliedValue === "기타" ? "block" : "none";
            if (appliedValue === "기타") {
              const otherInput = document.getElementById("manufacturer_other");
              if (otherInput && normalizedValue !== "기타") otherInput.value = normalizedValue;
            }
          }
        } else if (groupId === "manufacturer_buttons") {
          const otherBtn = document.querySelector(`#${groupId} button[data-value="기타"]`);
          if (otherBtn) {
            buttons.forEach((btn) => btn.classList.remove("active"));
            otherBtn.classList.add("active");
            set("manufacturer", "기타");
            const otherInput = document.getElementById("manufacturer_other");
            if (otherInput) otherInput.value = normalizedValue;
            const group = document.getElementById("other_manufacturer_group");
            if (group) group.style.display = "block";
          }
        }
      }
    });


    // ✅ Bottle Type Restoration (from bottle_mass)
    if (mode === "edit" && detail && detail.bottle_mass && detail.initial_amount) {
      const mass = Number(detail.bottle_mass);
      const vol = Number(detail.initial_amount);
      let restoredType = null;

      // Reverse logic of calculateBottleMass
      // Glass: 25->65, 100->120, 500->400, 1000->510
      if ((vol === 25 && mass === 65) ||
        (vol === 100 && mass === 120) ||
        (vol === 500 && mass === 400) ||
        (vol === 1000 && mass === 510)) {
        // Default to Brown Glass as it's common. User can change if needed.
        restoredType = "갈색유리";
      }
      // Plastic: 500->(40, 80, 75)
      else if (vol === 500) {
        if (mass === 40) restoredType = "반투명플라스틱";
        else if (mass === 80) restoredType = "갈색플라스틱";
        else if (mass === 75) restoredType = "흰색플라스틱";
      }

      if (restoredType) {
        const btn = document.querySelector(`#bottle_type_buttons button[data-value="${restoredType}"]`);
        if (btn) {
          document.querySelectorAll(`#bottle_type_buttons button`).forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          set("bottle_type", restoredType);
        }
      }
    }

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
        set("photo_updated", true);
      };
      reader.readAsDataURL(file);
    };
    if (photoBtn && photoInput) photoBtn.onclick = () => photoInput.click();
    if (cameraBtn && typeof startCamera === "function") {
      cameraBtn.onclick = () => startCamera();
      setupModalListeners?.();
    } else if (cameraBtn && cameraInput) {
      cameraBtn.onclick = () => cameraInput.click();
    }
    if (photoInput) photoInput.onchange = (e) => handleFile(e.target.files[0]);
    if (cameraInput) cameraInput.onchange = (e) => handleFile(e.target.files[0]);

    // ✅ MSDS PDF 처리
    const msdsInput = document.getElementById("msds-pdf-input");
    if (msdsInput) {
      msdsInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 10 * 1024 * 1024) {
            alert("파일 크기는 10MB 이하여야 합니다.");
            msdsInput.value = "";
            set("msds_pdf_file", null);
            return;
          }
          set("msds_pdf_file", file);
        }
      };
    }

    // ✅ 위치 (Area → Cabinet → 도어/단/열)
    const areaSelect = document.getElementById("location_area_select");
    const cabSelect = document.getElementById("location_cabinet_select");

    if (areaSelect && cabSelect && supabase) {
      const defaultAreaOptions =
        (areaSelect.__defaultOptions ?? areaSelect.innerHTML) ||
        `<option value="">-- 선택 안 함 --</option>`;
      areaSelect.__defaultOptions = defaultAreaOptions;

      const { data: areas } = await supabase.from("Area").select("id, area_name").order("area_name");
      areaSelect.innerHTML =
        defaultAreaOptions +
        (areas?.map?.((a) => `<option value="${a.id}">${a.area_name}</option>`).join("") || "");

      if (mode === "edit" && detail) {
        const areaId = detail.area_id || detail.Cabinet?.area_id || detail.Cabinet?.Area?.id || null;
        if (areaId) {
          areaSelect.value = areaId;
          set("area_id", areaId);

          const { data: cabs } = await supabase.from("Cabinet").select("*").eq("area_id", areaId);
          cabSelect.innerHTML =
            `<option value="">-- 선택 안 함 --</option>` +
            (cabs || []).map(({ id, cabinet_name }) => `<option value="${id}">${cabinet_name}</option>`).join("");
          cabSelect.disabled = false;

          const cabinetId = detail.cabinet_id || detail.Cabinet?.id || null;
          if (cabinetId) {
            cabSelect.value = cabinetId;
            set("cabinet_id", cabinetId);
          }

          ["door_vertical", "door_horizontal", "internal_shelf_level", "storage_column"].forEach((key) => {
            let value = detail[key] ?? null;
            if (key === "door_vertical") value = normalizeChoice(value, "vertical");
            if (key === "door_horizontal") value = normalizeChoice(value, "horizontal");
            set(key, value);
          });
          const normalizedDetail = {
            ...detail,
            door_vertical: get("door_vertical"),
            door_horizontal: get("door_horizontal"),
            internal_shelf_level: get("internal_shelf_level"),
            storage_column: get("storage_column"),
          };
          await renderCabinetButtons(cabinetId, normalizedDetail);
        }
      }

      areaSelect.onchange = async (e) => {
        const areaId = e.target.value || null;
        set("area_id", areaId);
        cabSelect.disabled = !areaId;
        if (!areaId) {
          cabSelect.innerHTML = `<option value="">-- 선택 안 함 --</option>`;
          set("cabinet_id", null);
          ["door_vertical", "door_horizontal", "internal_shelf_level", "storage_column"].forEach((key) => set(key, null));
          await renderCabinetButtons(null, null);
          return;
        }
        const { data: cabs } = await supabase.from("Cabinet").select("*").eq("area_id", areaId);
        cabSelect.innerHTML =
          `<option value="">-- 선택 안 함 --</option>` +
          (cabs || []).map((c) => `<option value="${c.id}">${c.cabinet_name}</option>`).join("");
        cabSelect.value = "";
        set("cabinet_id", null);
        ["door_vertical", "door_horizontal", "internal_shelf_level", "storage_column"].forEach((key) => set(key, null));
        await renderCabinetButtons(null, null);
      };
    }

    if (cabSelect) {
      cabSelect.onchange = async (e) => {
        const cabId = e.target.value;
        set("cabinet_id", cabId || null);
        ["door_vertical", "door_horizontal", "internal_shelf_level", "storage_column"].forEach((key) => set(key, null));
        await renderCabinetButtons(cabId || null, null);
      };
    }
  }

  // ✅ 스크롤 상단 강제 이동 (수정 모드 진입 시 하단으로 튀는 문제 방지)
  window.scrollTo(0, 0);

  // ✅ 저장 로직
  if (submitBtn) {
    submitBtn.onclick = async (e) => {
      e.preventDefault();
      statusMsg.textContent = "💾 저장 중...";

      try {
        const state = dump();
        const cas = document.getElementById("cas_rn").value.trim();
        const volumeValue = document.getElementById("purchase_volume").value;
        const volume = Number.parseFloat(volumeValue);
        const unit = state.unit;
        const concentrationValue = document.getElementById("concentration_value").value;
        const concentrationUnit = state.concentration_unit;

        if (!cas) {
          alert("CAS 번호는 필수 입력 항목입니다.");
          statusMsg.textContent = "";
          return;
        }

        if (!Number.isFinite(volume) || volume <= 0) {
          alert("구입용량을 바르게 입력해 주세요.");
          statusMsg.textContent = "";
          return;
        }

        if (!unit) {
          alert("구입용량 단위를 선택해 주세요.");
          statusMsg.textContent = "";
          return;
        }

        const manufacturerValue =
          state.manufacturer === "기타"
            ? document.getElementById("manufacturer_other").value.trim() || null
            : state.manufacturer || null;
        const purchaseDate = document.getElementById("purchase_date").value || null;
        const inventoryDetails = {
          purchase_volume: volume,
          unit,
          state: state.state || null,
          classification: state.classification || null,
          manufacturer: manufacturerValue,
          purchase_date: purchaseDate,
          cabinet_id: state.cabinet_id || null,
          door_vertical: state.door_vertical || null,
          door_horizontal: state.door_horizontal || null,
          internal_shelf_level: state.internal_shelf_level || null,
          storage_column: state.storage_column || null,
          concentration_value: concentrationValue ? Number(concentrationValue) : null,
          concentration_unit: concentrationUnit || null,
          bottle_mass: calculateBottleMass(volume, state.bottle_type), // ✅ 공병 질량 계산 및 저장
        };

        // 📤 MSDS PDF 업로드
        // MSDS PDF 처리 (Deduplication Logic)
        if (state.msds_pdf_file) {
          statusMsg.textContent = "📄 MSDS PDF 처리 중...";
          try {
            const file = state.msds_pdf_file;

            // 1. 해시 계산
            const arrayBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            console.log("File Hash:", hashHex);

            // 2. 중복 확인
            const { data: existingFile } = await supabase
              .from('Inventory')
              .select('msds_pdf_url')
              .eq('msds_pdf_hash', hashHex)
              .limit(1)
              .maybeSingle();

            if (existingFile?.msds_pdf_url) {
              console.log("♻️ Duplicate file found. Reusing URL:", existingFile.msds_pdf_url);
              inventoryDetails.msds_pdf_url = existingFile.msds_pdf_url;
              inventoryDetails.msds_pdf_hash = hashHex;
            } else {
              // 3. 업로드
              console.log("📤 New file. Uploading...");
              const fileExt = file.name.split('.').pop();
              const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

              const { data: _uploadData, error: uploadError } = await supabase.storage
                .from('msds-pdf')
                .upload(fileName, file);

              if (uploadError) throw uploadError;

              const { data: publicUrlData } = supabase.storage
                .from('msds-pdf')
                .getPublicUrl(fileName);

              inventoryDetails.msds_pdf_url = publicUrlData.publicUrl;
              inventoryDetails.msds_pdf_hash = hashHex;
              console.log("✅ MSDS PDF Uploaded:", inventoryDetails.msds_pdf_url);
            }
          } catch (err) {
            console.error("PDF Processing Error:", err);
            alert("MSDS PDF 처리 중 오류가 발생했습니다: " + err.message);
            statusMsg.textContent = "";
            return;
          }
        } else if (mode === "edit" && detail?.msds_pdf_url) {
          // 수정 모드이고 새 파일이 없으면 기존 URL/Hash 유지
          inventoryDetails.msds_pdf_url = detail.msds_pdf_url;
          inventoryDetails.msds_pdf_hash = detail.msds_pdf_hash; // 기존 해시 유지 (필요시 detail 조회 쿼리 수정 필요)
        }


        if (state.photo_base64) {
          inventoryDetails.photo_320_base64 = state.photo_base64;
          inventoryDetails.photo_160_base64 = state.photo_base64;
        }

        if (mode === "edit" && detail?.id) {
          // ✅ 사용량 조회 및 current_amount 재계산
          let totalUsage = 0;
          const { data: usageLogs, error: usageError } = await supabase
            .from("UsageLog")
            .select("amount")
            .eq("inventory_id", detail.id);

          if (!usageError && usageLogs) {
            totalUsage = usageLogs.reduce((sum, log) => sum + (Number(log.amount) || 0), 0);
          }
          const newCurrentAmount = volume - totalUsage;

          const updatePayload = {
            initial_amount: volume,
            current_amount: newCurrentAmount, // ✅ 재계산된 현재 수량
            unit,
            state: state.state || null,
            classification: state.classification || null,
            manufacturer: manufacturerValue,
            purchase_date: purchaseDate,
            cabinet_id: state.cabinet_id || null,
            door_vertical: state.door_vertical || null,
            door_horizontal: state.door_horizontal || null,
            internal_shelf_level: state.internal_shelf_level || null,
            storage_column: state.storage_column || null,
            concentration_value: concentrationValue ? Number(concentrationValue) : null,
            concentration_unit: concentrationUnit || null,
            bottle_mass: calculateBottleMass(volume, state.bottle_type), // ✅ 공병 질량 계산 및 저장 (수정 시)
            msds_pdf_url: inventoryDetails.msds_pdf_url || null,
            msds_pdf_hash: inventoryDetails.msds_pdf_hash || null, // Hash 추가
          };

          // 🧮 농도 변환 계산 (수정 모드)
          const substanceInfo = state.substance_info;
          if (substanceInfo && concentrationValue && concentrationUnit) {
            const propsList = substanceInfo.Properties || [];
            const getPropVal = (nameKey) => {
              const found = propsList.find((p) => p.name && p.name.toLowerCase().includes(nameKey.toLowerCase()));
              return found ? found.property : null;
            };
            const densityVal = getPropVal("Density");

            const conversions = computeConversions({
              value: concentrationValue,
              unit: concentrationUnit,
              molarMass: substanceInfo.molecular_mass,
              density: densityVal
            });

            const annotateUnit = (unit) => {
              const stateVal = String(state.state || "").trim().toLowerCase();
              const solids = ["파우더", "조각", "비드", "펠렛", "리본", "막대", "벌크", "고체"];
              const isSolid = solids.some((k) => stateVal.includes(k));
              const isGas = stateVal.includes("기체") || stateVal.includes("gas");
              const isLiquid = stateVal === "액체" || stateVal.includes("liquid");
              if (unit === "M" && (isSolid || isGas)) return `${unit} (의미 없음)`;
              if (unit === "m" && (isLiquid || isGas)) return `${unit} (정의 불가)`;
              return unit;
            };

            if (conversions) {
              if (concentrationUnit === "%") {
                updatePayload.converted_concentration_value_1 = conversions.molarity;
                updatePayload.converted_concentration_unit_1 = annotateUnit("M");
                updatePayload.converted_concentration_value_2 = conversions.molality;
                updatePayload.converted_concentration_unit_2 = annotateUnit("m");
              } else if (concentrationUnit === "M" || concentrationUnit === "N") {
                updatePayload.converted_concentration_value_1 = conversions.percent;
                updatePayload.converted_concentration_unit_1 = "%";
                updatePayload.converted_concentration_value_2 = conversions.molality; // Molarity -> Molality logic check
                updatePayload.converted_concentration_unit_2 = annotateUnit("m"); // Wait, logic in detail was: M -> % and Molality
              }
            }
          }
          if (state.photo_updated) {
            updatePayload.photo_url_320 = state.photo_base64 || null;
            updatePayload.photo_url_160 = state.photo_base64 || null;
          }

          // ----------------------------------------------------------------
          // 🆕 Calculate Hazard Flags (Dynamic Update)
          // ----------------------------------------------------------------
          if (substanceInfo) {
            // Helper: Compare concentration with standard
            const compareAndSet = (standardStr) => {
              if (!standardStr) return "-";

              // Determine percentage value to compare
              let percentValue = null;
              if (concentrationUnit === "%") {
                percentValue = Number(concentrationValue);
              } else if (updatePayload.converted_concentration_unit_1 === "%") {
                percentValue = updatePayload.converted_concentration_value_1;
              } else if (updatePayload.converted_concentration_unit_2 === "%") {
                percentValue = updatePayload.converted_concentration_value_2;
              }

              if (percentValue === null || isNaN(percentValue)) return "-";

              // Extract number from standard (e.g., "25%" -> 25)
              const match = standardStr.match(/(\d+(\.\d+)?)/);
              if (!match) return "-";
              const standardVal = parseFloat(match[0]);

              if (percentValue >= standardVal) return "○";
              return "-";
            };

            updatePayload.school_hazardous_chemical = compareAndSet(substanceInfo.school_hazardous_chemical_standard);
            updatePayload.school_accident_precaution_chemical = compareAndSet(substanceInfo.school_accident_precaution_chemical_standard);
            updatePayload.special_health_checkup_hazardous_factor = compareAndSet(substanceInfo.special_health_checkup_hazardous_factor_standard);
            updatePayload.toxic_substance = compareAndSet(substanceInfo.toxic_substance_standard);
            updatePayload.permitted_substance = compareAndSet(substanceInfo.permitted_substance_standard);
            updatePayload.restricted_substance = compareAndSet(substanceInfo.restricted_substance_standard);
            updatePayload.prohibited_substance = compareAndSet(substanceInfo.prohibited_substance_standard);
          }

          const { error } = await supabase.from("Inventory").update(updatePayload).eq("id", detail.id);
          if (error) throw error;
          alert("✅ 약품 정보가 수정되었어요.");
        } else {
          const { data, error } = await supabase.functions.invoke("casimport", {
            method: "POST",
            body: {
              casRns: [cas],
              inventoryDetails,
            },
          });

          if (error) throw error;
          console.log("📦 등록 결과:", data);

          // [Workaround] casimport가 일부 필드(농도, 위치 등)를 누락할 수 있으므로, 생성된 항목을 찾아 다시 업데이트합니다.
          try {
            let createdId = data?.inventoryId || data?.id || data?.[0]?.id;

            if (!createdId) {
              // ID를 반환하지 않는 경우, 가장 최근에 생성된 항목을 조회
              const { data: latest, error: latestError } = await supabase
                .from("Inventory")
                .select("id")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (!latestError && latest) {
                createdId = latest.id;
              }
            }

            if (createdId) {
              const { area_id: _area_id, purchase_volume: _purchase_volume, photo_320_base64: _photo_320_base64, photo_160_base64: _photo_160_base64, ...updatePayload } = inventoryDetails;
              const { error: updateError } = await supabase
                .from("Inventory")
                .update(updatePayload)
                .eq("id", createdId);

              if (updateError) {
                console.warn("⚠️ 추가 정보(농도/위치) 업데이트 실패:", updateError);
              } else {
                console.log("✅ 추가 정보(농도/위치) 업데이트 완료");
              }
            } else {
              console.warn("⚠️ 생성된 Inventory ID를 찾을 수 없어 추가 업데이트를 건너뜁니다.");
            }
          } catch (err) {
            console.warn("⚠️ 추가 업데이트 중 예외 발생:", err);
          }

          alert("✅ 약품이 성공적으로 등록되었어요.");
        }

        await App.Inventory?.showListPage?.();
      } catch (err) {
        console.error("❌ 저장 오류:", err);
        statusMsg.textContent = "❌ 저장 실패. 콘솔을 확인해 주세요.";
      }
    };
  }
  console.log(`✅ 약품 폼 초기화 완료 (${mode})`);
}

  // -------------------------------------------------
  // 🧩 도어·단·열 버튼 렌더링
  // -------------------------------------------------
  function normalizeChoice(value, type) {
  if (value == null) return null;
  if (typeof value === "number") return String(value);
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d+$/.test(str)) return str;
  const digit = str.match(/\d+/);
  if (digit) return digit[0];
  const maps = {
    horizontal: { 왼쪽: "1", 오른쪽: "2", 좌: "1", 우: "2" },
    vertical: { 상: "1", 중: "2", 하: "3" },
  };
  return maps[type]?.[str] || null;
}

async function renderCabinetButtons(cabinetId, detail = null) {
  const vBox = document.getElementById("location_door_vertical_group");
  const hBox = document.getElementById("location_door_horizontal_group");
  const sBox = document.getElementById("location_internal_shelf_group");
  const cBox = document.getElementById("location_storage_column_group");

  const showMessage = (box, msg) => {
    if (box) box.innerHTML = `<span style="color:#888;">${msg}</span>`;
  };

  const resetSteps = () => {
    showMessage(vBox, "수납함 선택 후 표시됩니다.");
    showMessage(hBox, "3번 항목 선택 후 표시됩니다.");
    showMessage(sBox, "4번 항목 선택 후 표시됩니다.");
    showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
  };

  if (!cabinetId) {
    resetSteps();
    return;
  }

  const { data, error } = await supabase.from("Cabinet").select("*").eq("id", cabinetId).maybeSingle();
  if (error || !data) {
    resetSteps();
    return console.warn("⚠️ 캐비닛 정보 없음");
  }

  const verticalCount = Number(data.door_vertical_count || data.door_vertical) || 0;
  const horizontalCount = Number(data.door_horizontal_count || data.door_horizontal) || 0;
  const shelfCount = Number(data.shelf_height || data.internal_shelf_level) || 0;
  const columnCount = Number(data.storage_columns || data.storage_column) || 0;

  const defaults = {
    door_vertical: normalizeChoice(detail?.door_vertical, "vertical"),
    door_horizontal: normalizeChoice(detail?.door_horizontal, "horizontal"),
    internal_shelf_level: detail?.internal_shelf_level || null,
    storage_column: detail?.storage_column || null,
  };

  const renderColumns = () => {
    if (!cBox) return;
    const state = dump();
    if (!state.internal_shelf_level) {
      showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
      return;
    }
    if (!columnCount) {
      showMessage(cBox, "열 정보가 없습니다.");
      return;
    }

    cBox.innerHTML = Array.from({ length: columnCount }, (_, i) => {
      const value = i + 1;
      return `<button type="button" data-value="${value}">${value}열</button>`;
    }).join("");

    setupButtonGroup("location_storage_column_group", (btn) => {
      set("storage_column", btn.dataset.value);
    });

    const selected = defaults.storage_column || state.storage_column;
    if (selected) {
      cBox.querySelector(`button[data-value="${selected}"]`)?.classList.add("active");
      defaults.storage_column = null;
    }
  };

  const renderShelves = () => {
    if (!sBox) return;
    const state = dump();
    if (!state.door_horizontal) {
      showMessage(sBox, "4번 항목 선택 후 표시됩니다.");
      showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
      return;
    }
    if (!shelfCount) {
      showMessage(sBox, "선반 정보가 없습니다.");
      showMessage(cBox, "선반 정보가 없습니다.");
      return;
    }

    sBox.innerHTML = Array.from({ length: shelfCount }, (_, idx) => {
      const labelNum = shelfCount - idx;
      const value = labelNum;
      const label = `${labelNum}단`;
      return `<button type="button" data-value="${value}">${label}</button>`;
    }).join("");

    setupButtonGroup("location_internal_shelf_group", (btn) => {
      set("internal_shelf_level", btn.dataset.value);
      set("storage_column", null);
      renderColumns();
    });

    const selected = defaults.internal_shelf_level || state.internal_shelf_level;
    if (selected) {
      sBox.querySelector(`button[data-value="${selected}"]`)?.classList.add("active");
      set("internal_shelf_level", selected);
      defaults.internal_shelf_level = null;
      renderColumns();
    } else {
      showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
    }
  };

  const renderHorizontal = () => {
    if (!hBox) return;
    const state = dump();
    if (!state.door_vertical) {
      showMessage(hBox, "3번 항목 선택 후 표시됩니다.");
      showMessage(sBox, "4번 항목 선택 후 표시됩니다.");
      showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
      return;
    }
    if (!horizontalCount) {
      showMessage(hBox, "좌우 정보가 없습니다.");
      showMessage(sBox, "좌우 정보가 없습니다.");
      showMessage(cBox, "좌우 정보가 없습니다.");
      return;
    }

    const horizontalLabels =
      horizontalCount === 1 ? ["문"] : ["왼쪽", "오른쪽"];
    hBox.innerHTML = Array.from({ length: horizontalCount }, (_, idx) => {
      const value = idx + 1;
      const label = horizontalLabels[idx] || `${value}구역`;
      return `<button type="button" data-value="${value}">${label}</button>`;
    }).join("");

    setupButtonGroup("location_door_horizontal_group", (btn) => {
      set("door_horizontal", btn.dataset.value);
      set("internal_shelf_level", null);
      set("storage_column", null);
      renderShelves();
    });

    const selected = defaults.door_horizontal || state.door_horizontal;
    if (selected) {
      hBox.querySelector(`button[data-value="${selected}"]`)?.classList.add("active");
      set("door_horizontal", selected);
      defaults.door_horizontal = null;
      renderShelves();
    } else {
      showMessage(sBox, "4번 항목 선택 후 표시됩니다.");
      showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
    }
  };

  const renderVertical = () => {
    if (!vBox) return;
    if (!verticalCount) {
      showMessage(vBox, "문 정보가 없습니다.");
      resetSteps();
      return;
    }

    vBox.innerHTML = Array.from({ length: verticalCount }, (_, idx) => {
      const value = idx + 1;
      const label = `${verticalCount - idx}층`;
      return `<button type="button" data-value="${value}">${label}</button>`;
    }).join("");

    setupButtonGroup("location_door_vertical_group", (btn) => {
      set("door_vertical", btn.dataset.value);
      set("door_horizontal", null);
      set("internal_shelf_level", null);
      set("storage_column", null);
      renderHorizontal();
    });

    const selected = defaults.door_vertical;
    if (selected) {
      vBox.querySelector(`button[data-value="${selected}"]`)?.classList.add("active");
      set("door_vertical", selected);
      defaults.door_vertical = null;
      renderHorizontal();
    } else {
      showMessage(hBox, "3번 항목 선택 후 표시됩니다.");
      showMessage(sBox, "4번 항목 선택 후 표시됩니다.");
      showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
    }
  };

  renderVertical();
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

// -------------------------------------------------
// 🧮 농도 변환 유틸리티
// -------------------------------------------------
function computeConversions({ value, unit, molarMass, density }) {
  const parseDensity = (d) => {
    if (d === null || d === undefined) return null;
    const match = String(d).match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  };

  const v = Number(value);
  const mw = Number(molarMass);
  const rho = parseDensity(density) ?? 1; // g/mL (solute density)
  const waterRho = 1; // g/mL, assumption
  const result = { percent: null, molarity: null, molality: null };

  if (!Number.isFinite(v) || !Number.isFinite(mw) || mw <= 0) return null;

  if (unit === "%") {
    // % w/w -> Molarity, Molality
    // Use separate volumes: solute volume from its density, solvent volume from water density.
    const massSolute = v; // g (in 100 g solution)
    const totalMass = 100; // g
    const solventMass = totalMass - massSolute;

    const soluteVolumeL = massSolute / rho / 1000; // L
    const solventVolumeL = solventMass / waterRho / 1000; // L
    const solutionVolumeL = soluteVolumeL + solventVolumeL;

    const moles = massSolute / mw;
    result.molarity = solutionVolumeL > 0 ? moles / solutionVolumeL : null;

    const solventMassKg = solventMass / 1000;
    result.molality = solventMassKg > 0 ? moles / solventMassKg : null;
    result.percent = v;
  } else if (unit === "M" || unit === "N") {
    // Molarity -> % w/w, Molality
    // Assume M = N for simplicity if not specified, or treat input as M
    const effectiveM = v;
    // Basis: 1 L solution
    const solutionVolumeL = 1;
    const moles = effectiveM * solutionVolumeL;
    const soluteMassG = moles * mw;
    const solutionMassG = solutionVolumeL * 1000 * rho;

    result.percent = solutionMassG > 0 ? (soluteMassG / solutionMassG) * 100 : null;

    const solventMassKg = (solutionMassG - soluteMassG) / 1000;
    result.molality = solventMassKg > 0 ? moles / solventMassKg : null;
    result.molarity = effectiveM;
  }
  return result;
}
}) ();
