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

    const title = document.querySelector("#inventory-form h1");
    const submitBtn = document.getElementById("inventory-submit-button");
    const statusMsg = document.getElementById("statusMessage");
    if (title) title.textContent = mode === "edit" ? "약품 정보 수정" : "약품 입고 정보 입력";

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
        preview.innerHTML = `<img src="${existingPhoto}" alt="Preview">`;
        set("photo_base64", existingPhoto);
      }
      set("photo_updated", false);
    } else {
      set("photo_updated", false);
    }

    // ✅ 버튼 그룹 초기화 및 복원
    const buttonFieldMap = {
      classification_buttons: (d) => d?.classification ?? null,
      state_buttons: (d) => d?.state ?? null,
      unit_buttons: (d) => d?.unit ?? null,
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
        const value = getter(detail);
        if (!value) return;
        const targetBtn = document.querySelector(`#${groupId} button[data-value="${value}"]`);
        if (targetBtn) {
          targetBtn.classList.add("active");
          set(stateKey, value);
          if (groupId === "manufacturer_buttons") {
            const group = document.getElementById("other_manufacturer_group");
            if (group) group.style.display = value === "기타" ? "block" : "none";
          }
        } else if (groupId === "manufacturer_buttons") {
          const otherBtn = document.querySelector(`#${groupId} button[data-value="기타"]`);
          if (otherBtn) {
            otherBtn.classList.add("active");
            set("manufacturer", "기타");
            const otherInput = document.getElementById("manufacturer_other");
            if (otherInput) otherInput.value = value;
            const group = document.getElementById("other_manufacturer_group");
            if (group) group.style.display = "block";
          }
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
            area_id: state.area_id || null,
            cabinet_id: state.cabinet_id || null,
            door_vertical: state.door_vertical || null,
            door_horizontal: state.door_horizontal || null,
            internal_shelf_level: state.internal_shelf_level || null,
            storage_column: state.storage_column || null,
            concentration_value: concentrationValue ? Number(concentrationValue) : null,
            concentration_unit: concentrationUnit || null,
          };

          if (state.photo_base64) {
            inventoryDetails.photo_320_base64 = state.photo_base64;
            inventoryDetails.photo_160_base64 = state.photo_base64;
          }

          if (mode === "edit" && detail?.id) {
            const updatePayload = {
              initial_amount: volume,
              current_amount: volume,
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
            };
            if (state.photo_updated) {
              updatePayload.photo_url_320 = state.photo_base64 || null;
              updatePayload.photo_url_160 = state.photo_base64 || null;
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
        const value = idx + 1;
        const label = `${shelfCount - idx}단`;
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
})();
