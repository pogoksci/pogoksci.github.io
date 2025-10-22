// js/ui/forms.js
// ================================================================
// 폼 관련 공통 로직 (등록/수정 겸용)
// ================================================================

globalThis.selectedAreaId = null; // ✅ 전역 area_id 추적
globalThis.formMode = "create";   // 'create' | 'edit'
globalThis.SelectedValues = globalThis.SelectedValues || {};

// ------------------------------------------------------------
// 1️⃣ 버튼 그룹 설정 (공용)
// ------------------------------------------------------------
/**
 * 💡 범용 버튼 그룹 초기화 함수
 * 모든 button-group에 대해 active 표시, 선택값 추적, 기타입력칸 처리까지 자동화
 */
function setupButtonGroup(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;

  // 🔄 중복 리스너 제거 (DOM 교체 방식)
  const clone = group.cloneNode(true);
  group.parentNode.replaceChild(clone, group);
  const newGroup = document.getElementById(groupId);

  newGroup.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    // ✅ 기존 active 해제 후 새 버튼 활성화
    newGroup.querySelectorAll(".active").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // ✅ 속성 추출
    const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;
    const value = btn.dataset.value || btn.textContent.trim();

    // ✅ 그룹별 전역 변수 갱신
    switch (groupId) {
      case "area-button-group":
        globalThis.selectedAreaId = id;
        globalThis.SelectedValues.area = { id, value };
        break;
      case "cabinet_name_buttons":
        globalThis.selectedCabinetName = value;
        globalThis.SelectedValues.cabinet_name = value;
        break;
      case "door_vertical_split_buttons":
        globalThis.SelectedValues.door_vertical = value;
        break;
      case "door_horizontal_split_buttons":
        globalThis.SelectedValues.door_horizontal = value;
        break;
      case "shelf_height_buttons":
        globalThis.SelectedValues.shelf_height = value;
        break;
      case "storage_columns_buttons":
        globalThis.SelectedValues.storage_columns = value;
        break;
      default:
        globalThis.SelectedValues[groupId] = value;
    }

    console.log(`✅ [${groupId}] 선택됨 → id=${id}, value=${value}`);

    // ✅ 기타 입력칸 자동 표시
    const otherGroupId = groupId.replace("_buttons", "_group");
    const otherGroup = document.getElementById(otherGroupId);
    if (otherGroup) otherGroup.style.display = value.includes("기타") ? "block" : "none";

    // ✅ 숨겨진 input 자동 업데이트 (collectFormData 호환)
    const hiddenInput = newGroup.querySelector("input[type='hidden']");
    if (hiddenInput) hiddenInput.value = value;
  });
}

// ------------------------------------------------------------
// 2️⃣ 폼 자동 채움 (수정 모드용)
// ------------------------------------------------------------
function fillCabinetForm(detail) {
  fillFormFromData(detail, "cabinet-creation-form");

  // ✅ 기존 장소 active 처리
  if (detail.area_id?.id) {
    globalThis.selectedAreaId = detail.area_id.id;
    const buttons = document.querySelectorAll("#area-button-group button");
    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.id == detail.area_id.id);
    });
  }

  // ✅ 기존 시약장 이름 버튼 활성화 (수정 불가 처리)
  if (detail.name) {
    const btn = document.querySelector(`#cabinet_name_buttons button[data-value="${detail.name}"]`);
    if (btn) {
      btn.classList.add("active");
      document.querySelectorAll("#cabinet_name_buttons button").forEach((b) => (b.disabled = true));
    }
  }
}

