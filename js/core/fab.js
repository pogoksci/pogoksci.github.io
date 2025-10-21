// js/ui/fab.js
(function () {
  /**
   * FAB 버튼 표시/숨김을 제어하는 함수
   * @param {boolean} visible - true이면 표시, false이면 숨김
   */
  function setFabVisibility(visible) {
    const fab = document.getElementById("fab-button");
    if (!fab) return;
    fab.style.display = visible ? "block" : "none";
  }

  /**
   * FAB 버튼 초기화 (기본 숨김)
   */
  function initFabButton() {
    const fab = document.getElementById("fab-button");
    if (!fab) return;

    fab.style.display = "none"; // 기본은 숨김
    fab.addEventListener("click", () => {
      console.log("📦 FAB 버튼 클릭됨");
      includeHTML("pages/form-input.html"); // 약품 등록 페이지로 이동 예시
    });
  }

  // 전역 등록
  window.setFabVisibility = setFabVisibility;
  window.initFabButton = initFabButton;
})();
