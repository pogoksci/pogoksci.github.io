// /js/ui/forms.js
(function () {
  // 폼 전역 상태 (현재 선택값들)
  let state = {
    mode: "create",          // "create" | "edit"
    cabinetId: null,         // 편집 중인 cabinet의 ID
    area_id: null,           // 선택된 장소 id
    name: null,              // 시약장 이름
    door_vertical_count: null,
    door_horizontal_count: null,
    shelf_height: null,
    storage_columns: null,
    photo_url_320: null,
    photo_url_160: null,
  };

  // -------------------------------------------------
  // 버튼 그룹을 초기화하고 클릭 시 상태를 업데이트
  // -------------------------------------------------
  function initButtonGroup(groupId, onSelect) {
    const groupEl = document.getElementById(groupId);
    if (!groupEl) return;

    // 기존 리스너 제거를 위해 clone 후 교체
    const clone = groupEl.cloneNode(true);
    groupEl.parentNode.replaceChild(clone, groupEl);
    const root = document.getElementById(groupId);

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      // active 토글
      root.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // state 반영
      if (typeof onSelect === "function") {
        onSelect(btn);
      }

      // "기타" 입력칸 토글 처리 (바로 다음 .other-input-group 열기)
      const groupWrapper = root.closest(".form-group");
      const maybeOther = groupWrapper?.nextElementSibling;
      if (maybeOther && maybeOther.classList.contains("other-input-group")) {
        if (btn.dataset.value === "기타") {
          maybeOther.style.display = "block";
        } else {
          maybeOther.style.display = "none";
        }
      }
    });
  }

  // -------------------------------------------------
  // edit 모드일 때 버튼 상태/값 채우기
  // -------------------------------------------------
  function applyExistingSelection(detail) {
    // 1. 위치(장소)
    if (detail.area_id?.id) {
      state.area_id = detail.area_id.id;
      const areaBtn = document.querySelector(
        `#area-button-group button[data-id="${detail.area_id.id}"]`
      );
      if (areaBtn) {
        areaBtn.classList.add("active");
      } else {
        // 프리셋에 없는 장소면 "기타"를 active 하고 입력칸을 열어줌
        const otherBtn = document.querySelector(
          `#area-button-group button[data-value="기타"]`
        );
        if (otherBtn) {
          otherBtn.classList.add("active");
          const otherWrap = document.getElementById("other_area_group");
          const otherInput = document.getElementById("other_area_input");
          if (otherWrap && otherInput) {
            otherWrap.style.display = "block";
            otherInput.value = detail.area_id.name || "";
          }
        }
      }
    }

    // 2. 시약장 이름
    if (detail.name) {
      state.name = detail.name;
      const nameBtn = document.querySelector(
        `#cabinet_name_buttons button[data-value="${detail.name}"]`
      );
      if (nameBtn) {
        nameBtn.classList.add("active");
      } else {
        const otherBtn = document.querySelector(
          `#cabinet_name_buttons button[data-value="기타"]`
        );
        if (otherBtn) {
          otherBtn.classList.add("active");
          const otherWrap = document.getElementById("other_cabinet_group");
          const otherInput = document.getElementById("other_cabinet_input");
          if (otherWrap && otherInput) {
            otherWrap.style.display = "block";
            otherInput.value = detail.name;
          }
        }
      }

      // 수정 모드에서는 시약장 이름은 변경불가로 잠금
      document
        .querySelectorAll("#cabinet_name_buttons button")
        .forEach((b) => (b.disabled = true));
      const otherCabinetInput = document.getElementById("other_cabinet_input");
      if (otherCabinetInput) otherCabinetInput.disabled = true;
    }

    // 3. 상하 도어
    const verticalMap = { 3: "상중하도어", 2: "상하도어", 1: "단일도어" };
    const verticalVal = verticalMap[detail.door_vertical_count];
    if (verticalVal) {
      const vBtn = document.querySelector(
        `#door_vertical_split_buttons button[data-value="${verticalVal}"]`
      );
      if (vBtn) {
        vBtn.classList.add("active");
        state.door_vertical_count = detail.door_vertical_count;
      }
    }

    // 4. 좌우 도어
    const horizontalMap = { 2: "좌우분리도어", 1: "단일도어" };
    const horizontalVal = horizontalMap[detail.door_horizontal_count];
    if (horizontalVal) {
      const hBtn = document.querySelector(
        `#door_horizontal_split_buttons button[data-value="${horizontalVal}"]`
      );
      if (hBtn) {
        hBtn.classList.add("active");
        state.door_horizontal_count = detail.door_horizontal_count;
      }
    }

    // 5. 내부 층 수
    if (detail.shelf_height != null) {
      const sBtn = document.querySelector(
        `#shelf_height_buttons button[data-value="${detail.shelf_height}"]`
      );
      if (sBtn) {
        sBtn.classList.add("active");
        state.shelf_height = detail.shelf_height;
      }
    }

    // 6. 내부 열 수
    if (detail.storage_columns != null) {
      const cBtn = document.querySelector(
        `#storage_columns_buttons button[data-value="${detail.storage_columns}"]`
      );
      if (cBtn) {
        cBtn.classList.add("active");
        state.storage_columns = detail.storage_columns;
      }
    }

    // 7. 사진 프리뷰
    const preview = document.getElementById("cabinet-photo-preview");
    if (preview && (detail.photo_url_320 || detail.photo_url_160)) {
      const imgUrl = detail.photo_url_320 || detail.photo_url_160;
      preview.innerHTML = `<img src="${imgUrl}" alt="Cabinet photo preview" style="width:100%;height:100%;object-fit:cover;">`;
      state.photo_url_320 = detail.photo_url_320 || null;
      state.photo_url_160 = detail.photo_url_160 || null;
    }
  }

  // -------------------------------------------------
  // 카메라 / 파일 업로드 초기화
  // -------------------------------------------------
  function initPhotoCapture() {
    const photoInput = document.getElementById("cabinet-photo-input");
    const cameraInput = document.getElementById("cabinet-camera-input");
    const previewBox = document.getElementById("cabinet-photo-preview");
    const cameraBtn = document.getElementById("cabinet-camera-btn");
    const photoBtn = document.getElementById("cabinet-photo-btn");

    // 사진 선택 버튼 → 숨겨진 input 클릭
    if (photoBtn && photoInput) {
      photoBtn.onclick = () => photoInput.click();
    }

    // 카메라 촬영 버튼 → startCamera() (camera.js에서 전역 제공 가정)
    if (cameraBtn && typeof startCamera === "function") {
      cameraBtn.onclick = () => startCamera();
    }

    function handleFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        // processImage는 camera.js에서 제공 (320/160 리사이즈)
        processImage(e.target.result, (resized) => {
          state.photo_url_320 = resized.base64_320;
          state.photo_url_160 = resized.base64_160;
          if (previewBox) {
            previewBox.innerHTML = `<img src="${resized.base64_320}" alt="Cabinet photo preview" style="width:100%;height:100%;object-fit:cover;">`;
          }
        });
      };
      reader.readAsDataURL(file);
    }

    if (photoInput) {
      photoInput.onchange = (e) => handleFile(e.target.files[0]);
    }
    if (cameraInput) {
      cameraInput.onchange = (e) => handleFile(e.target.files[0]);
    }

    // 카메라 모달 내 캡처 버튼/취소 버튼 연결
    if (typeof setupCameraModalListeners === "function") {
      setupCameraModalListeners();
    }
  }

  // -------------------------------------------------
  // 최종 저장 (등록 or 수정) 버튼 눌렀을 때 호출
  // -------------------------------------------------
  async function handleSave() {
    try {
      // 기타 입력칸 값(직접입력) 처리
      const otherAreaInput = document.getElementById("other_area_input");
      const otherCabinetInput = document.getElementById("other_cabinet_input");

      // 장소(area) 선택
      const activeAreaBtn = document.querySelector("#area-button-group button.active");
      if (activeAreaBtn) {
        const val = activeAreaBtn.dataset.value;
        const id = activeAreaBtn.dataset.id ? parseInt(activeAreaBtn.dataset.id) : null;
        // "기타"라면 새 텍스트를 사용하고 area_id는 null(또는 특수처리)
        if (val === "기타" && otherAreaInput && otherAreaInput.value.trim() !== "") {
          state.area_id = null;
          state.area_custom_name = otherAreaInput.value.trim();
        } else {
          state.area_id = id;
        }
      }

      // 시약장 이름
      const activeNameBtn = document.querySelector("#cabinet_name_buttons button.active");
      if (activeNameBtn) {
        const v = activeNameBtn.dataset.value;
        if (v === "기타" && otherCabinetInput && otherCabinetInput.value.trim() !== "") {
          state.name = otherCabinetInput.value.trim();
        } else {
          state.name = v;
        }
      }

      // 상하 도어
      const activeVerticalBtn = document.querySelector("#door_vertical_split_buttons button.active");
      if (activeVerticalBtn) {
        const mapReverse = { "상중하도어": 3, "상하도어": 2, "단일도어": 1, "단일도어(상하분리없음)": 1 };
        state.door_vertical_count = mapReverse[activeVerticalBtn.dataset.value] ?? null;
      }

      // 좌우 도어
      const activeHorizontalBtn = document.querySelector("#door_horizontal_split_buttons button.active");
      if (activeHorizontalBtn) {
        const mapReverse2 = { "좌우분리도어": 2, "단일도어": 1 };
        state.door_horizontal_count = mapReverse2[activeHorizontalBtn.dataset.value] ?? null;
      }

      // 층 / 열
      const activeShelfBtn = document.querySelector("#shelf_height_buttons button.active");
      if (activeShelfBtn) {
        state.shelf_height = parseInt(activeShelfBtn.dataset.value, 10);
      }

      const activeColumnBtn = document.querySelector("#storage_columns_buttons button.active");
      if (activeColumnBtn) {
        state.storage_columns = parseInt(activeColumnBtn.dataset.value, 10);
      }

      // 유효성 체크
      if (!state.name) {
        alert("시약장 이름을 선택하거나 입력하세요.");
        return;
      }
      if (!state.area_id && !state.area_custom_name) {
        alert("시약장이 위치한 장소를 선택하거나 직접 입력하세요.");
        return;
      }

      // DB로 전송할 payload 구성
      const payload = {
        name: state.name,
        door_vertical_count: state.door_vertical_count,
        door_horizontal_count: state.door_horizontal_count,
        shelf_height: state.shelf_height,
        storage_columns: state.storage_columns,
        area_id: state.area_id, // area_custom_name은 아직 DB에 없으니 확장 필요시 여기서 Edge Function 호출 등
        photo_url_320: state.photo_url_320 || null,
        photo_url_160: state.photo_url_160 || null,
      };

      if (state.mode === "create") {
        await App.Cabinet.createCabinet(payload);
        alert("✅ 시약장이 등록되었습니다.");
      } else {
        await App.Cabinet.updateCabinet(state.cabinetId, payload);
        alert("✅ 시약장 정보가 수정되었습니다.");
      }

      // 완료 후 목록으로 복귀
      await App.includeHTML("pages/location-list.html", "form-container");

    } catch (err) {
      console.error("❌ handleSave 오류:", err);
      alert("저장 중 오류가 발생했습니다.");
    }
  }

  // -------------------------------------------------
  // 폼 전체 초기화 (등록/수정 공용 진입점)
  // mode === "create" | "edit"
  // detail === Cabinet row or null
  // -------------------------------------------------
  function initCabinetForm(mode = "create", detail = null) {
    console.log("🧭 initCabinetForm()", mode, detail);

    // state 초기화
    state = {
      mode,
      cabinetId: detail?.id ?? null,
      area_id: detail?.area_id?.id ?? null,
      name: detail?.name ?? null,
      door_vertical_count: detail?.door_vertical_count ?? null,
      door_horizontal_count: detail?.door_horizontal_count ?? null,
      shelf_height: detail?.shelf_height ?? null,
      storage_columns: detail?.storage_columns ?? null,
      photo_url_320: detail?.photo_url_320 ?? null,
      photo_url_160: detail?.photo_url_160 ?? null,
    };

    // 제목/버튼 텍스트
    const titleEl = document.querySelector("#cabinet-creation-form h2");
    const submitBtn = document.getElementById("cabinet-save-btn");
    const cancelBtn = document.getElementById("cancel-form-btn");

    if (titleEl) {
      titleEl.textContent =
        mode === "edit"
          ? `${detail?.name || "시약장"} 정보 수정`
          : "시약장 등록";
    }

    if (submitBtn) {
      submitBtn.textContent = mode === "edit" ? "수정 내용 저장" : "시약장 등록";
      submitBtn.onclick = (e) => {
        e.preventDefault();
        handleSave();
      };
    }

    if (cancelBtn) {
      cancelBtn.onclick = async () => {
        await App.includeHTML("pages/location-list.html", "form-container");
      };
    }

    // 버튼 그룹 초기화 (클릭 시 state 업데이트)
    initButtonGroup("area-button-group", (btn) => {
      const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;
      state.area_id = id;
    });
    initButtonGroup("cabinet_name_buttons", (btn) => {
      state.name = btn.dataset.value || btn.textContent.trim();
    });
    initButtonGroup("door_vertical_split_buttons", (btn) => {
      const rev = { "상중하도어": 3, "상하도어": 2, "단일도어": 1, "단일도어(상하분리없음)": 1 };
      state.door_vertical_count = rev[btn.dataset.value] ?? null;
    });
    initButtonGroup("door_horizontal_split_buttons", (btn) => {
      const rev = { "좌우분리도어": 2, "단일도어": 1 };
      state.door_horizontal_count = rev[btn.dataset.value] ?? null;
    });
    initButtonGroup("shelf_height_buttons", (btn) => {
      state.shelf_height = parseInt(btn.dataset.value, 10);
    });
    initButtonGroup("storage_columns_buttons", (btn) => {
      state.storage_columns = parseInt(btn.dataset.value, 10);
    });

    // edit 모드라면 기존값 반영해서 active 표시 + 필요한 버튼 잠금
    if (mode === "edit" && detail) {
      applyExistingSelection(detail);
    }

    // 카메라/사진 업로드 준비
    initPhotoCapture();

    // FAB 숨겨 (폼 화면에서는 목록추가용 FAB 필요 없음)
    globalThis.App.Fab?.setVisibility(false);
  }

  // -------------------------------------------------
  // (다른 종류 폼에서 쓸 미래용 placeholder)
  // -------------------------------------------------
  function initInventoryForm() {
    console.log("🧪 initInventoryForm() (placeholder)");
    // 여기는 약품 입고 등록 폼 초기화 자리
  }

  // -------------------------------------------------
  // 공개 (네임스페이스)
  // -------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.Forms = {
    initCabinetForm,
    initInventoryForm,
  };
})();
