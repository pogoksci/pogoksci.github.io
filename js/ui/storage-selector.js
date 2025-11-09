// /js/ui/storage-selector.js
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  // 내부 상태
  const state = {
    area_id: null,
    cabinet_id: null,
    door_vertical: null,
    internal_shelf_level: null,
    storage_column: null,
  };

  // 상수 (Cabinet 구조 정보가 없는 경우 기본값으로 사용)
  const DOOR_VERTICALS = ["왼쪽문", "오른쪽문"];
  const MAX_SHELVES = 5;
  const MAX_COLUMNS = 5;

  // 🔹 버튼 그룹 생성
  function createButtonGroup(options, onClick, activeValue = null) {
    const group = document.createElement("div");
    group.className = "button-group";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opt.label || opt.area_name || opt.cabinet_name || opt.name || opt;
      btn.dataset.value = opt.value || opt.id || opt.area_name || opt.cabinet_name;
      btn.className = "btn-location";
      if (String(btn.dataset.value) === String(activeValue)) btn.classList.add("active");
      btn.addEventListener("click", () => onClick(btn.dataset.value));
      group.appendChild(btn);
    });
    return group;
  }

  // 🔹 DOM 헬퍼
  function clearNextSteps(container, startIndex) {
    const steps = container.querySelectorAll(".location-step");
    for (let i = startIndex; i < steps.length; i++) steps[i].remove();
  }

  // 🔹 단계 생성 헬퍼
  function createStep(title) {
    const stepDiv = document.createElement("div");
    stepDiv.className = "location-step";
    const label = document.createElement("label");
    label.textContent = title;
    stepDiv.appendChild(label);
    return stepDiv;
  }

  // 🔹 1단계: Area 목록 불러오기
  async function loadAreas(container) {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("Area").select("id, area_name").order("area_name");
    if (error) {
      console.error("Area 불러오기 오류:", error);
      return;
    }

    const step = createStep("1️⃣ 약품실 선택");
    const group = createButtonGroup(data, async (areaId) => {
      state.area_id = Number(areaId);
      state.cabinet_id = state.door_vertical = state.internal_shelf_level = state.storage_column = null;
      clearNextSteps(container, 1);
      await loadCabinets(container, areaId);
    }, state.area_id);

    step.appendChild(group);
    container.appendChild(step);
  }

  // 🔹 2단계: Cabinet 목록
  async function loadCabinets(container, areaId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("Cabinet")
      .select("id, cabinet_name")
      .eq("area_id", areaId)
      .order("cabinet_name");
    if (error) {
      console.error("Cabinet 불러오기 오류:", error);
      return;
    }

    const step = createStep("2️⃣ 시약장 선택");
    if (!data.length) {
      step.appendChild(document.createTextNode("해당 약품실에 등록된 시약장이 없습니다."));
      container.appendChild(step);
      return;
    }

    const group = createButtonGroup(data, async (cabId) => {
      state.cabinet_id = Number(cabId);
      state.door_vertical = state.internal_shelf_level = state.storage_column = null;
      clearNextSteps(container, 2);
      loadDoorVertical(container);
    }, state.cabinet_id);

    step.appendChild(group);
    container.appendChild(step);
  }

  // 🔹 3단계: 문 선택
  function loadDoorVertical(container) {
    const step = createStep("3️⃣ 수직문(왼쪽/오른쪽)");
    const group = createButtonGroup(
      DOOR_VERTICALS.map((v) => ({ value: v, label: v })),
      (val) => {
        state.door_vertical = val;
        state.internal_shelf_level = state.storage_column = null;
        clearNextSteps(container, 3);
        loadShelfLevels(container);
      },
      state.door_vertical
    );
    step.appendChild(group);
    container.appendChild(step);
  }

  // 🔹 4단계: 선반층
  function loadShelfLevels(container) {
    const step = createStep("4️⃣ 내부 선반(층) 선택");
    const options = Array.from({ length: MAX_SHELVES }, (_, i) => ({
      value: i + 1,
      label: `${i + 1}층`,
    }));

    const group = createButtonGroup(options, (val) => {
      state.internal_shelf_level = Number(val);
      state.storage_column = null;
      clearNextSteps(container, 4);
      loadColumns(container);
    }, state.internal_shelf_level);

    step.appendChild(group);
    container.appendChild(step);
  }

  // 🔹 5단계: 칸(열)
  function loadColumns(container) {
    const step = createStep("5️⃣ 칸(열) 선택");
    const options = Array.from({ length: MAX_COLUMNS }, (_, i) => ({
      value: i + 1,
      label: `${i + 1}열`,
    }));

    const group = createButtonGroup(options, (val) => {
      state.storage_column = Number(val);
      // 모든 단계 완료 시 콘솔 출력 (또는 외부로 emit)
      console.log("✅ 최종 선택:", { ...state });
    }, state.storage_column);

    step.appendChild(group);
    container.appendChild(step);
  }

  // ✅ 초기화
  async function init(containerId, defaultValue = {}) {
    const container = document.getElementById(containerId);
    if (!container) return console.error("StorageSelector: container not found");
    container.innerHTML = "";

    // 기존 상태 초기화
    Object.assign(state, {
      area_id: defaultValue.area_id || null,
      cabinet_id: defaultValue.cabinet_id || null,
      door_vertical: defaultValue.door_vertical || null,
      internal_shelf_level: defaultValue.internal_shelf_level || null,
      storage_column: defaultValue.storage_column || null,
    });

    await loadAreas(container);
    // 이미 기본값이 있을 경우 자동으로 아래 단계까지 열기
    if (state.area_id) await loadCabinets(container, state.area_id);
    if (state.cabinet_id) loadDoorVertical(container);
    if (state.door_vertical) loadShelfLevels(container);
    if (state.internal_shelf_level) loadColumns(container);
  }

  function getSelection() {
    return { ...state };
  }

  // 전역 등록
  globalThis.App = getApp();
  globalThis.App.StorageSelector = { init, getSelection };
})();
