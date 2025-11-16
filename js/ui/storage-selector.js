// ================================================================
// /js/ui/storage-selector.js — Cabinet 구조 기반 보관위치 선택기
// ================================================================
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  // 내부 상태 관리
  const state = {
    area_id: null,
    cabinet_id: null,

    door_vertical_count: null,
    shelf_height: null,
    storage_columns: null,

    door_vertical: null,
    internal_shelf_level: null,
    storage_column: null,
  };

  // -------------------------------------------------------------
  // 🔹 공용 UI 생성 헬퍼
  // -------------------------------------------------------------
  function createButtonGroup(options, onClick, activeValue = null) {
    const group = document.createElement("div");
    group.className = "button-group";

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opt.label;
      btn.dataset.value = opt.value;
      btn.className = "btn-location";

      if (String(opt.value) === String(activeValue)) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", () => {
        onClick(opt.value);
      });

      group.appendChild(btn);
    });

    return group;
  }

  function createStep(title) {
    const step = document.createElement("div");
    step.className = "location-step";

    const label = document.createElement("label");
    label.textContent = title;

    step.appendChild(label);
    return step;
  }

  function clearNextSteps(container, startIndex) {
    const steps = container.querySelectorAll(".location-step");
    for (let i = startIndex; i < steps.length; i++) {
      steps[i].remove();
    }
  }

  // -------------------------------------------------------------
  // 🔹 0. Cabinet 구조(DB) 읽기
  // -------------------------------------------------------------
  async function loadCabinetStructure(cabinetId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("Cabinet")
      .select("door_vertical_count, shelf_height, storage_columns")
      .eq("id", cabinetId)
      .maybeSingle();

    if (error || !data) {
      console.error("❌ 시약장 구조 조회 실패:", error);
      return null;
    }

    console.log("📦 시약장 구조:", data);
    return data;
  }

  // -------------------------------------------------------------
  // 🔹 1. Area 선택
  // -------------------------------------------------------------
  async function loadAreas(container) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("Area")
      .select("id, area_name")
      .order("area_name");

    if (error) {
      console.error("❌ Area 불러오기 실패:", error);
      return;
    }

    const step = createStep("1️⃣ 약품실 선택");

    const group = createButtonGroup(
      data.map((a) => ({ label: a.area_name, value: a.id })),
      async (areaId) => {
        state.area_id = Number(areaId);

        // 초기화
        state.cabinet_id =
          state.door_vertical =
          state.internal_shelf_level =
          state.storage_column =
            null;

        clearNextSteps(container, 1);
        await loadCabinets(container, areaId);
      },
      state.area_id
    );

    step.appendChild(group);
    container.appendChild(step);
  }

  // -------------------------------------------------------------
  // 🔹 2. Cabinet 선택
  // -------------------------------------------------------------
  async function loadCabinets(container, areaId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("Cabinet")
      .select("id, cabinet_name")
      .eq("area_id", areaId)
      .order("cabinet_name");

    if (error) {
      console.error("❌ Cabinet 불러오기 실패:", error);
      return;
    }

    const step = createStep("2️⃣ 시약장 선택");

    if (!data.length) {
      step.append("등록된 시약장이 없습니다.");
      container.appendChild(step);
      return;
    }

    const group = createButtonGroup(
      data.map((c) => ({ label: c.cabinet_name, value: c.id })),
      async (cabId) => {
        state.cabinet_id = Number(cabId);

        // Cabinet 구조 읽기
        const structure = await loadCabinetStructure(state.cabinet_id);
        if (structure) {
          state.door_vertical_count = structure.door_vertical_count;
          state.shelf_height = structure.shelf_height;
          state.storage_columns = structure.storage_columns;
        }

        // 초기화
        state.door_vertical =
          state.internal_shelf_level =
          state.storage_column =
            null;

        clearNextSteps(container, 2);
        loadDoorVertical(container);
      },
      state.cabinet_id
    );

    step.appendChild(group);
    container.appendChild(step);
  }

  // -------------------------------------------------------------
  // 🔹 3. 문 선택 (door_vertical_count)
  // -------------------------------------------------------------
  function loadDoorVertical(container) {
    const step = createStep("3️⃣ 수직문 선택");

    const count = state.door_vertical_count || 1;

    const options = Array.from({ length: count }, (_, i) => ({
      label: `${i + 1}번 문`,
      value: i + 1,
    }));

    const group = createButtonGroup(
      options,
      (val) => {
        state.door_vertical = Number(val);
        clearNextSteps(container, 3);
        loadShelfLevels(container);
      },
      state.door_vertical
    );

    step.appendChild(group);
    container.appendChild(step);
  }

  // -------------------------------------------------------------
  // 🔹 4. 선반 선택 (shelf_height)
  // -------------------------------------------------------------
  function loadShelfLevels(container) {
    const step = createStep("4️⃣ 내부 선반 선택");

    const count = state.shelf_height || 1;

    const options = Array.from({ length: count }, (_, i) => ({
      label: `${i + 1}층`,
      value: i + 1,
    }));

    const group = createButtonGroup(
      options,
      (val) => {
        state.internal_shelf_level = Number(val);
        clearNextSteps(container, 4);
        loadColumns(container);
      },
      state.internal_shelf_level
    );

    step.appendChild(group);
    container.appendChild(step);
  }

  // -------------------------------------------------------------
  // 🔹 5. 칸 선택 (storage_columns)
  // -------------------------------------------------------------
  function loadColumns(container) {
    const step = createStep("5️⃣ 칸(열) 선택");

    const count = state.storage_columns || 1;

    const options = Array.from({ length: count }, (_, i) => ({
      label: `${i + 1}열`,
      value: i + 1,
    }));

    const group = createButtonGroup(
      options,
      (val) => {
        state.storage_column = Number(val);
        console.log("🎯 최종 선택:", { ...state });
      },
      state.storage_column
    );

    step.appendChild(group);
    container.appendChild(step);
  }

  // -------------------------------------------------------------
  // 🔹 초기화 (inventory-form에서 호출)
  // -------------------------------------------------------------
  async function init(containerId, defaultValue = {}) {
    const container = document.getElementById(containerId);
    if (!container) return console.error("❌ StorageSelector: container not found");

    container.innerHTML = "";

    Object.assign(state, {
      area_id: defaultValue.area_id || null,
      cabinet_id: defaultValue.cabinet_id || null,

      door_vertical: defaultValue.door_vertical || null,
      internal_shelf_level: defaultValue.internal_shelf_level || null,
      storage_column: defaultValue.storage_column || null,
    });

    await loadAreas(container);

    // 기본값 자동 오픈
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
