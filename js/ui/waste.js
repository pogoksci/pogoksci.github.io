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

        const useRecentDisposal = document.getElementById("use-recent-disposal-date")?.checked;
        const startDate = document.getElementById("waste-start-date").value;
        const endDate = document.getElementById("waste-end-date").value;
        const sortLabel = document.getElementById("waste-sort-label");
        const currentSort = sortLabel ? sortLabel.dataset.value : "created_asc_group";

        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">hourglass_empty</span>
                <p>목록을 불러오는 중...</p>
            </div>`;

        // 🚛 폐수위탁처리(분류별) 보기 모드
        if (currentSort === "disposal_group") {
            await loadDisposalHistory(container, startDate, endDate);
            return;
        }

        // 1. 폐수 처리 이력 조회 (최근 처리일 파악용)
        let lastDisposalMap = {};
        if (useRecentDisposal) {
            const { data: disposalHistory } = await supabase
                .from("WasteDisposal")
                .select("classification, date")
                .order("date", { ascending: true });

            if (disposalHistory) {
                disposalHistory.forEach(d => {
                    if (!lastDisposalMap[d.classification] || d.date > lastDisposalMap[d.classification]) {
                        lastDisposalMap[d.classification] = d.date;
                    }
                });
            }
        }

        // 2. 목록 조회
        let query = supabase.from("WasteLog").select("*");

        // 날짜 필터 적용
        if (useRecentDisposal) {
            if (endDate) query = query.lte("date", endDate);
        } else {
            if (startDate) query = query.gte("date", startDate);
            if (endDate) query = query.lte("date", endDate);
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

        let filteredData = data || [];

        // 3. 메모리 필터링 (최근 위탁 처리일 모드일 경우)
        if (useRecentDisposal) {
            filteredData = filteredData.filter(item => {
                const lastDate = lastDisposalMap[item.classification] || "2000-01-01";
                return item.date >= lastDate;
            });
        }

        // 📊 [Modified] 기간 중 폐수 발생량 계산 및 표시 (단순 합계)
        const totalAmount = filteredData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const summaryEl = document.getElementById("waste-period-summary");
        if (summaryEl) {
            summaryEl.innerText = `기간 중 폐수 발생량: ${totalAmount.toLocaleString()} g`;
        }

        if (filteredData.length === 0) {
            if (filteredData.length === 0) {
                // Check if filtering was applied (date filtering is always active if default dates are set, but let's check input values)
                // The user asked for "No Search Results" if searching.
                // Waste list uses Date Range and Sort. There is no text search bar (Except... wait, there is a search button but no text input in `loadList`? Ah, `waste-start-date` and `end-date` act as filter).
                // However, `loadList` reads `waste-start-date` and `waste-end-date`.
                // `js/ui/waste.js` doesn't strictly have a keyword search implemented in `loadList` (it has date filtering).
                // Wait, `pages/waste-list.html` has a button `waste-search-btn` but no text input?
                // Ah, `waste-list.html` line 14 has a checkbox, line 20-24 date inputs.
                // It seems Waste module primarily filters by date.
                // So if date filter yields no results, is it "No Search Results"? Maybe.
                // But if simply no waste logs exist at all, it's "No Waste".
                // Since I can't easily distinguish "No data at all" vs "No data in range" without an extra query, I'll use a generic "No Data" or check if range is default?
                // Let's use `delete_forever` as default for now, or `search_off` if Filter is clearly user-set?
                // Actually, `waste-list.html` doesn't have a keyword search input.
                // So I will just use `delete_forever` with text "기간 내 폐수 내역이 없습니다." (No waste records in period).

                container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">delete_forever</span>
                <p>표시할 폐수 내역이 없습니다.</p>
            </div>`;
                return;
            }
            return;
        }

        renderList(filteredData, container, currentSort);
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
            container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">delete_forever</span>
                <p>폐수 처리 이력이 없습니다.</p>
            </div>`;
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
                <div class="section-header-wrapper">
                    <div class="inventory-section-header" style="background: #f0f0f0;">
                        <div>
                            <span class="section-title" style="color: #555;">${disposal.classification} (처리완료)</span>
                            <div style="font-size: 12px; color: #666; margin-top: 4px;">
                                📅 ${disposal.date} | 🏭 ${disposal.company_name || "업체미지정"} | 👤 ${disposal.manager || "-"}
                            </div>
                        </div>
                        <span class="section-count" style="background: #e0e0e0; color: #555;">총 ${totalStr} g</span>
                    </div>
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

                // 폐수위탁처리 버튼: 미처리 항목이 있을 때 표시
                // (날짜 필터와 관계없이, 현재 '미처리' 상태인 항목이 있다면 처리 가능하도록 함)
                const showDisposalBtn = hasActiveItems;

                html += `
                <div class="inventory-section-group">
                    <div class="section-header-wrapper">
                        <div class="inventory-section-header">
                            <span class="section-title">${classification}</span>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span class="section-count" style="background: #ffebee; color: #c62828;">누적: ${totalStr} g</span>
                                ${showDisposalBtn ? `
                                <button class="disposal-btn" data-class="${classification}" data-total="${group.total}"
                                    style="font-size: 11px; padding: 4px 8px; border: 1px solid #00a0b2; background: #e0f7fa; color: #006064; border-radius: 4px; cursor: pointer; font-weight: 600; display: flex; align-items: center;">
                                    <span class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">local_shipping</span>
                                    폐수위탁처리
                                </button>` : ""}
                            </div>
                        </div>
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
                <div class="section-header-wrapper">
                    <div class="inventory-section-header">
                        <span class="section-title">전체 목록</span>
                        <span class="section-count" style="background: #ffebee; color: #c62828;">총 누적: ${totalAmount.toLocaleString()} g</span>
                    </div>
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
        // 🚨 1단계 경고
        if (!confirm(`[주의] 폐수위탁처리를 진행하시겠습니까?\n\n이 작업을 수행하면 '${classification}' 분류의 현재 폐수 기록이 모두 '처리됨'으로 변경되어 별도 보관됩니다.\n\n이후 등록하는 폐수는 '새로운 폐수통'에 담기는 것으로 간주됩니다.`)) {
            return;
        }

        const company = prompt(`[${classification}] 폐수위탁처리 업체명을 입력해주세요.`);
        if (company === null) return;

        const dateStr = prompt("수거 날짜를 입력해주세요 (YYYY-MM-DD)", new Date().toISOString().split("T")[0]);
        if (!dateStr) return;

        if (!confirm(`'${classification}' 폐수 ${Number(totalAmount).toLocaleString()}g을\n'${company}' 업체로 발송 처리하시겠습니까?`)) {
            return;
        }

        try {
            const { data, error } = await supabase.functions.invoke('waste-manager', {
                body: {
                    action: 'process_disposal',
                    classification,
                    company_name: company,
                    date: dateStr,
                    total_amount: totalAmount,
                    manager: "관리자" // TODO: 실제 로그인 유저명 연동
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            alert("✅ 폐수 처리 완료되었습니다.");
            loadList();
        } catch (err) {
            console.error("처리 실패:", err);
            alert("처리 중 오류가 발생했습니다: " + err.message);
        }
    }

    async function deleteWaste(id) {
        try {
            const { data, error } = await supabase.functions.invoke('waste-manager', {
                body: {
                    action: 'delete_log',
                    id
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            loadList();
        } catch (err) {
            console.error("삭제 실패:", err);
            alert("삭제 실패: " + err.message);
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

        const btnSave = document.getElementById("waste-submit-button");
        const originText = btnSave.textContent;
        btnSave.textContent = "저장 중...";
        btnSave.disabled = true;

        try {
            const payload = {
                action: 'register_log',
                mode,
                id: mode === "edit" ? editId : null,
                date,
                classification,
                unit: 'g',
                manager,
                remarks,
                amount: directVal ? directVal : null,
                total_mass_log: totalVal ? totalVal : null
            };

            const { data, error } = await supabase.functions.invoke('waste-manager', {
                body: payload
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            alert(mode === "edit" ? "✅ 수정되었습니다." : "✅ 저장되었습니다.");
            App.Router.go("wasteList");

        } catch (err) {
            console.error("저장 실패:", err);
            // Handle specific EF warnings (like first total mass input) if we add them later
            alert("저장 실패: " + err.message);
        } finally {
            btnSave.textContent = originText;
            btnSave.disabled = false;
        }
    }

    // ------------------------------------------------------------
    // 3️⃣ 페이지 바인딩
    // ------------------------------------------------------------

    // 🖨️ 보고서 출력
    async function printReport() {
        const useRecentDisposal = document.getElementById("use-recent-disposal-date")?.checked;
        const startDate = document.getElementById("waste-start-date").value;
        const endDate = document.getElementById("waste-end-date").value;

        // 데이터 로드 (필터링 로직 재사용을 위해 독립적 쿼리 수행)
        const { data } = await supabase.from("WasteLog").select("*").order("date", { ascending: true });
        let filteredData = data || [];

        // 필터링 적용
        if (useRecentDisposal) {
            // 최근 처리일 로직이 필요하므로, 화면과 동일하게 계산
            const { data: disposalHistory } = await supabase.from("WasteDisposal").select("classification, date");
            const lastDisposalMap = {};
            if (disposalHistory) {
                disposalHistory.forEach(d => {
                    if (!lastDisposalMap[d.classification] || d.date > lastDisposalMap[d.classification]) {
                        lastDisposalMap[d.classification] = d.date;
                    }
                });
            }
            filteredData = filteredData.filter(item => {
                const lastDate = lastDisposalMap[item.classification] || "2000-01-01";
                return item.date >= lastDate;
                // endDate 필터도 적용? 화면 로직은 endDate가 있으면 적용함.
            });
            if (endDate) filteredData = filteredData.filter(item => item.date <= endDate);

        } else {
            if (startDate) filteredData = filteredData.filter(item => item.date >= startDate);
            if (endDate) filteredData = filteredData.filter(item => item.date <= endDate);
        }

        // 분류별 그룹화 (5대 분류 고정)
        // DB에 저장된 실제 분류값: 산, 알칼리, 유기물, 무기물, 기타
        const classifications = ['산', '알칼리', '유기물', '무기물', '기타'];
        // 보고서 출력용 표시 명칭 매핑
        const reportClassNames = {
            '산': '산(Acid)',
            '알칼리': '알칼리(Alkali)',
            '유기물': '유기계(유기물)',
            '무기물': '무기계(무기물)',
            '기타': '기타(Others)'
        };

        const grouped = {};
        classifications.forEach(c => grouped[c] = []);

        filteredData.forEach(item => {
            const key = item.classification || "기타";
            if (grouped[key]) grouped[key].push(item);
            else {
                // 혹시라도 "유기계" 등으로 저장된 레거시 데이터가 있다면 매핑 시도
                if (key.includes("유기")) grouped['유기물'].push(item);
                else if (key.includes("무기")) grouped['무기물'].push(item);
                else grouped["기타"].push(item);
            }
        });

        // HTML 생성
        let reportHtml = "";
        const periodText = useRecentDisposal
            ? `(최근 위탁처리 후 ~ ${endDate})`
            : `(${startDate} ~ ${endDate})`;

        classifications.forEach((cls) => {
            const items = grouped[cls];
            const displayTitle = reportClassNames[cls] || cls;

            // 데이터가 없어도 페이지는 생성 (User asked for 5 pages total)
            // 잔량(누적) 계산
            let runningTotal = 0;
            const rowsHtml = items.map((item, index) => {
                const amount = Number(item.amount) || 0;
                runningTotal += amount;
                const status = item.disposal_id ? "위탁처리됨" : "-";

                return `
                <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td style="text-align: center;">${item.date}</td>
                    <td style="text-align: center;">${item.classification}</td>
                    <td style="text-align: right;">${amount.toLocaleString()}</td>
                    <td style="text-align: right;">${runningTotal.toLocaleString()}</td>
                    <td style="text-align: center;">${status}</td>
                    <td>${item.remarks || ""}</td>
                </tr>`;
            }).join("");

            reportHtml += `
            <div class="page">
                <div class="report-header">
                    <h1>폐수 수거(처리) 내역서</h1>
                    <div class="meta-info">
                        <span>분류: <strong>${displayTitle}</strong></span>
                        <span>기간: ${periodText}</span>
                    </div>
                </div>
                
                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width: 50px;">연번</th>
                            <th style="width: 100px;">일자</th>
                            <th style="width: 120px;">분류</th>
                            <th style="width: 100px;">폐기량(g)</th>
                            <th style="width: 100px;">잔량(g)</th>
                            <th style="width: 100px;">상태</th>
                            <th>비고</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 20px;">해당 기간 내 내역이 없습니다.</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="text-align: center; font-weight: bold;">합 계</td>
                            <td style="text-align: right; font-weight: bold;">${runningTotal.toLocaleString()}</td>
                            <td colspan="3"></td>
                        </tr>
                    </tfoot>
                </table>
                <div class="footer">
                    <p>위와 같이 폐수를 수거(처리)하였음을 확인합니다.</p>
                    <p class="date">${new Date().toLocaleDateString()}</p>
                    <p class="signature">담당자: ________________ (인)</p>
                </div>
            </div>`;
        });

        // 새 창 열기
        const printWindow = window.open("", "_blank");
        printWindow.document.write(`
            <html>
            <head>
                <title>폐수 처리 내역서</title>
                <style>
                    @page { size: A4; margin: 20mm; }
                    body { font-family: "Malgun Gothic", sans-serif; margin: 0; padding: 0; background: #fff; }
                    .page { 
                        width: 210mm; min-height: 296mm; 
                        padding: 20mm; box-sizing: border-box; 
                        margin: 0 auto; 
                        page-break-after: always; /* 강제 페이지 넘김 */
                        position: relative;
                    }
                    .report-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .report-header h1 { margin: 0 0 10px 0; font-size: 24px; }
                    .meta-info { display: flex; justify-content: space-between; font-size: 14px; }
                    
                    .report-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
                    .report-table th, .report-table td { border: 1px solid #444; padding: 8px; }
                    .report-table th { background: #f0f0f0; text-align: center; }
                    
                    .footer { margin-top: 50px; text-align: center; }
                    .footer p { margin: 10px 0; font-size: 14px; }
                    .signature { margin-top: 30px; }
                    
                    @media print {
                        body { -webkit-print-color-adjust: exact; }
                        .page { margin: 0; border: none; }
                    }
                </style>
            </head>
            <body>
                ${reportHtml}
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    function bindListPage() {
        const searchBtn = document.getElementById("waste-search-btn");
        if (searchBtn) searchBtn.onclick = loadList;

        const printBtn = document.getElementById("waste-print-btn");
        if (printBtn) {
            if (App.Auth && typeof App.Auth.canWrite === 'function' && !App.Auth.canWrite()) {
                printBtn.style.display = "none";
            } else {
                printBtn.style.display = "";
                printBtn.onclick = printReport;
            }
        }

        const newBtn = document.getElementById("new-waste-btn");
        if (newBtn) {
            // ✅ 권한 체크
            if (App.Auth && typeof App.Auth.canWrite === 'function' && !App.Auth.canWrite()) {
                newBtn.style.display = "none";
            } else {
                newBtn.style.display = "";
                newBtn.onclick = () => App.Router.go("wasteForm");
            }
        }

        const startInput = document.getElementById("waste-start-date");
        const endInput = document.getElementById("waste-end-date");
        const recentCheckbox = document.getElementById("use-recent-disposal-date");

        // 날짜 유틸리티
        const toDateString = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        const today = new Date();

        // 🏫 학년도 기준 시작일 계산 (3월 1일)
        // 현재 월이 3월(2) 이상이면 올해 3월 1일, 아니면 작년 3월 1일
        let academicYearStart;
        if (today.getMonth() >= 2) { // 0-indexed, 2 is March
            academicYearStart = new Date(today.getFullYear(), 2, 1);
        } else {
            academicYearStart = new Date(today.getFullYear() - 1, 2, 1);
        }

        // 초기값 설정
        if (startInput && !startInput.value) startInput.value = toDateString(academicYearStart);
        if (endInput && !endInput.value) endInput.value = toDateString(today);

        // 체크박스 이벤트
        if (recentCheckbox) {
            recentCheckbox.addEventListener("change", (e) => {
                if (e.target.checked) {
                    startInput.disabled = true;
                    startInput.style.color = "#aaa";
                    startInput.style.backgroundColor = "#eee";
                    startInput.style.pointerEvents = "none"; // 클릭 방지
                } else {
                    startInput.disabled = false;
                    startInput.style.color = "#333";
                    startInput.style.backgroundColor = "transparent";
                    startInput.style.pointerEvents = "auto";
                }
            });
        }

        // 정렬 드롭다운 초기화
        if (App.SortDropdown && App.SortDropdown.init) {
            App.SortDropdown.init({
                onChange: (val) => {
                    console.log(`🔽 폐수 정렬 변경: ${val}`);
                    loadList();
                },
                defaultLabel: "등록순(분류별)",
                defaultValue: "created_asc_group",
                toggleId: "waste-sort-toggle",
                menuId: "waste-sort-menu",
                labelId: "waste-sort-label"
            });
        } else {
            console.error("❌ App.SortDropdown 모듈이 로드되지 않았습니다.");
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
