// /js/core/fab.js
(function () {
    /**
     * FAB 버튼 표시/숨김을 제어하는 함수
     * @param {boolean} visible - true이면 표시, false이면 숨김
     */
    function setVisibility(visible, text = null, onClickAction = null) {
        const fab = document.getElementById("fab-button");
        if (!fab) return;

            // 1. 표시 여부 설정
            fab.style.display = visible ? "block" : "none";

            if (visible) {
                // 2. 텍스트 설정
                if (text) {
                    fab.textContent = text;
                }
                // 3. 클릭 이벤트 설정
                if (onClickAction) {
                    fab.onclick = onClickAction;
                }
            } else {
                // 숨길 때는 클릭 이벤트 제거 (메모리 누수 방지)
                fab.onclick = null;
            }        
    }

    // App 전역 객체가 없으면 생성
    globalThis.App = globalThis.App || {};

    // App.Fab 객체를 생성하고, 그 안에 setVisibility 함수를 등록
    globalThis.App.Fab = {
        setVisibility: setVisibility
        // (참고: initFabButton 함수는 app-bootstrap.js가 그 역할을 대신하므로 삭제되었습니다.)
    };
})();