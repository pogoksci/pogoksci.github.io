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
                    <div>
                        <div style="font-weight: 600; color: #333; font-size: 14px;">${dateStr}</div>
                        <div style="font-size: 12px; color: #888; margin-top: 2px;">
                            ${item.manager ? `담당: ${item.manager}` : ""}
                            ${item.remarks ? ` | ${item.remarks}` : ""}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: #d33; font-size: 14px;">${amountStr} g</div>
                        <div style="margin-top: 4px;">
                            <button class="icon-btn delete-waste-btn" data-id="${item.id}" style="border:none; background:none; cursor:pointer; padding:4px;">
                                <span class="material-symbols-outlined" style="font-size: 18px; color: #999;">delete</span>
                            </button>
                        </div>
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
    async function initForm() {
        reset();

        // 기본값 설정
        const today = new Date().toISOString().split("T")[0];
        document.getElementById("waste_date").value = today;
        set("waste_date", today);

        // 버튼 그룹 설정
        setupButtonGroup("waste_classification_buttons", (btn) => {
            set("waste_classification", btn.dataset.value);
        });

        // 입력 필드 제어 (하나 입력하면 다른 하나 비우기 등)
        const directInput = document.getElementById("waste_amount_direct");
        const totalInput = document.getElementById("waste_total_mass");

        directInput.addEventListener("input", () => {
            if (directInput.value) totalInput.value = "";
        });

        totalInput.addEventListener("input", () => {
            if (totalInput.value) directInput.value = "";
        });

        // 저장 버튼
        document.getElementById("waste-submit-button").addEventListener("click", handleSave);

        // 취소 버튼
        document.getElementById("waste-cancel-button").addEventListener("click", () => {
            App.Router.go("wasteList");
        });
    }

    async function handleSave(e) {
        e.preventDefault();

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
            finalAmount = Number(directVal);
            // 직접 입력 시 total_mass_log는 계산하지 않음 (또는 이전 값 + amount로 추정 가능하지만, 정확하지 않을 수 있음)
            // 요구사항: "폐수량을 직접 입력한 경우는 그 값을 이용"
        } else if (totalVal) {
            const currentTotal = Number(totalVal);
            totalMassLog = currentTotal;

            // 이전 기록 조회하여 차이 계산
            const { data: lastLog, error } = await supabase
                .from("WasteLog")
                .select("total_mass_log")
                .eq("classification", classification)
                .order("date", { ascending: false })
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

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

        const { error } = await supabase.from("WasteLog").insert(payload);
        if (error) {
            console.error("저장 실패:", error);
            alert("저장 중 오류가 발생했습니다.");
        } else {
            alert("✅ 폐수 정보가 저장되었습니다.");
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
