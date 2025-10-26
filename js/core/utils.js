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
    //const newGroup = group.cloneNode(true);
    //group.parentNode.replaceChild(newGroup, group);

    newGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      newGroup.querySelectorAll(".active").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (typeof onSelect === "function") onSelect(btn);

      const otherGroup = document.getElementById(groupId.replace("_buttons", "_group"));
      if (otherGroup) otherGroup.style.display = btn.dataset.value === "기타" ? "block" : "none";
    });
  }

  function makePayload(state) {
    const verticalMap = { "상중하도어": 3, "상하도어": 2, "단일도어": 1, "단일도어(상하분리없음)": 1 };
    const horizontalMap = { "좌우분리도어": 2, "단일도어": 1 };

    return {
      name: state.name,
      area_id: state.area_id,
      door_vertical_count: verticalMap[state.door_vertical_value] ?? state.door_vertical_count ?? null,
      door_horizontal_count: horizontalMap[state.door_horizontal_value] ?? state.door_horizontal_count ?? null,
      shelf_height: parseInt(state.shelf_height, 10) || null,
      storage_columns: parseInt(state.storage_columns, 10) || null,
      photo_url_320: state.photo_url_320 || null,
      photo_url_160: state.photo_url_160 || null,
    };
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.Utils = { sleep, collectFormData, setupButtonGroup, makePayload };
})();
