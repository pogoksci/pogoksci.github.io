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

  // 1. 시약장 이름 결정
  // '기타' 입력값 > '등록' 시 클릭한 버튼 값 > '수정' 시 폼에 저장된 초기 이름 값
  const cabinetName = state.cabinet_custom_name || state.cabinet_name_buttons || state.cabinet_name;
  
  // 2. 장소 이름 결정
  // '기타' 입력값 > '등록'/'수정' 시 클릭한 버튼 값 > '수정' 시 폼에 저장된 초기 이름 값
  const areaName = state.area_custom_name || state.area_buttons || state.area_name;

  // 3. ⬇️ [수정됨] 폼 값을 DB 값으로 변환
  // '수정' 모드에서 클릭 안하면 state.door_vertical_split이 없으므로, state.door_vertical_count를 대신 사용
  const doorVertical = state.door_vertical_split
                        ? verticalMap[state.door_vertical_split] // 1. 클릭한 값 (텍스트)
                        : (state.door_vertical_count || null);   // 2. 'edit' 모드의 초기 값 (숫자)

  const doorHorizontal = state.door_horizontal_split
                          ? horizontalMap[state.door_horizontal_split] // 1. 클릭한 값 (텍스트)
                          : (state.door_horizontal_count || null); // 2. 'edit' 모드의 초기 값 (숫자)
  
  const shelfHeight = state.shelf_height_buttons
                      ? parseInt(state.shelf_height_buttons, 10) // 1. 클릭한 값 (텍스트)
                      : (state.shelf_height || null); // 2. 'edit' 모드의 초기 값 (숫자)

  const storageColumns = state.storage_columns_buttons
                          ? parseInt(state.storage_columns_buttons, 10) // 1. 클릭한 값 (텍스트)
                          : (state.storage_columns || null); // 2. 'edit' 모드의 초기 값 (숫자)

  // 3. 최종 반환 (Edge Function 입력 구조에 맞춤)
  return {
      cabinet_name: cabinetName,
      area_name: areaName,
      
      // ⬇️[수정됨] 위에서 계산된 최종 값을 사용
      door_vertical_count: doorVertical,
      door_horizontal_count: doorHorizontal,
      shelf_height: shelfHeight,
      storage_columns: storageColumns,

      // 사진 데이터 (새 사진이 없으면 기존 URL 유지)
      photo_320_base64: state.photo_320_base64 || null,
      photo_160_base64: state.photo_160_base64 || null,
      photo_url_320: state.mode === 'edit' && !state.photo_320_base64 ? state.photo_url_320 : null,
      photo_url_160: state.mode === 'edit' && !state.photo_160_base64 ? state.photo_url_160 : null,
  };
}

globalThis.App = globalThis.App || {};
globalThis.App.Utils = { sleep, collectFormData, setupButtonGroup, makePayload };
})();
