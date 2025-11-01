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
    const verticalMap = { "상중하도어": 3, "상하도어": 2, "단일도어": 1, "단일도어(상하분리없음)": 1 };
    const horizontalMap = { "좌우분리도어": 2, "단일도어": 1 };

    // 1. 시약장 이름 결정 (기존 로직)
    const cabinetName = state.name || state.cabinet_custom_name || state.cabinet_name_buttons || state.cabinet_name || null;

    // 2. ⬇️ [수정됨] 장소 이름(state.area)으로 DB에서 ID를 조회합니다.
    let finalAreaId = state.area_id; // '수정' 모드의 초기 ID
    const selectedAreaName = state.area;

    // 사용자가 '기타'가 아닌 다른 장소를 클릭했을 때 (selectedAreaName에 값이 있을 때)
    if (selectedAreaName && selectedAreaName !== "기타") {
        const { data: area, error } = await App.supabase
            .from("Area")
            .select("id")
            .eq("name", selectedAreaName)
            .maybeSingle();
        console.log("🏠 Area 조회 결과:", area, "selectedAreaName:", selectedAreaName);
        
        if (error) throw new Error("장소 ID 조회 오류: " + error.message);
        if (area) {
            finalAreaId = area.id; // ⬅️ 조회된 최신 ID로 덮어씀
        } else {
            // DB에 없는 이름이면 '기타'로 간주 (신규 장소 등록)
            finalAreaId = null;
            state.area_custom_name = selectedAreaName;
        }
    } else if (selectedAreaName === "기타") {
        finalAreaId = null; // '기타' 버튼을 누르면 ID는 null
    }
    // ⬆️ [수정 완료]

    return {
        name: cabinetName,
        area_id: finalAreaId, // ⬅️ [수정됨] DB에서 조회한 ID
        area_custom_name: state.area_custom_name, 

        // 텍스트 값을 숫자로 변환
        door_vertical_count: verticalMap[state.door_vertical_split_buttons] || null,
        door_horizontal_count: horizontalMap[state.door_horizontal_split_buttons] || null,
        shelf_height: state.shelf_height ? parseInt(state.shelf_height) : null,
        storage_columns: state.storage_columns ? parseInt(state.storage_columns) : null,

        // 사진 데이터
        photo_320_base64: state.photo_320_base64 || null,
        photo_160_base64: state.photo_160_base64 || null,
        photo_url_320: state.mode === 'edit' && !state.photo_320_base64 ? state.photo_url_320 : null,
        photo_url_160: state.mode === 'edit' && !state.photo_160_base64 ? state.photo_url_160 : null,
    };
}

  globalThis.App = globalThis.App || {};
  globalThis.App.Utils = { sleep, collectFormData, setupButtonGroup, makePayload };
})();
