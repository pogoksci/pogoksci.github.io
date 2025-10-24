// /js/core/fab.js

(function () {
    /**
     * FAB 버튼 표시/숨김을 제어하는 함수
     * @param {boolean} visible - true이면 표시, false이면 숨김
     */
    function setVisibility(visible) {
        const fab = document.getElementById("fab-button");
        if (fab) {
            fab.style.display = visible ? "block" : "none";
        }
    }

    // App 전역 객체가 없으면 생성
    globalThis.App = globalThis.App || {};

    // App.Fab 객체를 생성하고, 그 안에 setVisibility 함수를 등록
    globalThis.App.Fab = {
        setVisibility: setVisibility
    };
})();