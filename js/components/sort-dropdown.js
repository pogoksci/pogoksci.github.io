// ================================================================
// /js/components/sort-dropdown.js — 공용 정렬 드롭다운 모듈
// Deno Lint 0 / App.SortDropdown 호환 / 재사용 가능 구조
// ================================================================
(function () {
  console.log("🔽 SortDropdown 모듈 로드됨");

  /**
   * @typedef {Object} SortDropdownOptions
   * @property {function(string):void} onChange - 정렬 기준 변경 시 실행
   * @property {function():void} onRefresh - 새로고침 버튼 클릭 시 실행
   * @property {string} [defaultLabel="정렬 기준"] - 초기 라벨
   * @property {string} [defaultValue=""] - 초기 정렬값
   */

  /**
   * 정렬 드롭다운 초기화
   * @param {SortDropdownOptions} opts
   */
  function init(opts = {}) {
    const {
      onChange = () => { },
      onRefresh = () => { },
      defaultLabel = "정렬 기준",
      defaultValue = "",
    } = opts;

    const toggle = document.getElementById("sort-toggle");
    const menu = document.getElementById("sort-menu");
    const label = document.getElementById("sort-label");
    const refreshBtn = document.getElementById("refresh-btn");

    if (!toggle || !menu || !label) {
      console.warn("⚠️ SortDropdown 요소를 찾을 수 없습니다.");
      return;
    }

    // ✅ 초기 라벨 설정
    label.textContent = defaultLabel;
    label.dataset.value = defaultValue;

    // ✅ 드롭다운 토글
    toggle.addEventListener("click", (e) => {
      console.log("🖱️ Sort Toggle Clicked");
      e.stopPropagation();
      menu.classList.toggle("open");
      console.log("📂 Menu Open State:", menu.classList.contains("open"));
    });

    // ✅ 옵션 클릭 처리
    menu.querySelectorAll(".dropdown-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const value = item.dataset.value || "";
        // 아이콘 텍스트(ligature) 제외하고 순수 텍스트만 추출
        const textNode = Array.from(item.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        const text = textNode ? textNode.textContent.trim() : item.textContent.trim();
        label.textContent = text;
        label.dataset.value = value;
        menu.classList.remove("open");

        if (typeof onChange === "function") {
          onChange(value);
        }
      });
    });

    // ✅ 외부 클릭 시 닫기
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && !toggle.contains(e.target)) {
        menu.classList.remove("open");
      }
    });

    // ✅ 새로고침 버튼 (Material Symbol)
    if (refreshBtn) {
      refreshBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (typeof onRefresh === "function") onRefresh();
      });
    }

    console.log("✅ SortDropdown 초기화 완료");
  }

  // ------------------------------------------------------------
  // 전역 등록 (App.SortDropdown)
  // ------------------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.SortDropdown = { init };
})();
