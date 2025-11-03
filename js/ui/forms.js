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
            const state = App.State.dump(); // ✅ App.State에서 가져오는 게 명확
            const payload = await App.Utils.makePayload(state); // ✅ await 필수
            console.log("💾 payload 확인:", payload);

            // 유효성 검사
            if (!payload.cabinet_name) return alert("시약장 이름을 선택하거나 입력하세요.");
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
            set("area_custom_name", detail.area_id?.name || null);
            // ⬇️ [수정됨] 'makePayload'가 찾는 'cabinet_name'에도 값을 설정합니다.
            set("cabinet_name", detail.name);
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
            document.querySelectorAll("#cabinet_name_buttons button").forEach(b => b.disabled = true);
            const otherInput = document.getElementById("cabinet-other-input") || document.getElementById("cabinet_other_input");
            if (otherInput) otherInput.disabled = true;
        } else {
            if (submitBtn) {
                submitBtn.style.display = "inline-block";
                submitBtn.onclick = (e) => { e.preventDefault(); handleSave(); };
            }
            if (saveBtn) saveBtn.style.display = "none";
        }

        if (cancelBtn)
            cancelBtn.onclick = () => App.includeHTML("pages/location-list.html");

        // ✅ 5️⃣ 버튼 그룹 초기화 (수정된 버전)
        (function initButtonGroups() {
        // 미리 DOM 캐시
        const areaGroupEl = document.getElementById("area-button-group");
        const areaOtherGroup = document.getElementById("area-other-group");
        const areaOtherInput = document.getElementById("area-other-input");

        const cabGroupEl = document.getElementById("cabinet_name_buttons");
        const cabOtherGroup = document.getElementById("cabinet-other-group") || document.getElementById("cabinet_other-group");
        const cabOtherInput = document.getElementById("cabinet-other-input") || document.getElementById("cabinet_other_input");

        // 🔹 1) 장소 버튼 그룹 -------------------------------------------------
        setupButtonGroup("area-button-group", (btn) => {
            // 1-1. active 표시를 우리가 확실히 관리 (부수효과 최소화)
            areaGroupEl.querySelectorAll("button").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const val = btn.dataset.value;
            const id = btn.dataset.id ? parseInt(btn.dataset.id) : null; // ⬅️ [수정됨] id 가져오기

            if (val === "기타") {
            // 기타 선택 상태 기록
            App.State.set("area_id", null);
                App.State.set("area", "기타"); // ⬅️ [수정됨] 'area' 키에도 저장
                App.State.set("area_custom_name", areaOtherInput.value.trim());

                // "기타 입력칸 보이기": display 직접 만지지 말고 class만
                areaOtherGroup.classList.add("show");
                // focus는 즉시 주지 말고, 살짝 늦게 줘서 레이아웃 흔들지 않게
                setTimeout(() => {
                    areaOtherInput.focus();
                }, 0);
            } else {
            // 일반 장소 선택: 입력란 숨기기
            App.State.set("area_id", id); // ⬅️ [수정됨] 올바른 id 저장
            App.State.set("area", val); // ⬅️ [수정됨] 'area' 키에 저장
            App.State.set("area_custom_name", null);
            areaOtherGroup.style.display = "none";
            //areaOtherInput.value = ""; // 입력값 초기화 (선택사항)
            }
        });

        // 기타 입력칸에 대한 input 리스너는 한 번만
        if (areaOtherInput && !areaOtherInput._bound) {
            areaOtherInput.addEventListener("input", (e) => {
            App.State.set("area_custom_name", e.target.value.trim());
            });
            areaOtherInput._bound = true;
        }

        // 🔹 2) 시약장 이름 버튼 그룹 -----------------------------------------
        setupButtonGroup("cabinet_name_buttons", (btn) => {
            // active 확실히 관리
            cabGroupEl.querySelectorAll("button").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const val = btn.dataset.value;

            if (val === "기타") {
                // 기타 상태 저장
                App.State.set("cabinet_name_buttons", "기타");
                App.State.set("cabinet_custom_name", cabOtherInput.value.trim());

                // 기타 입력박스 보여주기 (class로)
                if (cabOtherGroup) cabOtherGroup.classList.add("show");

                // 마찬가지로 focus는 다음 tick
                if (cabOtherInput) {
                    setTimeout(() => {
                    cabOtherInput.focus();
                    }, 0);
                }
            } else {
                // 일반 이름
                App.State.set("cabinet_name_buttons", val);
                App.State.set("cabinet_custom_name", null);

                // 기타 입력칸 숨김
                if (cabOtherGroup) cabOtherGroup.classList.remove("show");
            }
        });

        // 기타 입력칸 리스너도 한 번만
        if (cabOtherInput && !cabOtherInput._bound) {
            cabOtherInput.addEventListener("input", (e) => {
            App.State.set("cabinet_custom_name", e.target.value.trim());
            });
            cabOtherInput._bound = true;
        }

        // 🔹 3) 나머지 그룹들 (도어/선반/열) ----------------------------------
        ["door_vertical_split_buttons", "door_horizontal_split_buttons", "shelf_height_buttons", "storage_columns_buttons"]
            .forEach((id) => {
                setupButtonGroup(id, (btn) => {
                const key = id.replace("_buttons", "");
                App.State.set(key, btn.dataset.value);
                });
            });
        })();

        // ✅ 기타 입력칸 표시 로직 (명시적 표시)
        const areaOtherBtn = document.getElementById("area-other-btn");
        const areaOtherGroup = document.getElementById("area-other-group");
        const areaOtherInput = document.getElementById("area-other-input");

        if (areaOtherBtn && areaOtherGroup && areaOtherInput) {
        areaOtherBtn.addEventListener("click", () => {
            document.querySelectorAll("#area-button-group button").forEach(b => b.classList.remove("active"));
            areaOtherBtn.classList.add("active");
            areaOtherGroup.style.display = "block";
            areaOtherInput.focus();
            App.State.set("area_id", null);
        });
        areaOtherInput.addEventListener("input", e => {
            App.State.set("area_custom_name", e.target.value.trim());
        });
        }

        const cabOtherBtn = document.getElementById("cabinet-other-btn");
        const cabOtherGroup = document.getElementById("cabinet-other-group") || document.getElementById("cabinet_other-group");
        const cabOtherInput = document.getElementById("cabinet-other-input") || document.getElementById("cabinet_other_input");

        if (cabOtherBtn && cabOtherGroup && cabOtherInput) {
        cabOtherBtn.addEventListener("click", () => {
            document.querySelectorAll("#cabinet_name_buttons button").forEach(b => b.classList.remove("active"));
            cabOtherBtn.classList.add("active");
            cabOtherGroup.style.display = "block";
            cabOtherInput.focus();
            App.State.set("cabinet_name", "기타");
        });
        cabOtherInput.addEventListener("input", e => {
            App.State.set("cabinet_custom_name", e.target.value.trim());
        });
        }

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
        //setupOtherButtonLogic("area-other-btn", "area-other-group", "area-other-input", "area-button-group", "area_custom_name");
        //setupOtherButtonLogic("cabinet-other-btn", "cabinet-other-group", "cabinet-other-input", "cabinet_name_buttons", "cabinet_custom_name");

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
            const otherBtn = document.getElementById("cabinet-other-btn");
            if (otherBtn) otherBtn.classList.add("active");
            const otherGroup = document.getElementById("cabinet-other-group") || document.getElementById("cabinet_other-group");
            const otherInput = document.getElementById("cabinet-other-input") || document.getElementById("cabinet_other_input");
            if (otherGroup && otherInput) {
                // ✅ 기타 입력칸 항상 표시
                otherGroup.style.display = "block";
                // ✅ 기존 입력값 복원
                otherInput.value = detail.cabinet_custom_name || detail.name || "";
                // ✅ 수정 금지
                otherInput.disabled = true;
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
        document.querySelectorAll("#cabinet_name_buttons button").forEach((b) => (b.disabled = true));
        //document.querySelectorAll("#cabinet_name_buttons button").forEach((b) => (b.disabled = true));
        //document.querySelectorAll("#cabinet_other_input").forEach((input) => (input.disabled = true));


        // ⬇️ [수정됨] ③ 나머지 선택 항목 자동 반영
        preselect("door_vertical_split_buttons", verticalMap[detail.door_vertical_count]);
        preselect("door_horizontal_split_buttons", horizontalMap[detail.door_horizontal_count]);
        preselect("shelf_height_buttons", detail.shelf_height?.toString());
        preselect("storage_columns_buttons", detail.storage_columns?.toString());
    }

    // -------------------------------------------------
    // 📎 '기타' 버튼 로직 헬퍼
    // -------------------------------------------------
    //function setupOtherButtonLogic(btnId, groupId, inputId, buttonGroupId, stateKey) {
    //    const otherBtn = document.getElementById(btnId);
    //    const otherGroup = document.getElementById(groupId);
    //    const otherInput = document.getElementById(inputId);
    //    const buttonGroup = document.getElementById(buttonGroupId);
//
//        if (!otherBtn || !otherGroup || !otherInput || !buttonGroup) return;

//        otherBtn.addEventListener("click", () => {
//            buttonGroup.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
//            otherBtn.classList.add("active");
//            otherGroup.style.display = "block";
//            otherInput.focus();
//            App.State.set(stateKey, otherInput.value.trim() || "기타");
//        });

//        otherInput.addEventListener("input", (e) => {
//            App.State.set(stateKey, e.target.value.trim());
//        });
//    }

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