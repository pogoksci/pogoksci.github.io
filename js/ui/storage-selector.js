// ================================================================
// /js/ui/storage-selector.js — Cabinet 구조 기반 보관위치 선택기 (공용)
// ================================================================
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  // 내부 상태 관리
  const state = {
    mode: "INVENTORY", // "INVENTORY" (Cabinet) or "EQUIPMENT" (equipment_cabinet)
    area_id: null,
    cabinet_id: null,

    door_vertical_total: null,
    door_horizontal_total: null,
    shelf_level_total: null,
    storage_column_total: null,

    door_vertical: null,
    door_horizontal: null,
    internal_shelf_level: null,
    storage_column: null,
  };

  // -------------------------------------------------------------
  // 🔹 공용 UI 생성 헬퍼
  // -------------------------------------------------------------
  function createButtonGroup(options, onClick, activeValue = null) {
    const group = document.createElement("div");
    group.className = "button-group";

    // Dynamic Grid Columns: 항목 수에 맞춰 그리드 컬럼 수 자동 조정
    if (options.length > 0 && options.length <= 12) {
      group.style.display = "grid";
      group.style.gridTemplateColumns = `repeat(${options.length}, 1fr)`;
      group.style.gap = "10px 0"; // CSS와 동일하게 gap 설정
      // 모바일(좁은 화면) 대응을 위해 items가 많으면 줄바꿈이 일어날 수 있도록 예외처리 가능하나
      // 현재 CSS 구조상 grid가 유리.
    }

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

    let tableName = "Cabinet";
    // 컬럼 매핑: 내부 state 이름 -> DB 컬럼 이름
    let colMap = {
      vert: "door_vertical",
      horiz: "door_horizontal",
      shelf: "internal_shelf_level",
      col: "storage_column"
    };

    if (state.mode === "EQUIPMENT") {
      tableName = "equipment_cabinet";
      colMap = {
        vert: "door_vertical_count",
        horiz: "door_horizontal_count",
        shelf: "shelf_height",
        col: "storage_columns"
      };
    }

    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", cabinetId)
      .maybeSingle();

    if (error || !data) {
      console.error(`❌ ${tableName} 구조 조회 실패:`, error);
      return null;
    }

    console.log(`📦 ${tableName} 구조:`, data);

    // 정규화하여 반환
    return {
      door_vertical: data[colMap.vert],
      door_horizontal: data[colMap.horiz],
      internal_shelf_level: data[colMap.shelf],
      storage_column: data[colMap.col]
    };
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

    console.log("StorageSelector: loadAreas called. Data:", data, "Error:", error);

    if (error) {
      console.error("❌ Area 불러오기 실패:", error);
      return;
    }

    const step = createStep("1️⃣ 장소 선택");

    const group = createButtonGroup(
      data.map((a) => ({ label: a.area_name, value: a.id })),
      async (areaId) => {
        state.area_id = Number(areaId);
        state.area_name = data.find(d => d.id == areaId)?.area_name || ""; // ✅ 이름 저장

        // 초기화
        state.cabinet_id = state.cabinet_name = null; // ✅ 이름 초기화
        state.door_vertical =
          state.door_horizontal =
          state.internal_shelf_level =
          state.storage_column =
          null;

        state.door_vertical_total =
          state.door_horizontal_total =
          state.shelf_level_total =
          state.storage_column_total =
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
    let tableName = "Cabinet";
    if (state.mode === "EQUIPMENT") {
      tableName = "equipment_cabinet";
    }

    const { data, error } = await supabase
      .from(tableName)
      .select("id, cabinet_name")
      .eq("area_id", areaId)
      .order("cabinet_name");

    if (error) {
      console.error(`❌ ${tableName} 불러오기 실패:`, error);
      return;
    }

    const stepText = state.mode === "EQUIPMENT" ? "2️⃣ 교구·물품장 선택" : "2️⃣ 시약장 선택";
    const step = createStep(stepText);

    if (!data.length) {
      step.append("등록된 시약/교구장이 없습니다.");
      container.appendChild(step);
      return;
    }

    const group = createButtonGroup(
      data.map((c) => ({ label: c.cabinet_name, value: c.id })),
      async (cabId) => {
        state.cabinet_id = Number(cabId);
        state.cabinet_name = data.find(c => c.id == cabId)?.cabinet_name || ""; // ✅ 이름 저장

        // Cabinet 구조 읽기 (Mode에 따라 컬럼 매핑 자동 처리)
        const structure = await loadCabinetStructure(state.cabinet_id);
        if (structure) {
          state.door_vertical_total = structure.door_vertical;
          state.door_horizontal_total = structure.door_horizontal;
          state.shelf_level_total = structure.internal_shelf_level;
          state.storage_column_total = structure.storage_column;
        } else {
          // 구조 정보가 없거나 실패 시 기본값 1
          state.door_vertical_total = 1;
          state.door_horizontal_total = 1;
          state.shelf_level_total = 1;
          state.storage_column_total = 1;
        }

        // 초기화
        state.door_vertical =
          state.door_horizontal =
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


  // 🔹 3. 문 상/중/하 선택
  // -------------------------------------------------------------
  function loadDoorVertical(container) {
    const step = createStep("3️⃣ 문 상/중/하 선택");

    const count = Number(state.door_vertical_total) || 1;
    // 상/중/하 이름 매핑은 개수에 따라 다를 수 있으나, 여기선 단순히 번호(1번, 2번...) 혹은 상/하
    // 기존 로직: 1,2,3 -> "1번", "2번"...
    // 교구장도 동일한 로직을 사용하겠습니다.

    const options = Array.from({ length: count }, (_, i) => ({
      label: `${i + 1}번`,
      value: i + 1,
    }));

    const group = createButtonGroup(
      options,
      (val) => {
        state.door_vertical = Number(val);
        clearNextSteps(container, 3);
        loadDoorHorizontal(container);
      },
      state.door_vertical
    );

    step.appendChild(group);
    container.appendChild(step);
  }

  // -------------------------------------------------------------
  // 🔹 4. 문 좌/우 선택
  // -------------------------------------------------------------
  function loadDoorHorizontal(container) {
    const step = createStep("4️⃣ 문 좌/우 선택");
    const count = Number(state.door_horizontal_total) || 1;

    const options = Array.from({ length: count }, (_, i) => ({
      label: `${i + 1}번`,
      value: i + 1,
    }));

    const group = createButtonGroup(
      options,
      (val) => {
        state.door_horizontal = Number(val);
        clearNextSteps(container, 4);
        loadShelfLevels(container);
      },
      state.door_horizontal
    );

    step.appendChild(group);
    container.appendChild(step);
  }

  // -------------------------------------------------------------
  // 🔹 5. 내부 선반 선택
  // -------------------------------------------------------------
  function loadShelfLevels(container) {
    const step = createStep("5️⃣ 내부 선반 선택");
    const count = Number(state.shelf_level_total) || 1;

    const options = Array.from({ length: count }, (_, i) => ({
      label: `${i + 1}단`,
      value: i + 1,
    }));

    const group = createButtonGroup(
      options,
      (val) => {
        state.internal_shelf_level = Number(val);
        clearNextSteps(container, 5);
        loadColumns(container);
      },
      state.internal_shelf_level
    );

    step.appendChild(group);
    container.appendChild(step);
  }

  // -------------------------------------------------------------
  // 🔹 6. 칸(열) 선택
  // -------------------------------------------------------------
  function loadColumns(container) {
    const step = createStep("6️⃣ 칸(열) 선택");
    const count = Number(state.storage_column_total) || 1;

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
  // 🔹 초기화 (inventory-form / kits-modal 에서 호출)
  // -------------------------------------------------------------
  async function init(containerId, defaultValue = {}, mode = "INVENTORY") {
    const container = document.getElementById(containerId);
    if (!container) return console.error("❌ StorageSelector: container not found");

    container.innerHTML = "";

    // 모드 설정
    state.mode = mode;

    Object.assign(state, {
      area_id: defaultValue.area_id || null,
      area_name: defaultValue.area_name || null, // ✅ 이름 복원
      cabinet_id: defaultValue.cabinet_id || null,
      cabinet_name: defaultValue.cabinet_name || null, // ✅ 이름 복원

      door_vertical: defaultValue.door_vertical || null,
      door_horizontal: defaultValue.door_horizontal || null,
      internal_shelf_level: defaultValue.internal_shelf_level || null,
      storage_column: defaultValue.storage_column || null,
    });

    await loadAreas(container);

    // 기본값 자동 오픈 (순차적)
    if (state.area_id) await loadCabinets(container, state.area_id);
    if (state.cabinet_id) {
      // loadCabinets 내부에서 구조를 읽으므로, 비동기 처리를 기다려야 하지만
      // 여기서는 간단히 UI 순차 렌더링을 위해 약간의 지연이나 구조 호출을 보장해야 함.
      // loadCabinets가 async이므로 await loadCabinets 완료 후 구조가 state에 로드됨.

      // 그 후 UI 그리기
      if (state.door_vertical) loadDoorVertical(container);
      if (state.door_horizontal) loadDoorHorizontal(container);
      if (state.internal_shelf_level) loadShelfLevels(container);
      if (state.storage_column) loadColumns(container);
    }
  }

  function getSelection() {
    return { ...state };
  }

  // 전역 등록
  globalThis.App = getApp();
  globalThis.App.StorageSelector = { init, getSelection };
})();
