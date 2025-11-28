// ================================================================
// /js/ui/usage-register.js
// 사용량 등록 (목록 -> 상세 단일 흐름)
// ================================================================
(function () {
    console.log("🧪 UsageRegister 모듈 로드됨");

    let allInventory = [];
    let selectedItem = null;
    let currentSort = "category_name_kor"; // 기본 정렬

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

        // 정렬 드롭다운 초기화
        if (App.SortDropdown && App.SortDropdown.init) {
            App.SortDropdown.init({
                onChange: (val) => {
                    currentSort = val;
                    filterAndRenderList(document.getElementById("usage-search-input")?.value || "");
                },
                onRefresh: () => {
                    loadInventoryList();
                },
                defaultLabel: "한글명(분류)",
                defaultValue: "category_name_kor"
            });
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

        // 뒤로가기
        const backBtn = document.getElementById("btn-back-to-list");
        if (backBtn) {
            backBtn.addEventListener("click", goBackToList);
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

        // 필요한 필드 모두 조회 (classification 추가)
        const { data, error } = await supabase
            .from("Inventory")
            .select(`
        id, current_amount, unit, status, classification,
        concentration_value, concentration_unit,
        door_vertical, door_horizontal, internal_shelf_level, storage_column,
        photo_url_320, photo_url_160,
        Substance ( substance_name, cas_rn, chem_name_kor, chem_name_kor_mod, molecular_formula ),
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

    // 정렬 함수 (inventory.js와 동일)
    function sortData(rows, key) {
        const collateKo = (a, b) => String(a || "").localeCompare(String(b || ""), "ko");
        const collateEn = (a, b) => String(a || "").localeCompare(String(b || ""), "en", { sensitivity: "base" });

        switch (key) {
            case "category_name_kor": // 한글명(분류)
                return rows.sort((a, b) => collateKo(a.classification, b.classification) || collateKo(a.Substance?.chem_name_kor, b.Substance?.chem_name_kor));
            case "category_name_eng": // 영문명(분류)
                return rows.sort((a, b) => collateKo(a.classification, b.classification) || collateEn(a.Substance?.substance_name, b.Substance?.substance_name));
            case "name_kor": // 한글명(전체)
                return rows.sort((a, b) => collateKo(a.Substance?.chem_name_kor, b.Substance?.chem_name_kor));
            case "name_eng": // 영문명(전체)
                return rows.sort((a, b) => collateEn(a.Substance?.substance_name, b.Substance?.substance_name));
            case "formula": // 화학식
                return rows.sort((a, b) => collateEn(a.Substance?.molecular_formula, b.Substance?.molecular_formula));
            case "storage_location": // 위치
                return rows.sort((a, b) => {
                    const locA = (a.Cabinet?.Area?.area_name || "") + (a.Cabinet?.cabinet_name || "");
                    const locB = (b.Cabinet?.Area?.area_name || "") + (b.Cabinet?.cabinet_name || "");
                    return collateKo(locA, locB);
                });
            case "created_at_desc": // 등록순서
                return rows.sort((a, b) => b.id - a.id);
            default:
                return rows;
        }
    }

    // 그룹화 함수
    function groupData(rows, key) {
        if (key === "category_name_kor" || key === "category_name_eng") {
            const groups = {};
            rows.forEach(item => {
                const cls = item.classification || "미분류";
                if (!groups[cls]) groups[cls] = [];
                groups[cls].push(item);
            });
            // 키 정렬
            return Object.keys(groups).sort().map(cls => [cls, groups[cls]]);
        }
        return [["", rows]]; // 그룹 없음
    }

    function filterAndRenderList(query) {
        const listContainer = document.getElementById("usage-inventory-list");
        if (!listContainer) return;

        const lowerQuery = query.toLowerCase().trim();

        let filtered = allInventory.filter(item => {
            const nameKor = item.Substance?.chem_name_kor || "";
            const nameKorMod = item.Substance?.chem_name_kor_mod || "";
            const nameEng = item.Substance?.substance_name || "";
            const cas = item.Substance?.cas_rn || "";

            return nameKor.includes(lowerQuery) ||
                nameKorMod.includes(lowerQuery) ||
                nameEng.toLowerCase().includes(lowerQuery) ||
                cas.includes(lowerQuery);
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = '<div class="empty-msg">검색 결과가 없습니다.</div>';
            return;
        }

        // 정렬
        filtered = sortData(filtered, currentSort);

        // 그룹화 및 렌더링
        const grouped = groupData(filtered, currentSort);

        listContainer.innerHTML = grouped.map(([groupTitle, items]) => {
            let header = "";
            if (groupTitle) {
                header = `
            <div class="inventory-section-header">
              <span class="section-title">${groupTitle}</span>
              <span class="section-count">${items.length}</span>
            </div>`;
            }
            return `
            <div class="inventory-section-group">
                ${header}
                ${items.map(item => renderItemCard(item)).join("")}
            </div>
        `;
        }).join("");
    }

    // 아이템 카드 HTML 생성
    // - 목록(isDetail=false): 사진 없음, 2줄 요약 (기존 방식)
    // - 상세(isDetail=true): 사진 포함, 4줄 상세 (inventory.js 방식)
    function renderItemCard(item, isDetail = false) {
        const name = item.Substance?.chem_name_kor_mod || item.Substance?.chem_name_kor || "이름 없음";

        // 농도 텍스트
        let concStr = "-";
        if (item.concentration_value) {
            concStr = `${item.concentration_value}${item.concentration_unit || ""}`;
        }

        // 위치 텍스트
        const area = item.Cabinet?.Area?.area_name || "";
        const cabinetName = item.Cabinet?.cabinet_name || "";
        const doorVertical = item.door_vertical || "";
        const doorHorizontal = item.door_horizontal || "";
        const shelfLevel = item.internal_shelf_level;
        const column = item.storage_column;

        let locationText = "";
        if (area) locationText += area + " ";
        if (cabinetName) locationText += `『${cabinetName}』 `;

        let doorPart = "";
        const doorHVal = String(doorHorizontal || "").trim();
        let doorHLabel = "";
        if (doorHVal === "1") doorHLabel = "왼쪽";
        else if (doorHVal === "2") doorHLabel = "오른쪽";
        else doorHLabel = doorHVal;

        if (doorVertical && doorHLabel) {
            doorPart = `${doorVertical}층 ${doorHLabel}문`;
        } else if (doorVertical) {
            doorPart = `${doorVertical}층문`;
        } else if (doorHLabel) {
            doorPart = `${doorHLabel}문`;
        }

        let shelfPart = "";
        if (shelfLevel && column) {
            shelfPart = `${shelfLevel}단 ${column}열`;
        } else {
            if (shelfLevel) shelfPart += `${shelfLevel}단`;
            if (column) shelfPart += (shelfPart ? " " : "") + `${column}열`;
        }

        const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
        if (detailParts) locationText += detailParts;
        locationText = locationText.trim() || "위치 정보 없음";

        // 클릭 이벤트
        const onClickAttr = isDetail ? "" : `onclick="App.UsageRegister.selectItem(${item.id})"`;

        // ✅ 상세 화면 (isDetail=true): 4줄 레이아웃 + 사진
        if (isDetail) {
            const imageSrc = item.photo_url_320 || item.photo_url_160 || "";
            const imageBlock = imageSrc
                ? `<div class="inventory-card__image">
                       <img src="${imageSrc}" alt="Inventory Image" />
                     </div>`
                : `<div class="inventory-card__image inventory-card__image--empty">
                       <span class="inventory-card__placeholder">사진 없음</span>
                     </div>`;

            const engName = item.Substance?.substance_name || "-";
            const formula = item.Substance?.molecular_formula || "-";
            const casRn = item.Substance?.cas_rn || "";
            const molMass = item.Substance?.molecular_mass || "-";

            return `
              <div class="inventory-card" ${onClickAttr} style="cursor: default;">
                ${imageBlock}
                <div class="inventory-card__body">
                  <div class="inventory-card__left">
                    <div class="inventory-card__line1">
                      <span class="inventory-card__no">No.${item.id}</span>
                      ${casRn ? `<span class="cas-rn">${casRn}</span>` : ""}
                    </div>
                    <div class="inventory-card__line2 name-kor">${name}</div>
                    <div class="inventory-card__line3 name-eng">${engName}</div>
                    <div class="inventory-card__line4 inventory-card__location">${locationText}</div>
                  </div>
                  <div class="inventory-card__meta">
                    <div class="meta-line1">${formula}</div>
                    <div class="meta-line2">
                      <span class="meta-label">화학식량</span>
                      <span class="meta-value">${molMass}</span>
                    </div>
                    <div class="meta-line3">${concStr}</div>
                    <div class="meta-line4">${item.current_amount}${item.unit}</div>
                  </div>
                </div>
              </div>
            `;
        }

        // ✅ 목록 화면 (isDetail=false): 2줄 레이아웃 (사진 없음)
        return `
          <div class="inventory-card" ${onClickAttr} style="padding: 10px 12px;">
            <div class="inventory-card__body">
              <div class="inventory-card__left">
                <div class="inventory-card__line1" style="display: flex !important; flex-direction: row !important; align-items: center !important;">
                  <span class="inventory-card__no" style="margin-right: 8px !important;">No.${item.id}</span>
                  <span class="name-kor" style="font-weight: bold !important; font-size: 1.1em !important; margin: 0 !important;">${name}</span>
                </div>
                <div class="inventory-card__line4 inventory-card__location" style="margin-top: 4px; color: #666;">${locationText}</div>
              </div>
              <div class="inventory-card__meta" style="text-align: right; min-width: 80px;">
                <div class="meta-line3" style="font-weight: bold; color: #555;">${concStr}</div>
                <div class="meta-line4" style="margin-top: 4px; color: #00a0b2; font-weight: bold;">${item.current_amount}${item.unit}</div>
              </div>
            </div>
          </div>
        `;
    }

    // ------------------------------------------------------------
    // 3️⃣ 아이템 선택 (상세 화면 진입)
    // ------------------------------------------------------------
    async function selectItem(id) {
        selectedItem = allInventory.find(i => i.id === id);
        if (!selectedItem) return;

        // 1. 화면 전환
        document.getElementById("usage-list-section").style.display = "none";
        document.getElementById("usage-detail-section").style.display = "block";

        // 2. 선택된 아이템 정보 렌더링
        const displayContainer = document.getElementById("selected-item-display");
        displayContainer.innerHTML = renderItemCard(selectedItem, true);

        // 3. 폼 단위 설정
        document.getElementById("usage-form-unit").textContent = selectedItem.unit;

        // 4. 스크롤 상단 이동
        window.scrollTo(0, 0);

        // 5. 사용 기록 로드
        await loadUsageHistory(id);
    }

    function goBackToList() {
        selectedItem = null;
        document.getElementById("usage-detail-section").style.display = "none";
        document.getElementById("usage-list-section").style.display = "block";

        // 폼 초기화
        document.getElementById("usage-amount").value = "";
        document.getElementById("usage-history-body").innerHTML = "";
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
    // 5️⃣ 사용량 등록
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
            const finalAmount = newAmount < 0 ? 0 : newAmount;

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
            selectedItem.current_amount = finalAmount;
            selectedItem.status = newStatus;

            // UI 갱신
            if (newStatus === "전량소진") {
                alert("⚠️ 해당 약품이 전량 소진되었습니다.");
                // 목록 다시 로드 (소진된 것 제거) 후 목록으로 복귀
                await loadInventoryList();
                goBackToList();
            } else {
                // 상세 화면의 카드 정보 갱신 (잔량 업데이트)
                const displayContainer = document.getElementById("selected-item-display");
                displayContainer.innerHTML = renderItemCard(selectedItem, true);

                // 기록 목록 갱신
                await loadUsageHistory(selectedItem.id);

                // 백그라운드 목록 데이터도 갱신 (다시 로드하지 않고 배열만 수정)
                const itemInList = allInventory.find(i => i.id === selectedItem.id);
                if (itemInList) {
                    itemInList.current_amount = finalAmount;
                    itemInList.status = newStatus;
                }
                // 목록 뷰도 갱신 (검색어 유지)
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
