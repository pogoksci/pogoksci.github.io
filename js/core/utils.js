// ====================================================================
// 공통 유틸 함수 (페이지 로드, FAB 표시 등)
// ====================================================================

function includeHTML(url, targetElementId, callback) {
  fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      return response.text();
    })
    .then((html) => {
      const el = document.getElementById(targetElementId);
      if (!el) return console.error(`Target #${targetElementId} not found`);
      el.innerHTML = html;
      if (callback) callback();
    })
    .catch((err) => console.error("includeHTML() 오류:", err));
}

function setFabVisibility(visible) {
  const fab = document.querySelector(".fab");
  if (fab) fab.style.display = visible ? "block" : "none";
}
