// js/ui/forms.js
// ================================================================
// 폼 관련 공통 로직 (등록/수정 겸용)
// ================================================================

let selectedAreaId = null; // ✅ 전역 변수로 area_id 추적
let formMode = "create"; // 'create' | 'edit'

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

  // 🔄 중복 리스너 제거
  const newGroup = group.cloneNode(true);
  group.parentNode.replaceChild(newGroup, group);

  // 🔹 전역 상태 맵 (필요시 확장 가능)
  window.SelectedValues = window.SelectedValues || {};

  newGroup.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    // 기존 active 해제 → 새 선택 반영
    newGroup.querySelectorAll(".active").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // 공통 속성 추출
    const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;
    const value = btn.dataset.value || btn.textContent.trim();

    // 그룹별 전역 변수 저장
    switch (groupId) {
      case "area-button-group":
        window.selectedAreaId = id;
        window.SelectedValues.area = { id, value };
        break;
      case "cabinet_name_buttons":
        window.selectedCabinetName = value;
        window.SelectedValues.cabinet_name = value;
        break;
      case "door_vertical_split_buttons":
        window.selectedDoorVertical = value;
        window.SelectedValues.door_vertical = value;
        break;
      case "door_horizontal_split_buttons":
        window.selectedDoorHorizontal = value;
        window.SelectedValues.door_horizontal = value;
        break;
      case "shelf_height_buttons":
        window.selectedShelfHeight = value;
        window.SelectedValues.shelf_height = value;
        break;
      case "storage_columns_buttons":
        window.selectedStorageColumns = value;
        window.SelectedValues.storage_columns = value;
        break;
      default:
        // 기타 그룹도 자동 저장
        window.SelectedValues[groupId] = value;
    }

    console.log(`✅ [${groupId}] 선택됨 → id=${id}, value=${value}`);

    // 기타 입력칸 자동 표시
    const otherGroupId = groupId.replace("_buttons", "_group");
    const otherGroup = document.getElementById(otherGroupId);
    if (otherGroup) {
      if (value.includes("기타")) {
        otherGroup.style.display = "block";
      } else {
        otherGroup.style.display = "none";
      }
    }

    // 숨겨진 input 업데이트 (collectFormData 호환)
    const hiddenInput = newGroup.querySelector("input[type='hidden']");
    if (hiddenInput) hiddenInput.value = value;
  });
}

// ------------------------------------------------------------
// 2️⃣ 폼 자동 채움 (수정 모드용)
// ------------------------------------------------------------
function fillCabinetForm(detail) {
  fillFormFromData(detail, "cabinet-creation-form");

  // 기존 장소 active 처리
  if (detail.area_id?.id) {
    selectedAreaId = detail.area_id.id;
    const buttons = document.querySelectorAll("#area-button-group button");
    buttons.forEach((btn) => {
      if (btn.dataset.id == detail.area_id.id) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }
}

// ------------------------------------------------------------
// 3️⃣ 폼 초기화 (등록/수정 겸용)
// ------------------------------------------------------------
async function initializeCabinetForm(detail = null) {
  const form = document.getElementById("cabinet-creation-form");
  if (!form) {
    console.warn("⚠️ cabinet-creation-form not found");
    return;
  }

  // ✅ 모드 판별
  formMode = detail ? "edit" : "create";
  console.log(`🧭 시약장 폼 초기화 (mode=${formMode})`);

  // 공통 버튼 그룹 초기화
  setupButtonGroup("area-button-group");              // 시약장 위치
  setupButtonGroup("cabinet_name_buttons");           // 시약장 이름
  setupButtonGroup("door_vertical_split_buttons");    // 상하 도어
  setupButtonGroup("door_horizontal_split_buttons");  // 좌우 도어
  setupButtonGroup("shelf_height_buttons");           // 내부 층
  setupButtonGroup("storage_columns_buttons");        // 내부 열

  // 수정 모드인 경우 기존 데이터 채움
  if (formMode === "edit" && detail) {
    fillCabinetForm(detail);
  }

  // ✅ 버튼 표시 전환
  const submitBtn = document.getElementById("cabinet-submit-button");
  const saveBtn = document.getElementById("cabinet-save-btn");

  if (formMode === "create") {
    if (submitBtn) submitBtn.style.display = "inline-block";
    if (saveBtn) saveBtn.style.display = "none";
  } else {
    if (submitBtn) submitBtn.style.display = "none";
    if (saveBtn) saveBtn.style.display = "inline-block";
  }

  // ✅ 등록 / 수정 이벤트 연결
  if (submitBtn) {
    submitBtn.onclick = async (e) => {
      e.preventDefault();
      await createCabinet();
    };
  }

  if (saveBtn) {
    saveBtn.onclick = async (e) => {
      e.preventDefault();
      await updateCabinetInfo(detail.id);
    };
  }

  // ✅ 취소 버튼
  const cancelBtn = document.getElementById("cancel-form-btn");
  if (cancelBtn) {
    cancelBtn.onclick = () => includeHTML("pages/location-list.html");
  }
}

// ------------------------------------------------------------
// 4️⃣ 시약장 등록 로직 (create)
// ------------------------------------------------------------
async function createCabinet() {
  try {
    const formData = collectFormData("cabinet-creation-form");
    if (!selectedAreaId) {
      alert("❗ 시약장이 위치한 장소를 선택하세요.");
      return;
    }

    const { error } = await window.App.supabase.from("Cabinet").insert([
      {
        name: formData.name,
        area_id: selectedAreaId,
        door_vertical_count: formData.door_vertical_count,
        door_horizontal_count: formData.door_horizontal_count,
        shelf_height: formData.shelf_height,
        storage_columns: formData.storage_columns,
        photo_url_320: window.selectedCabinetPhoto320 || null,
        photo_url_160: window.selectedCabinetPhoto160 || null,
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

    if (!cabinetId) {
      alert("❌ 시약장 ID가 없습니다.");
      return;
    }
    if (!selectedAreaId) {
      alert("❗ 시약장이 위치한 장소를 선택해 주세요.");
      return;
    }

    const { error } = await window.App.supabase
      .from("Cabinet")
      .update({
        name: formData.name,
        area_id: selectedAreaId,
        door_vertical_count: formData.door_vertical_count,
        door_horizontal_count: formData.door_horizontal_count,
        shelf_height: formData.shelf_height,
        storage_columns: formData.storage_columns,
        photo_url_320: window.selectedCabinetPhoto320 || null,
        photo_url_160: window.selectedCabinetPhoto160 || null,
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
  setFabVisibility?.(false);
}

// ------------------------------------------------------------
// 7️⃣ 전역 등록
// ------------------------------------------------------------
window.setupButtonGroup = setupButtonGroup;
window.initializeCabinetForm = initializeCabinetForm;
window.createCabinet = createCabinet;
window.updateCabinetInfo = updateCabinetInfo;
window.initializeFormListeners = initializeFormListeners;
