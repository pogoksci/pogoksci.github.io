// js/ui/forms.js
// ================================================================
// 폼 관련 공통 로직 (등록/수정 겸용)
// ================================================================

let selectedAreaId = null; // ✅ 전역 변수로 area_id 추적
let formMode = "create"; // 'create' | 'edit'

// ------------------------------------------------------------
// 1️⃣ 버튼 그룹 설정 (공용)
// ------------------------------------------------------------
function setupButtonGroup(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;

  // 중복 이벤트 제거 후 새로 바인딩
  const newGroup = group.cloneNode(true);
  group.parentNode.replaceChild(newGroup, group);

  newGroup.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    // 기존 active 제거 → 새 버튼 활성화
    newGroup.querySelectorAll(".active").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // 선택한 ID 저장
    selectedAreaId = btn.dataset.id || null;

    // 숨겨진 input 자동 업데이트 (collectFormData 호환)
    const hiddenInput = newGroup.querySelector("input[type='hidden']");
    if (hiddenInput) hiddenInput.value = btn.dataset.value || btn.textContent.trim();

    // 기타 입력칸 처리
    const otherGroup = document.getElementById("other_area_group");
    if (otherGroup) {
      if (btn.textContent.includes("기타")) {
        otherGroup.style.display = "block";
      } else {
        otherGroup.style.display = "none";
      }
    }

    console.log(`✅ 선택된 area_id=${selectedAreaId}, value=${btn.dataset.value}`);
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
  setupButtonGroup("area-button-group");
  setupButtonGroup("door_vertical_split_buttons");
  setupButtonGroup("door_horizontal_split_buttons");
  setupButtonGroup("shelf_height_buttons");
  setupButtonGroup("storage_columns_buttons");

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