// ------------------------------------------------------------
// 3️⃣ 폼 초기화 (등록/수정 겸용)
// ------------------------------------------------------------
function initializeCabinetForm(detail = null) {
  const form = document.getElementById("cabinet-creation-form");
  if (!form) {
    console.warn("⚠️ cabinet-creation-form not found");
    return;
  }

  // ✅ 모드 판별
  globalThis.formMode = detail ? "edit" : "create";
  console.log(`🧭 시약장 폼 초기화 (mode=${formMode})`);

  // 버튼 그룹 초기화
  [
    "area-button-group",
    "cabinet_name_buttons",
    "door_vertical_split_buttons",
    "door_horizontal_split_buttons",
    "shelf_height_buttons",
    "storage_columns_buttons",
  ].forEach((id) => setupButtonGroup(id));

  // 수정 모드 → 기존 데이터 반영
  if (formMode === "edit" && detail) fillCabinetForm(detail);

  // ✅ 제목 및 버튼 전환
  const title = form.querySelector("h2");
  const submitBtn = document.getElementById("cabinet-submit-button");
  const saveBtn = document.getElementById("cabinet-save-btn");

  if (formMode === "create") {
    if (title) title.textContent = "시약장 등록";
    if (submitBtn) submitBtn.style.display = "inline-block";
    if (saveBtn) saveBtn.style.display = "none";
  } else {
    if (title) title.textContent = `${detail.name} 정보 수정`;
    if (submitBtn) submitBtn.style.display = "none";
    if (saveBtn) saveBtn.style.display = "inline-block";
  }

  // ✅ 등록 버튼
  if (submitBtn) {
    submitBtn.onclick = async (e) => {
      e.preventDefault();
      await createCabinet();
    };
  }

  // ✅ 수정 버튼
  if (saveBtn) {
    saveBtn.onclick = async (e) => {
      e.preventDefault();
      await updateCabinetInfo(detail.id);
    };
  }

  // ✅ 취소 버튼
  const cancelBtn = document.getElementById("cancel-form-btn");
  if (cancelBtn) cancelBtn.onclick = () => includeHTML("pages/location-list.html");
}

// ------------------------------------------------------------
// 4️⃣ 시약장 등록 로직 (create)
// ------------------------------------------------------------
async function createCabinet() {
  try {
    const formData = collectFormData("cabinet-creation-form");
    if (!globalThis.selectedAreaId) {
      alert("❗ 시약장이 위치한 장소를 선택하세요.");
      return;
    }

    const { error } = await globalThis.App.supabase.from("Cabinet").insert([
      {
        name: formData.name,
        area_id: globalThis.selectedAreaId,
        door_vertical_count: formData.door_vertical_count,
        door_horizontal_count: formData.door_horizontal_count,
        shelf_height: formData.shelf_height,
        storage_columns: formData.storage_columns,
        photo_url_320: globalThis.selectedCabinetPhoto320 || null,
        photo_url_160: globalThis.selectedCabinetPhoto160 || null,
      },
    ]);

    if (error) throw error;

    alert("✅ 시약장 등록이 완료되었습니다!");
    includeHTML("pages/location-list.html");
  } catch (err) {
    console.error("시약장 등록 오류:", err);
    alert("❌ 시약장 등록 중 오류가 발생했습니다.");
  }
}

// ------------------------------------------------------------
// 5️⃣ 시약장 수정 로직 (edit)
// ------------------------------------------------------------
async function updateCabinetInfo(cabinetId) {
  try {
    const formData = collectFormData("cabinet-creation-form");

    if (!cabinetId) return alert("❌ 시약장 ID가 없습니다.");
    if (!globalThis.selectedAreaId)
      return alert("❗ 시약장이 위치한 장소를 선택해 주세요.");

    const { error } = await globalThis.App.supabase
      .from("Cabinet")
      .update({
        name: formData.name,
        area_id: globalThis.selectedAreaId,
        door_vertical_count: formData.door_vertical_count,
        door_horizontal_count: formData.door_horizontal_count,
        shelf_height: formData.shelf_height,
        storage_columns: formData.storage_columns,
        photo_url_320: globalThis.selectedCabinetPhoto320 || null,
        photo_url_160: globalThis.selectedCabinetPhoto160 || null,
      })
      .eq("id", cabinetId);

    if (error) throw error;

    alert("✅ 시약장 정보가 수정되었습니다!");
    includeHTML("pages/location-list.html");
  } catch (err) {
    console.error("시약장 수정 오류:", err);
    alert("❌ 시약장 정보 수정 중 오류가 발생했습니다.");
  }
}

// ------------------------------------------------------------
// 6️⃣ 공용 초기화 (FAB 등)
// ------------------------------------------------------------
function initializeFormListeners() {
  console.log("📋 공용 폼 초기화 실행");
  globalThis.setFabVisibility?.(false);
}

// ------------------------------------------------------------
// 7️⃣ 전역 등록
// ------------------------------------------------------------
globalThis.setupButtonGroup = setupButtonGroup;
globalThis.initializeCabinetForm = initializeCabinetForm;
globalThis.createCabinet = createCabinet;
globalThis.updateCabinetInfo = updateCabinetInfo;
globalThis.initializeFormListeners = initializeFormListeners;
