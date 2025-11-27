// ================================================================
// /js/ui/usage-register.js
// 사용량 등록 및 재고 차감 로직
// ================================================================
(function () {
    console.log("🧪 UsageRegister 모듈 로드됨");

    let allInventory = [];
    let selectedItem = null;

    // ------------------------------------------------------------
    // 1️⃣ 초기화
    // ------------------------------------------------------------
    async function init() {
        console.log("🚀 UsageRegister.init()");

        // 날짜 기본값: 오늘
        const dateInput = document.getElementById("usage-date");
        if (dateInput) {
            dateInput.valueAsDate = new Date();
        }

        // 이벤트 리스너 등록
        bindEvents();

        // 목록 로드
        await loadInventoryList();
    }

    function bindEvents() {
        // 검색
        const searchInput = document.getElementById("usage-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                filterAndRenderList(e.target.value);
            });
        }

        // 폼 제출
        const form = document.getElementById("usage-form");
        if (form) {
            form.addEventListener("submit", handleUsageSubmit);
        }
    }

    // ------------------------------------------------------------
    // 2️⃣ 목록 로드 (전량소진 제외)
    // ------------------------------------------------------------
    async function loadInventoryList() {
        const supabase = App.supabase;
        if (!supabase) return;

        const listContainer = document.getElementById("usage-inventory-list");
        if (listContainer) listContainer.innerHTML = '<div class="loading-spinner">목록을 불러오는 중...</div>';

        // status가 '전량소진'이 아닌 것만 조회
        const { data, error } = await supabase
            .from("Inventory")
            .select(`
        id, current_amount, unit, status,
        Substance ( substance_name, cas_rn, chem_name_kor, molecular_formula ),
        Cabinet ( cabinet_name, Area ( area_name ) )
      `)
            .neq("status", "전량소진") // 필터링
            .order("id", { ascending: true });

        if (error) {
            console.error("❌ 목록 로드 실패:", error);
            if (listContainer) listContainer.innerHTML = '<div class="error-msg">목록을 불러오지 못했습니다.</div>';
            return;
        }

        allInventory = data || [];
        filterAndRenderList("");
    }

    function filterAndRenderList(query) {
        const listContainer = document.getElementById("usage-inventory-list");
        if (!listContainer) return;

        const lowerQuery = query.toLowerCase().trim();

        const filtered = allInventory.filter(item => {
            const nameKor = item.Substance?.chem_name_kor || "";
            const nameEng = item.Substance?.substance_name || "";
            const cas = item.Substance?.cas_rn || "";

            return nameKor.includes(lowerQuery) ||
                nameEng.toLowerCase().includes(lowerQuery) ||
                cas.includes(lowerQuery);
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = '<div class="empty-msg" style="padding:20px; text-align:center; color:#888;">검색 결과가 없습니다.</div>';
            return;
        }

        listContainer.innerHTML = filtered.map(item => `
      <div class="usage-item" onclick="App.UsageRegister.selectItem(${item.id})">
        <span class="item-name">${item.Substance?.chem_name_kor || item.Substance?.substance_name || "이름 없음"}</span>
        <div class="item-meta">
          <span>${item.current_amount} ${item.unit}</span>
          <span>${item.Cabinet?.Area?.area_name || ""} ${item.Cabinet?.cabinet_name || ""}</span>
        </div>
      </div>
    `).join("");
    }

    // ------------------------------------------------------------
    // 3️⃣ 아이템 선택
    // ------------------------------------------------------------
    async function selectItem(id) {
        selectedItem = allInventory.find(i => i.id === id);
        if (!selectedItem) return;

        // UI 업데이트
        document.getElementById("usage-empty-state").style.display = "none";
        document.getElementById("usage-detail-container").style.display = "block";

        // 정보 표시
        document.getElementById("usage-chem-name").textContent = selectedItem.Substance?.chem_name_kor || selectedItem.Substance?.substance_name;
        document.getElementById("usage-chem-formula").textContent = selectedItem.Substance?.molecular_formula || "-";
        document.getElementById("usage-chem-cas").textContent = selectedItem.Substance?.cas_rn || "-";
        document.getElementById("usage-current-amount").textContent = selectedItem.current_amount;
        document.getElementById("usage-unit").textContent = selectedItem.unit;
        document.getElementById("usage-form-unit").textContent = selectedItem.unit;
        document.getElementById("usage-location").textContent = `${selectedItem.Cabinet?.Area?.area_name || ""} ${selectedItem.Cabinet?.cabinet_name || ""}`;

        // 사용 기록 로드
        await loadUsageHistory(id);
    }

    // ------------------------------------------------------------
    // 4️⃣ 사용 기록 로드
    // ------------------------------------------------------------
    async function loadUsageHistory(inventoryId) {
        const supabase = App.supabase;
        const tbody = document.getElementById("usage-history-body");
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">로딩 중...</td></tr>';

        const { data, error } = await supabase
            .from("UsageLog")
            .select("*")
            .eq("inventory_id", inventoryId)
            .order("usage_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) {
            console.error("❌ 사용 기록 로드 실패:", error);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">기록을 불러오지 못했습니다.</td></tr>';
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">사용 기록이 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(log => `
      <tr>
        <td>${log.usage_date}</td>
        <td>${log.subject}</td>
        <td>${log.period}</td>
        <td>${log.amount} ${log.unit || ""}</td>
      </tr>
    `).join("");
    }

    // ------------------------------------------------------------
    // 5️⃣ 사용량 등록 (트랜잭션 처리 유사 로직)
    // ------------------------------------------------------------
    async function handleUsageSubmit(e) {
        e.preventDefault();
        if (!selectedItem) return;

        const supabase = App.supabase;
        const date = document.getElementById("usage-date").value;
        const subject = document.getElementById("usage-subject").value;
        const period = document.getElementById("usage-period").value;
        const amount = parseFloat(document.getElementById("usage-amount").value);

        if (isNaN(amount) || amount <= 0) {
            alert("올바른 사용량을 입력하세요.");
            return;
        }

        if (!confirm(`${amount}${selectedItem.unit} 사용을 등록하시겠습니까?`)) return;

        try {
            // 1. UsageLog 삽입
            const { error: logError } = await supabase
                .from("UsageLog")
                .insert({
                    inventory_id: selectedItem.id,
                    usage_date: date,
                    subject: subject,
                    period: period,
                    amount: amount,
                    unit: selectedItem.unit
                });

            if (logError) throw logError;

            // 2. Inventory 업데이트 (차감)
            const newAmount = selectedItem.current_amount - amount;
            const newStatus = newAmount <= 0 ? "전량소진" : selectedItem.status;
            const finalAmount = newAmount < 0 ? 0 : newAmount; // 음수 방지

            const { error: invError } = await supabase
                .from("Inventory")
                .update({
                    current_amount: finalAmount,
                    status: newStatus
                })
                .eq("id", selectedItem.id);

            if (invError) throw invError;

            alert("✅ 사용량이 등록되었습니다.");

            // 폼 초기화
            document.getElementById("usage-amount").value = "";

            // 데이터 갱신
            // 1) 로컬 데이터 업데이트 (즉시 반영)
            selectedItem.current_amount = finalAmount;
            selectedItem.status = newStatus;

            // 2) UI 갱신
            if (newStatus === "전량소진") {
                alert("⚠️ 해당 약품이 전량 소진되었습니다.");
                // 목록에서 제거 또는 갱신
                await loadInventoryList(); // 목록 다시 로드 (소진된 것 사라짐)
                document.getElementById("usage-detail-container").style.display = "none";
                document.getElementById("usage-empty-state").style.display = "flex";
            } else {
                // 잔량 업데이트
                document.getElementById("usage-current-amount").textContent = finalAmount;
                // 기록 목록 갱신
                await loadUsageHistory(selectedItem.id);
                // 목록의 잔량 표시도 갱신 필요 (전체 리로드 대신 DOM만 찾아서 바꿀 수도 있지만, 안전하게 리로드)
                // loadInventoryList(); // 전체 리로드는 UX상 끊김이 있을 수 있으니 생략하거나 최적화
                // 여기서는 간단히 목록 다시 그리기
                filterAndRenderList(document.getElementById("usage-search-input").value);
            }

        } catch (err) {
            console.error("❌ 등록 실패:", err);
            alert(`등록 중 오류가 발생했습니다:\n${err.message}`);
        }
    }

    // ------------------------------------------------------------
    // 전역 등록
    // ------------------------------------------------------------
    globalThis.App = globalThis.App || {};
    globalThis.App.UsageRegister = {
        init,
        selectItem
    };
})();
