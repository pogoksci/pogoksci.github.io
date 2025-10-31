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

  function makePayload(state) {
    const verticalMap = { "상중하도어": 3, "상하도어": 2, "단일도어": 1, "단일도어(상하분리없음)": 1 };
    const horizontalMap = { "좌우분리도어": 2, "단일도어": 1 };
    // '기타' 입력값 처리
    const areaName = state.area_custom_name || state.area_button_group;
    const cabinetName = state.cabinet_custom_name || state.cabinet_name_buttons || state.cabinet_name;

    return {
        name: cabinetName,
        area_id: state.area_id, // '기타'일 경우 area_id가 null이 됩니다. (Edge Function에서 '기타' 이름으로 Area를 생성해야 함)
        area_custom_name: state.area_custom_name, // '기타'일 때만 값이 있음

        // ⬇️ [수정됨] 텍스트 값을 숫자로 변환
        door_vertical_count: verticalMap[state.door_vertical_split] || null,
        door_horizontal_count: horizontalMap[state.door_horizontal_split] || null,
        shelf_height: state.shelf_height ? parseInt(state.shelf_height) : null,
        storage_columns: state.storage_columns ? parseInt(state.storage_columns) : null,

        // 사진 데이터
        photo_url_320: state.photo_320_base64 || state.photo_url_320 || null,
        photo_url_160: state.photo_160_base64 || state.photo_url_160 || null,
    };
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.Utils = { sleep, collectFormData, setupButtonGroup, makePayload };
})();
