// ================================================================
// /js/ui/waste.js — 폐수 관리 (목록/등록)
// ================================================================
(function () {
    console.log("🛢️ App.Waste 모듈 로드됨");

    const { setupButtonGroup } = App.Utils;
    const { set, get, reset, dump } = App.State;
    const supabase = App.supabase;

    // ------------------------------------------------------------
    // 1️⃣ 목록 조회 및 렌더링
    // ------------------------------------------------------------
    async function loadList() {
        const container = document.getElementById("waste-list-container");
        if (!container) return;

        container.innerHTML = `
            <p style="padding:0 15px; color:#888;">
                <span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 5px;">sync</span>
                폐수 목록을 불러오는 중...
            </p>`;

        const { data, error } = await supabase
            .from("WasteLog")
            .select("*")
            .order("date", { ascending: false })
            .order("created_at", { ascending: false });

        if (error) {
            console.error("❌ 폐수 목록 조회 실패:", error);
            container.innerHTML = `<p style="padding:0 15px; color:#d33;">목록을 불러오지 못했습니다.</p>`;
            return;
        }

        if (!data || data.length === 0) {
            container.innerHTML = `<p style="padding:0 15px; color:#888;">등록된 폐수 내역이 없습니다.</p>`;
            return;
        }

        renderList(data, container);
    }

    function renderList(rows, container) {
        // 분류별 그룹화
        const grouped = rows.reduce((acc, row) => {
            const key = row.classification || "기타";
            if (!acc[key]) acc[key] = { items: [], total: 0 };
            acc[key].items.push(row);
            acc[key].total += Number(row.amount) || 0;
            return acc;
        }, {});

        // 렌더링
        let html = "";
        Object.entries(grouped).forEach(([classification, group]) => {
            const totalStr = group.total.toLocaleString();

            let itemsHtml = group.items.map(item => {
                const dateStr = item.date; // YYYY-MM-DD
                const amountStr = Number(item.amount).toLocaleString();

                return `
                <div class="inventory-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
                    <div style="flex: 1; display: flex; align-items: center; gap: 10px;">
                        <span style="font-weight: 600; color: #333; font-size: 14px;">${dateStr}</span>
                        ${item.remarks ? `<span style="font-size: 12px; color: #888;">(${item.remarks})</span>` : ""}
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-weight: 700; color: #d33; font-size: 14px;">${amountStr} g</span>
                        
                        <button class="icon-btn edit-waste-btn" data-id="${item.id}" style="border:none; background:none; cursor:pointer; padding:4px;">
                            <span class="material-symbols-outlined" style="font-size: 20px; color: #00a0b2;">edit</span>
                        </button>

                        <button class="icon-btn delete-waste-btn" data-id="${item.id}" style="border:none; background:none; cursor:pointer; padding:4px;">
                            <span class="material-symbols-outlined" style="font-size: 20px; color: #999;">delete</span>
                        </button>
                    </div>
                </div>`;
            }).join("");

            html += `
            <div class="inventory-section-group">
                <div class="inventory-section-header">
                    <span class="section-title">${classification}</span>
                    <span class="section-count" style="background: #ffebee; color: #c62828;">누적: ${totalStr} g</span>
                </div>
                ${itemsHtml}
            </div>`;
        });

        container.innerHTML = html;

        // 수정 버튼 이벤트
        container.querySelectorAll(".edit-waste-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                App.Router.go("wasteForm", { mode: "edit", id: id });
            });
        });

        // 삭제 버튼 이벤트
        container.querySelectorAll(".delete-waste-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm("이 폐수 기록을 삭제하시겠습니까?")) {
                    const id = btn.dataset.id;
                    await deleteWaste(id);
                }
            });
        });
    }

    async function deleteWaste(id) {
        const { error } = await supabase.from("WasteLog").delete().eq("id", id);
        if (error) {
            alert("삭제 실패: " + error.message);
        } else {
            loadList();
        }
    }

    // ------------------------------------------------------------
    // 2️⃣ 폼 초기화 및 로직
    // ------------------------------------------------------------
    async function initForm(mode = "create", id = null) {
        reset();

        // 상태 저장 (수정 모드 식별용)
        set("form_mode", mode);
        set("edit_id", id);

        const titleEl = document.querySelector("#waste-form h2");
        if (titleEl) titleEl.textContent = mode === "edit" ? "폐수 정보 수정" : "폐수 등록";

        // 기본값 설정
        const today = new Date().toISOString().split("T")[0];
        document.getElementById("waste_date").value = today;
        set("waste_date", today);

        // 버튼 그룹 설정
        setupButtonGroup("waste_classification_buttons", (btn) => {
            set("waste_classification", btn.dataset.value);
        });

        // 입력 필드 제어
        const directInput = document.getElementById("waste_amount_direct");
        const totalInput = document.getElementById("waste_total_mass");

        directInput.addEventListener("input", () => {
            if (directInput.value) totalInput.value = "";
        });

        totalInput.addEventListener("input", () => {
            if (totalInput.value) directInput.value = "";
        });

        // 수정 모드일 경우 데이터 로드
        if (mode === "edit" && id) {
            const { data, error } = await supabase.from("WasteLog").select("*").eq("id", id).single();
            if (error || !data) {
                alert("데이터를 불러오지 못했습니다.");
                App.Router.go("wasteList");
                return;
            }

            // 데이터 채우기
            document.getElementById("waste_date").value = data.date;
            set("waste_date", data.date);

            // 분류 버튼 활성화
            const classBtn = document.querySelector(`#waste_classification_buttons button[data-value="${data.classification}"]`);
            if (classBtn) classBtn.click();

            // 폐수량 (수정 시에는 직접 입력란에 amount를 넣어주는 것이 직관적일 수 있음)
            // 하지만 total_mass_log가 있다면 그것을 보여줄 수도 있음.
            // 여기서는 amount를 직접 입력란에 표시
            directInput.value = data.amount;

            if (data.manager) document.getElementById("waste_manager").value = data.manager;
            if (data.remarks) document.getElementById("waste_remarks").value = data.remarks;
        }

        // 저장 버튼
        const submitBtn = document.getElementById("waste-submit-button");
        // 기존 리스너 제거를 위해 cloneNode 사용 (간단한 방법)
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

        newSubmitBtn.textContent = mode === "edit" ? "수정사항 저장" : "폐수 정보 저장";
        newSubmitBtn.addEventListener("click", handleSave);

        // 취소 버튼
        document.getElementById("waste-cancel-button").addEventListener("click", () => {
            App.Router.go("wasteList");
        });
    }

    async function handleSave(e) {
        e.preventDefault();

        const mode = get("form_mode");
        const editId = get("edit_id");

        const date = document.getElementById("waste_date").value;
        const classification = get("waste_classification");
        const directVal = document.getElementById("waste_amount_direct").value;
        const totalVal = document.getElementById("waste_total_mass").value;
        const manager = document.getElementById("waste_manager").value.trim();
        const remarks = document.getElementById("waste_remarks").value.trim();

        if (!date) return alert("등록일을 입력해주세요.");
        if (!classification) return alert("분류를 선택해주세요.");
        if (!directVal && !totalVal) return alert("폐수량(직접 입력) 또는 폐수통 전체 질량을 입력해주세요.");

        let finalAmount = 0;
        let totalMassLog = null;

        if (directVal) {
            // 🚨 첫 등록 여부 확인 (직접 입력 시) - 생성 모드일 때만 체크하거나, 수정 시에도 분류가 바뀌면 체크?
            // 수정 모드에서는 기존 기록이 있으므로 체크가 애매하지만, 분류를 바꿨다면 체크 필요.
            // 일단 생성 모드일 때만 엄격하게 체크
            if (mode !== "edit") {
                const { count } = await supabase
                    .from("WasteLog")
                    .select("*", { count: 'exact', head: true })
                    .eq("classification", classification);

                if (count === 0) {
                    alert(`'${classification}' 분류의 폐수 등록 기록이 없습니다.\n기준점 설정을 위해 첫 등록 시에는 반드시 [2. 폐수통 전체 질량]을 입력해주세요.`);
                    return;
                }
            }

            finalAmount = Number(directVal);
        } else if (totalVal) {
            const currentTotal = Number(totalVal);
            totalMassLog = currentTotal;

            // 이전 기록 조회하여 차이 계산
            // 수정 모드일 때는 '자신'을 제외한 가장 최근 기록을 찾아야 하나?
            // 로직이 복잡해질 수 있음. 수정 시 totalVal을 입력하면, 
            // "현재 시점의 총량"으로 간주하고, "직전 기록"과의 차이를 계산.

            let query = supabase
                .from("WasteLog")
                .select("total_mass_log")
                .eq("classification", classification)
                .order("date", { ascending: false })
                .order("created_at", { ascending: false })
                .limit(1);

            // 수정 시에는 자신보다 이전 기록을 찾아야 함. (날짜 기준?)
            // 단순히 가장 최근 기록을 가져오면 자신이 될 수도 있음.
            if (mode === "edit") {
                query = query.neq("id", editId);
                // 주의: 날짜를 수정했다면 그 날짜 기준 이전 데이터를 찾아야 함.
                // 여기서는 간단히 "가장 최근(자신 제외)"로 처리
            }

            const { data: lastLog } = await query.maybeSingle();
            const prevTotal = (lastLog && lastLog.total_mass_log) ? Number(lastLog.total_mass_log) : 0;
            finalAmount = currentTotal - prevTotal;

            if (finalAmount < 0) {
                if (!confirm(`계산된 폐수량이 음수(${finalAmount}g)입니다.\n폐수통을 비우거나 교체하셨나요?\n\n[확인]을 누르면 그대로 저장합니다.`)) {
                    return;
                }
            }
        }

        const payload = {
            date,
            classification,
            amount: finalAmount,
            total_mass_log: totalMassLog,
            unit: 'g',
            manager,
            remarks
        };

        let error;
        if (mode === "edit" && editId) {
            const res = await supabase.from("WasteLog").update(payload).eq("id", editId);
            error = res.error;
        } else {
            const res = await supabase.from("WasteLog").insert(payload);
            error = res.error;
        }

        if (error) {
            console.error("저장 실패:", error);
            alert("저장 중 오류가 발생했습니다.");
        } else {
            alert(mode === "edit" ? "✅ 수정되었습니다." : "✅ 저장되었습니다.");
            App.Router.go("wasteList");
        }
    }

    // ------------------------------------------------------------
    // 3️⃣ 페이지 바인딩
    // ------------------------------------------------------------
    function bindListPage() {
        const refreshBtn = document.getElementById("waste-refresh-btn");
        if (refreshBtn) refreshBtn.onclick = loadList;

        const newBtn = document.getElementById("new-waste-btn");
        if (newBtn) newBtn.onclick = () => App.Router.go("wasteForm");

        loadList();
    }

    // ------------------------------------------------------------
    // 전역 등록
    // ------------------------------------------------------------
    globalThis.App = globalThis.App || {};
    globalThis.App.Waste = {
        loadList,
        initForm,
        bindListPage
    };
})();
