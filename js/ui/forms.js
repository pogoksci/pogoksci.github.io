// ================================================================
// /js/ui/forms.js — 폼 상태/UI 관리 (App.Forms)
// ================================================================
(function () {
    // ⬇️ 필요한 함수들을 전역 App 객체에서 가져옵니다.
    const { setupButtonGroup, makePayload } = App.Utils;
    const { set, get, reset, dump } = App.State;
    // ⬇️ 카메라 함수들을 App.Camera에서 가져옵니다.
    const { start: startCamera, setupModalListeners, processImage, updatePreview } = App.Camera;

    // -------------------------------------------------
    // 💾 저장 버튼 클릭 시
    // -------------------------------------------------
    async function handleSave() {
        try {
            const state = dump(); // 현재 폼 상태 가져오기
            const payload = makePayload(state); // 전송할 데이터로 가공

            // 유효성 검사
            if (!payload.name) return alert("시약장 이름을 선택하거나 입력하세요.");
            if (!payload.area_id && !payload.area_custom_name) return alert("시약장 위치를 선택하세요.");

            if (state.mode === "create") {
                await App.Cabinet.createCabinet(payload);
                alert("✅ 시약장이 등록되었습니다.");
            } else {
                await App.Cabinet.updateCabinet(state.cabinetId, payload);
                alert("✅ 시약장 정보가 수정되었습니다.");
            }
            await App.includeHTML("pages/location-list.html"); // 완료 후 목록으로 복귀
        } catch (err) {
            console.error("❌ handleSave 오류:", err);
            alert("저장 중 오류가 발생했습니다.");
        }
    }

    // -------------------------------------------------
    // 🧭 시약장 폼 초기화 (등록/수정 공용 진입점)
    // -------------------------------------------------
    async function initCabinetForm(mode = "create", detail = null) {
        console.log("🧭 initCabinetForm()", mode, detail);

        // ✅ 1️⃣ 폼 HTML을 먼저 로드
        await App.includeHTML("pages/cabinet-form.html", "form-container");

        // ✅ 2️⃣ 상태 객체(state) 초기화
        reset();
        set("mode", mode);
        if (detail) {
            Object.entries(detail).forEach(([k, v]) => set(k, v));
            set("cabinetId", detail.id);
            set("area_id", detail.area_id?.id || null);
            // '기타'로 직접 입력한 경우를 위해 area_id.name을 area_custom_name으로 저장
            set("area_custom_name", detail.area_id?.name || null);
        }

        // ✅ 3️⃣ DOM 요소 가져오기
        const title = document.querySelector("#cabinet-creation-form h2");
        const submitBtn = document.getElementById("cabinet-submit-button");
        const saveBtn = document.getElementById("cabinet-save-btn");
        const cancelBtn = document.getElementById("cancel-form-btn");

        // ✅ 4️⃣ 제목, 버튼 텍스트, 이벤트 핸들러
        if (title) title.textContent = mode === "edit" ? `${detail?.name || "시약장"} 정보 수정` : "시약장 등록";

        if (mode === "edit") {
            if (submitBtn) submitBtn.style.display = "none";
            if (saveBtn) {
                saveBtn.style.display = "inline-block";
                saveBtn.onclick = (e) => { e.preventDefault(); handleSave(); };
            }
        } else {
            if (submitBtn) {
                submitBtn.style.display = "inline-block";
                submitBtn.onclick = (e) => { e.preventDefault(); handleSave(); };
            }
            if (saveBtn) saveBtn.style.display = "none";
        }

        if (cancelBtn)
            cancelBtn.onclick = () => App.includeHTML("pages/location-list.html");

        // ✅ 5️⃣ 버튼 그룹 초기화
        ["area-button-group", "cabinet_name_buttons", "door_vertical_split_buttons", "door_horizontal_split_buttons", "shelf_height_buttons", "storage_columns_buttons"]
            .forEach((id) => setupButtonGroup(id, (btn) => {
                const key = id.replace("_buttons", "");
                App.State.set(key, btn.dataset.value);
                if (id === 'area-button-group') {
                    // '기타'가 아닌 실제 장소 버튼을 눌렀을 때만 area_id를 설정
                    const areaId = btn.dataset.value !== '기타' ? parseInt(btn.dataset.id) : null;
                    App.State.set('area_id', areaId);
                }
            }));

        // ⬇️ [수정됨] 6️⃣ 사진/카메라 기능 초기화 (올바른 ID 사용)
        const photoInput = document.getElementById("cabinet-photo-input");
        const cameraInput = document.getElementById("cabinet-camera-input");
        const previewBox = document.getElementById("cabinet-photo-preview");
        const cameraBtn = document.getElementById("cabinet-camera-btn");
        const photoBtn = document.getElementById("cabinet-photo-btn");

        if (photoBtn && photoInput) {
            photoBtn.onclick = () => photoInput.click();
        }
        if (cameraBtn && typeof startCamera === "function") {
            cameraBtn.onclick = () => startCamera();
        }
        if (typeof setupModalListeners === "function") {
            setupModalListeners();
        }

        const handleFile = (file) => {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                processImage(e.target.result, (resized) => {
                    App.State.set("photo_320_base64", resized.base64_320);
                    App.State.set("photo_160_base64", resized.base64_160);
                    if (previewBox) {
                        previewBox.innerHTML = `<img src="${resized.base64_320}" alt="Preview">`;
                    }
                });
            };
            reader.readAsDataURL(file);
        };

        if (photoInput) photoInput.onchange = (e) => handleFile(e.target.files[0]);
        if (cameraInput) cameraInput.onchange = (e) => handleFile(e.target.files[0]);

        // ✅ 7️⃣ '기타' 버튼 로직 연결
        setupOtherButtonLogic("area-other-btn", "area-other-group", "area-other-input", "area-button-group", "area_custom_name");
        setupOtherButtonLogic("cabinet-other-btn", "cabinet-other-group", "cabinet-other-input", "cabinet_name_buttons", "cabinet_custom_name");

        // ✅ 8️⃣ [수정됨] edit 모드일 경우 기존 선택 반영 (마지막에 호출)
        if (mode === "edit" && detail) {
            applyExistingSelection(detail);
            if (detail.photo_url_320) {
                updatePreview(detail.photo_url_320, 'cabinet-photo-preview');
            }
        }
        
        console.log(`✅ 시약장 폼 초기화 완료 (${mode})`);
    }

    // -------------------------------------------------
    // ✍️ 폼 데이터 채우기 (수정 모드)
    // -------------------------------------------------
    function applyExistingSelection(detail) {
        console.log("🎯 applyExistingSelection", detail);
        
        // 맵핑 정보
        const verticalMap = { 3: "상중하도어", 2: "상하도어", 1: "단일도어(상하분리없음)" };
        const horizontalMap = { 2: "좌우분리도어", 1: "단일도어" };
        
        const preselect = (groupId, value) => {
            if (value == null) return;
            const btn = document.querySelector(`#${groupId} button[data-value="${value}"]`);
            if (btn) btn.classList.add("active");
        };

        // ① 장소 버튼
        const areaBtn = document.querySelector(`#area-button-group button[data-value="${detail.area_id?.name}"]`);
        if (areaBtn) {
            areaBtn.classList.add("active");
        } else { // '기타' 항목 처리
            const otherBtn = document.getElementById("area-other-btn");
            if (otherBtn) otherBtn.classList.add("active");
            const otherGroup = document.getElementById("area-other-group");
            const otherInput = document.getElementById("area-other-input");
            if (otherGroup && otherInput) {
                otherGroup.style.display = "block";
                otherInput.value = detail.area_id?.name || ""; // 기타 이름 표시
                //otherInput.disabled = true; // 수정 불가
            }
        }
        //document.querySelectorAll("#area-button-group button").forEach((b) => (b.disabled = true));

        // ② 시약장 이름 버튼
        const nameBtn = document.querySelector(`#cabinet_name_buttons button[data-value="${detail.name}"]`);
        if (nameBtn) {
            nameBtn.classList.add("active");
        } else { // '기타' 항목 처리
            const otherBtn = document.getElementById("cabinet-other-btn");
            if (otherBtn) otherBtn.classList.add("active");
            const otherGroup = document.getElementById("cabinet-other-group");
            const otherInput = document.getElementById("cabinet-other-input");
            if (otherGroup && otherInput) {
                otherGroup.style.display = "block";
                otherInput.value = detail.name || ""; // 기타 이름 표시
                otherInput.disabled = true; // 수정 불가
            }
        }
        //document.querySelectorAll("#cabinet_name_buttons button").forEach((b) => (b.disabled = true));
        document.querySelectorAll("#cabinet_name_buttons button").forEach((b) => (b.disabled = true));
        document.querySelectorAll("#cabinet_other_input").forEach((input) => (input.disabled = true));


        // ⬇️ [수정됨] ③ 나머지 선택 항목 자동 반영
        preselect("door_vertical_split_buttons", verticalMap[detail.door_vertical_count]);
        preselect("door_horizontal_split_buttons", horizontalMap[detail.door_horizontal_count]);
        preselect("shelf_height_buttons", detail.shelf_height?.toString());
        preselect("storage_columns_buttons", detail.storage_columns?.toString());
    }

    // -------------------------------------------------
    // 📎 '기타' 버튼 로직 헬퍼
    // -------------------------------------------------
    function setupOtherButtonLogic(btnId, groupId, inputId, buttonGroupId, stateKey) {
        const otherBtn = document.getElementById(btnId);
        const otherGroup = document.getElementById(groupId);
        const otherInput = document.getElementById(inputId);
        const buttonGroup = document.getElementById(buttonGroupId);

        if (!otherBtn || !otherGroup || !otherInput || !buttonGroup) return;

        otherBtn.addEventListener("click", () => {
            buttonGroup.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
            otherBtn.classList.add("active");
            otherGroup.style.display = "block";
            otherInput.focus();
            App.State.set(stateKey, otherInput.value.trim() || "기타");
        });

        otherInput.addEventListener("input", (e) => {
            App.State.set(stateKey, e.target.value.trim());
        });

        buttonGroup.querySelectorAll(`button:not(#${btnId})`).forEach(btn => {
            btn.addEventListener("click", () => {
                otherGroup.style.display = "none";
                App.State.set(stateKey, null);
            });
        });
    }

    // -------------------------------------------------
    // (다른 종류 폼을 위한 임시 함수)
    // -------------------------------------------------
    function initInventoryForm() {
        console.log("🧪 initInventoryForm() (placeholder)");
        // 나중에 이 함수도 initCabinetForm처럼 구현됩니다.
    }

    // -------------------------------------------------
    // 전역 등록
    // -------------------------------------------------
    globalThis.App = globalThis.App || {};
    globalThis.App.Forms = {
        initCabinetForm,
        initInventoryForm,
        handleSave,
        applyExistingSelection
    };
})();