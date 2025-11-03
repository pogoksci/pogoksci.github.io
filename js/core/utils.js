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
  const verticalMap = {
    "상중하도어": 3,
    "상하도어": 2,
    "단일도어": 1,
    "단일도어(상하분리없음)": 1,
  };
  const horizontalMap = { "좌우분리도어": 2, "단일도어": 1 };

  // ⬇️ [수정됨] '기타' 입력값, '클릭'한 버튼 값, '초기' 이름 값 순서로 확인합니다.
  const cabinetName = state.cabinet_custom_name || state.cabinet_name_buttons || state.cabinet_name;
  // ⬇️ [수정됨] 'area' 키도 확인합니다.
  const areaName = state.area_custom_name || state.area;

  // ✅ Area 관련 DB 접근 제거 (Edge Function에서 처리)
  console.log("💾 makePayload (Edge용) 결과:", {
  });

  // 3️⃣ 최종 반환 (Edge Function 입력 구조에 맞춤)
  return {
    name: cabinetName,
    area_id: state.area_id,
    area_custom_name: areaName, // '기타'일 경우와 일반 이름 모두 areaName 변수 사용

    // ⬇️ [수정됨] state의 키 이름을 버튼 그룹 id에서 '_buttons'가 빠진 이름으로 수정
    door_vertical_count: verticalMap[state.door_vertical_split] || null,
    door_horizontal_count: horizontalMap[state.door_horizontal_split] || null,
    shelf_height: state.shelf_height ? parseInt(state.shelf_height, 10) : null,
    storage_columns: state.storage_columns ? parseInt(state.storage_columns, 10) : null,

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
