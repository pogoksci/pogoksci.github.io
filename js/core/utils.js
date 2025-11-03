// ================================================================
// /js/core/utils.js — 공용 유틸리티 (Deno/브라우저 호환)
// ================================================================
(function () {
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function collectFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    new FormData(form).forEach((v, k) => (data[k] = v));
    return data;
  }

  function setupButtonGroup(groupId, onSelect) {
    const group = document.getElementById(groupId);
    if (!group) return;

    // ✅ [수정됨] newGroup.addEventListener -> group.addEventListener
    group.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        // '수정' 모드에서 비활성화된 버튼은 클릭되지 않도록 방지
        if (btn.disabled) return;

        // ✅ [수정됨] newGroup.querySelectorAll -> group.querySelectorAll
        group.querySelectorAll(".active").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        if (typeof onSelect === "function") {
            onSelect(btn);
        }
    });
  }

async function makePayload(state) {
  const verticalMap = {
    "상중하도어": 3,
    "상하도어": 2,
    "단일도어": 1,
    "단일도어(상하분리없음)": 1,
  };
  const horizontalMap = { "좌우분리도어": 2, "단일도어": 1 };

  // 1️⃣ 시약장 이름
  const cabinetName =
    state.name ||
    state.cabinet_custom_name ||
    state.cabinet_name_buttons ||
    state.cabinet_name ||
    null;

  // 2️⃣ 장소 이름 (area_name)
  let areaName = state.area_custom_name || state.area || "미지정 장소";

  // ✅ Area 관련 DB 접근 제거 (Edge Function에서 처리)
  console.log("💾 makePayload (Edge용) 결과:", {
    cabinet_name: cabinetName,
    area_name: areaName,
  });

  // 3️⃣ 최종 반환 (Edge Function 입력 구조에 맞춤)
  return {
    area_name: areaName,
    cabinet_name: cabinetName,
    door_vertical_count: verticalMap[state.door_vertical_split_buttons] || null,
    door_horizontal_count: horizontalMap[state.door_horizontal_split_buttons] || null,
    shelf_height: state.shelf_height ? parseInt(state.shelf_height) : null,
    storage_columns: state.storage_columns ? parseInt(state.storage_columns) : null,
    photo_320_base64: state.photo_320_base64 || null,
    photo_160_base64: state.photo_160_base64 || null,
  };
}

globalThis.App = globalThis.App || {};
globalThis.App.Utils = { sleep, collectFormData, setupButtonGroup, makePayload };
})();
