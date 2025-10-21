// ================================================================
// utils.js — 공용 유틸리티 함수
// ================================================================
(function () {
  /**
   * 🧩 객체 데이터를 폼 필드에 자동 채워넣기
   * @param {Object} data - Supabase 또는 JSON 객체
   * @param {string} [formId] - (선택) 특정 폼 ID 지정
   */
  function fillFormFromData(data, formId = null) {
    if (!data || typeof data !== "object") return;

    const root = formId ? document.getElementById(formId) : document;

    Object.entries(data).forEach(([key, value]) => {
      const input = root.querySelector(`#${key}`);
      if (!input) return; // 없는 요소는 무시

      if (input.type === "checkbox") {
        input.checked = !!value;
      } else if (input.tagName === "SELECT" || input.tagName === "TEXTAREA") {
        input.value = value ?? "";
      } else if ("value" in input) {
        input.value = value ?? "";
      }
    });
  }

  /**
   * 🧾 폼의 입력값을 자동으로 객체로 수집
   * @param {string} formId - 폼 ID
   * @returns {Object} formData
   */
  function collectFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) {
      console.warn(`❌ collectFormData: #${formId} not found`);
      return {};
    }

    const formData = {};
    const elements = form.querySelectorAll("input, select, textarea");

    elements.forEach((el) => {
      const key = el.id || el.name;
      if (!key) return;

      if (el.type === "checkbox") {
        formData[key] = el.checked;
      } else if (el.type === "number") {
        formData[key] = el.value ? parseFloat(el.value) : null;
      } else {
        formData[key] = el.value?.trim() ?? null;
      }
    });

    return formData;
  }

  /** 📦 간단한 딜레이 */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** 🎨 스타일 로그 */
  const logStyled = (msg, color = "cyan") =>
    console.log(`%c${msg}`, `color:${color}; font-weight:bold;`);

  // 전역 등록
  window.fillFormFromData = fillFormFromData;
  window.collectFormData = collectFormData;
  window.sleep = sleep;
  window.logStyled = logStyled;
})();
