// /js/core/fab.js
(function () {
    // App 전역 객체가 없으면 생성
    globalThis.App = globalThis.App || {};

    // App.Fab 객체를 생성하고, 그 안에 setVisibility 함수를 직접 정의
    globalThis.App.Fab = {
        setVisibility: function(visible) {
            const fab = document.getElementById("fab-button");
            if (fab) {
                fab.style.display = visible ? "block" : "none";
            }
        }
    };
})();