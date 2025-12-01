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

        const startDate = document.getElementById("waste-start-date").value;
        const endDate = document.getElementById("waste-end-date").value;
        const sortLabel = document.getElementById("sort-label");
        const currentSort = sortLabel ? sortLabel.dataset.value : "created_asc_group";

        container.innerHTML = `
            <p style="padding:0 15px; color:#888;">
                <span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 5px;">sync</span>
                폐수 목록을 불러오는 중...
            </p>`;

        // 🚛 폐수위탁처리(분류별) 보기 모드
        if (currentSort === "disposal_group") {
            await loadDisposalHistory(container, startDate, endDate);
            return;
        }

        // 일반 목록 조회
        let query = supabase
            .from("WasteLog")
            .select("*");

        // 날짜 필터 적용
        if (startDate) query = query.gte("date", startDate);
        if (endDate) query = query.lte("date", endDate);

        // 🚨 스마트 필터링 로직
        // 1. 최근 폐수 처리일 조회
        const { data: lastDisposal } = await supabase
            .from("WasteDisposal")
            .select("date")
            .order("date", { ascending: false })
            .limit(1)
            .maybeSingle();

        const lastDisposalDate = lastDisposal ? lastDisposal.date : null;

        // 2. 조건부 필터 적용
        // - 시작 날짜가 지정되지 않았거나 (전체 기간)
        // - 시작 날짜가 최근 처리일 이후(또는 당일)인 경우
        // -> "현재 보관 중인(미처리)" 폐수만 보여줌 (처리된 내역 제외)
        // - 반대로, 시작 날짜가 최근 처리일보다 과거라면 -> "히스토리 조회"로 간주하여 처리된 내역도 포함

        let showActiveOnly = false;

        if (!startDate) {
            showActiveOnly = true;
        } else if (lastDisposalDate && startDate >= lastDisposalDate) {
            showActiveOnly = true;
        }

        if (showActiveOnly) {
            query = query.is("disposal_id", null);
        }

        // 정렬 적용
        const isDesc = currentSort.includes("desc");
        query = query.order("date", { ascending: !isDesc });
        query = query.order("created_at", { ascending: !isDesc });

        const { data, error } = await query;

        if (error) {
            console.error("❌ 폐수 목록 조회 실패:", error);
            container.innerHTML = `<p style="padding:0 15px; color:#d33;">목록을 불러오지 못했습니다.</p>`;
            return;
        }

        if (!data || data.length === 0) {
            container.innerHTML = `<p style="padding:0 15px; color:#888;">표시할 폐수 내역이 없습니다.</p>`;
            return;
        }

        renderList(data, container, currentSort);
    }

    // 폐수업체 처리 이력 조회
    async function loadDisposalHistory(container, startDate, endDate) {
        let query = supabase
            .from("WasteDisposal")
            .select("*, WasteLog(*)") // Join WasteLog to show details if needed
            .order("date", { ascending: false });

        if (startDate) query = query.gte("date", startDate);
        if (endDate) query = query.lte("date", endDate);

        const { data, error } = await query;

        if (error) {
            console.error("❌ 처리 이력 조회 실패:", error);
            container.innerHTML = `<p style="padding:0 15px; color:#d33;">처리 이력을 불러오지 못했습니다.</p>`;
            return;
        }

        if (!data || data.length === 0) {
            container.innerHTML = `<p style="padding:0 15px; color:#888;">폐수 처리 이력이 없습니다.</p>`;
            return;
        }

        let html = "";
        data.forEach(disposal => {
            const totalStr = Number(disposal.total_amount).toLocaleString();

            // 상세 내역 (WasteLog)
            const logs = disposal.WasteLog || [];
            const itemsHtml = renderItems(logs, true); // true = readonly (no edit/delete)

            html += `
            <div class="inventory-section-group" style="border-left: 4px solid #aaa;">
                <div class="inventory-section-header" style="background: #f0f0f0;">
                    <div>
                        <span class="section-title" style="color: #555;">${disposal.classification} (처리완료)</span>
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">
                            📅 ${disposal.date} | 🏭 ${disposal.company_name || "업체미지정"} | 👤 ${disposal.manager || "-"}
                        </div>
                    </div>
                    <span class="section-count" style="background: #e0e0e0; color: #555;">총 ${totalStr} g</span>
                </div>
                ${itemsHtml}
            </div>`;
        });

        container.innerHTML = html;
    }

    function renderList(rows, container, currentSort) {
        const isGrouped = currentSort.includes("group");
        let html = "";

        if (isGrouped) {
            // 분류별 그룹화
            const grouped = rows.reduce((acc, row) => {
                const key = row.classification || "기타";
                if (!acc[key]) acc[key] = { items: [], total: 0 };
                acc[key].items.push(row);
                acc[key].total += Number(row.amount) || 0;
                return acc;
            }, {});

            Object.entries(grouped).forEach(([classification, group]) => {
                // 이 그룹에 "미처리"된 항목이 하나라도 있는지 확인
                const hasActiveItems = group.items.some(item => !item.disposal_id);

                const totalStr = group.total.toLocaleString();
                const itemsHtml = renderItems(group.items);

                // 폐수위탁처리 버튼: 기본 뷰이고, 미처리 항목이 있을 때만 표시
                const showDisposalBtn = !document.getElementById("waste-start-date").value && hasActiveItems;

                html += `
                <div class="inventory-section-group">
                    <div class="inventory-section-header">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="section-title">${classification}</span>
                            ${showDisposalBtn ? `
                            <button class="disposal-btn" data-class="${classification}" data-total="${group.total}"
                                style="font-size: 11px; padding: 4px 8px; border: 1px solid #00a0b2; background: #e0f7fa; color: #006064; border-radius: 4px; cursor: pointer; font-weight: 600;">
                                🚛 폐수위탁처리
                            </button>` : ""}
                        </div>
                        <span class="section-count" style="background: #ffebee; color: #c62828;">누적: ${totalStr} g</span>
                    </div>
                    ${itemsHtml}
                </div>`;
            });
        } else {
            // 전체 목록 (단일 리스트)
            const totalAmount = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
            const itemsHtml = renderItems(rows);

            html += `
            <div class="inventory-section-group">
                <div class="inventory-section-header">
                    <span class="section-title">전체 목록</span>
                    <span class="section-count" style="background: #ffebee; color: #c62828;">총 누적: ${totalAmount.toLocaleString()} g</span>
                </div>
                ${itemsHtml}
            </div>`;
        }

        container.innerHTML = html;
        bindListEvents(container);
    }

    function renderItems(items, readOnly = false) {
        return items.map(item => {
            const dateStr = item.date;
            const amountStr = Number(item.amount).toLocaleString();
            const isDisposed = !!item.disposal_id;

            // 처리된 항목 스타일
            const cardStyle = isDisposed
                ? "background-color: #f5f5f5; opacity: 0.7; border: 1px dashed #ccc;"
                : "";

            const badge = isDisposed
                ? `<span style="font-size: 11px; color: #fff; background: #999; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">처리됨</span>`
                : "";

            return `
            <div class="inventory-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; ${cardStyle}">
                <div style="flex: 1; display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: 600; color: #333; font-size: 14px;">${dateStr}</span>
                    <span style="font-size: 13px; color: #555; background: #eee; padding: 2px 6px; border-radius: 4px;">${item.classification}</span>
                    ${badge}
                    ${item.remarks ? `<span style="font-size: 12px; color: #888;">(${item.remarks})</span>` : ""}
                </div>
                
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-weight: 700; color: ${isDisposed ? '#888' : '#d33'}; font-size: 14px;">${amountStr} g</span>
                    
                    ${!readOnly && !isDisposed ? `
                    <button class="icon-btn edit-waste-btn" data-id="${item.id}" style="border:none; background:none; cursor:pointer; padding:4px;">
                        <span class="material-symbols-outlined" style="font-size: 20px; color: #00a0b2;">edit</span>
                    </button>

                    <button class="icon-btn delete-waste-btn" data-id="${item.id}" style="border:none; background:none; cursor:pointer; padding:4px;">
                        <span class="material-symbols-outlined" style="font-size: 20px; color: #999;">delete</span>
                    </button>
                    ` : ""}
                </div>
            </div>`;
        }).join("");
    }

    function bindListEvents(container) {
        // 수정/삭제 버튼 (기존 로직)
        container.querySelectorAll(".edit-waste-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                App.Router.go("wasteForm", { mode: "edit", id: id });
            });
        });

        container.querySelectorAll(".delete-waste-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm("이 폐수 기록을 삭제하시겠습니까?")) {
                    const id = btn.dataset.id;
                    await deleteWaste(id);
                }
            });
        });

        // 🚛 폐수위탁처리 버튼
        container.querySelectorAll(".disposal-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const classification = btn.dataset.class;
                const totalAmount = btn.dataset.total;
                handleDisposal(classification, totalAmount);
            });
        });
    }

    // 폐수 처리 실행
    async function handleDisposal(classification, totalAmount) {
        // 🚨 1단계 경고: 작업의 의미 설명
        if (!confirm(`[주의] 폐수위탁처리를 진행하시겠습니까?\n\n이 작업을 수행하면 '${classification}' 분류의 현재 폐수 기록이 모두 '처리됨'으로 변경되어 별도 보관됩니다.\n\n이후 등록하는 폐수는 '새로운 폐수통'에 담기는 것으로 간주됩니다.`)) {
            return;
        }

        const company = prompt(`[${classification}] 폐수위탁처리 업체명을 입력해주세요.`);
        if (company === null) return; // 취소

        const dateStr = prompt("수거 날짜를 입력해주세요 (YYYY-MM-DD)", new Date().toISOString().split("T")[0]);
        if (!dateStr) return;

        if (!confirm(`'${classification}' 폐수 ${Number(totalAmount).toLocaleString()}g을\n'${company}' 업체로 발송 처리하시겠습니까?\n\n처리 후에는 현재 목록에서 사라지며, [폐수위탁처리] 메뉴에서 확인할 수 있습니다.`)) {
            return;
        }

        // 1. WasteDisposal 생성
        const { data: disposalData, error: disposalError } = await supabase
            .from("WasteDisposal")
            .insert({
                date: dateStr,
                classification: classification,
                total_amount: totalAmount,
                company_name: company,
                manager: "관리자" // TODO: 실제 로그인 유저명
            })
            .select()
            .single();

        if (disposalError) {
            console.error(disposalError);
            alert("처리 기록 생성 실패");
            return;
        }

        // 2. WasteLog 업데이트 (disposal_id 연결)
        // 현재 disposal_id가 없는 해당 분류의 모든 기록을 업데이트
        const { error: updateError } = await supabase
            .from("WasteLog")
            .update({ disposal_id: disposalData.id })
            .eq("classification", classification)
            .is("disposal_id", null);

        if (updateError) {
            console.error(updateError);
            alert("폐수 기록 업데이트 실패");
            return;
        }

        alert("✅ 폐수 처리 완료되었습니다.");
        loadList();
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
            // 🚨 첫 등록 여부 확인 (직접 입력 시)
            if (mode !== "edit") {
                const { count } = await supabase
                    .from("WasteLog")
                    .select("*", { count: 'exact', head: true })
                    .eq("classification", classification)
                    .is("disposal_id", null); // ✅ 현재 보관 중인(미처리) 기록만 확인

                if (count === 0) {
                    alert(`'${classification}' 분류의 폐수 등록 기록이 없습니다.\n(또는 이전 폐수가 모두 처리되었습니다.)\n\n기준점 설정을 위해 첫 등록 시에는 반드시 [2. 폐수통 전체 질량]을 입력해주세요.`);
                    return;
                }
            }

            finalAmount = Number(directVal);
        } else if (totalVal) {
            const currentTotal = Number(totalVal);
            totalMassLog = currentTotal;

            // 이전 기록 조회하여 차이 계산
            let query = supabase
                .from("WasteLog")
                .select("total_mass_log")
                .eq("classification", classification)
                .order("date", { ascending: false })
                .order("created_at", { ascending: false })
                .limit(1);

            if (mode === "edit") {
                query = query.neq("id", editId);
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
    async function bindListPage() {
        const searchBtn = document.getElementById("waste-search-btn");
        if (searchBtn) searchBtn.onclick = loadList;

        const newBtn = document.getElementById("new-waste-btn");
        if (newBtn) newBtn.onclick = () => App.Router.go("wasteForm");

        // 날짜 초기화
        const today = new Date();

        const toDateString = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        const startInput = document.getElementById("waste-start-date");
        const endInput = document.getElementById("waste-end-date");

        // 최근 폐수 처리일 가져오기
        const { data: lastDisposal } = await supabase
            .from("WasteDisposal")
            .select("date")
            .order("date", { ascending: false })
            .limit(1)
            .maybeSingle();

        // 디폴트 시작일: 최근 처리일이 있으면 그 날짜, 없으면 이번 달 1일
        let defaultStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
        if (lastDisposal && lastDisposal.date) {
            defaultStartDate = new Date(lastDisposal.date);
        }

        if (startInput && !startInput.value) startInput.value = toDateString(defaultStartDate);
        if (endInput && !endInput.value) endInput.value = toDateString(today);

        // 정렬 드롭다운 초기화
        if (App.SortDropdown) {
            App.SortDropdown.init({
                onChange: (val) => {
                    console.log(`🔽 폐수 정렬 변경: ${val}`);
                    loadList();
                },
                defaultLabel: "등록순(분류별)",
                defaultValue: "created_asc_group"
            });
        }

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
