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
        bottle_mass,
        door_vertical, door_horizontal, internal_shelf_level, storage_column,
        photo_url_320, photo_url_160,
        Substance ( 
            substance_name, cas_rn, chem_name_kor, chem_name_kor_mod, molecular_formula, molecular_formula_mod, molecular_mass,
            Properties ( name, property )
        ),
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
            const formula = item.Substance?.molecular_formula_mod || item.Substance?.molecular_formula || "-";
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
        document.getElementById("usage-list-section").style.display = ""; // Restore CSS display (flex)

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

        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">로딩 중...</td></tr>';

        const { data, error } = await supabase
            .from("UsageLog")
            .select("*")
            .eq("inventory_id", inventoryId)
            .order("usage_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) {
            console.error("❌ 사용 기록 로드 실패:", error);
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">기록을 불러오지 못했습니다.</td></tr>';
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888;">사용 기록이 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(log => `
      <tr id="log-row-${log.id}">
        <td class="col-date">${log.usage_date}</td>
        <td class="col-subject">${log.subject}</td>
        <td class="col-period">${log.period}</td>
        <td class="col-amount">${log.amount} ${log.unit || ""}</td>
        <td>
            <button class="btn-mini btn-edit" onclick="App.UsageRegister.editLog(${log.id})">수정</button>
            <button class="btn-mini btn-delete" onclick="App.UsageRegister.deleteLog(${log.id}, ${log.amount})">삭제</button>
        </td>
      </tr>
    `).join("");
    }

    // ------------------------------------------------------------
    // 4-1. 로그 삭제
    // ------------------------------------------------------------
    async function deleteLog(logId, amount) {
        if (!confirm("정말 이 사용 기록을 삭제하시겠습니까?\n삭제된 사용량은 재고에 다시 합산됩니다.")) return;

        const supabase = App.supabase;
        try {
            // 1. 로그 삭제
            const { error: delError } = await supabase
                .from("UsageLog")
                .delete()
                .eq("id", logId);

            if (delError) throw delError;

            // 2. 재고 복구 (현재 재고 + 삭제된 사용량)
            if (selectedItem) {
                const newAmount = selectedItem.current_amount + amount;
                const { error: invError } = await supabase
                    .from("Inventory")
                    .update({ current_amount: newAmount })
                    .eq("id", selectedItem.id);

                if (invError) throw invError;

                // 데이터 갱신
                selectedItem.current_amount = newAmount;
                if (newAmount > 0 && selectedItem.status === "전량소진") {
                    selectedItem.status = "사용가능"; // 상태 복구 (필요 시 로직 정교화)
                    // 전량소진 상태였다면 상태 업데이트도 필요
                    await supabase.from("Inventory").update({ status: "사용가능" }).eq("id", selectedItem.id);
                }
            }

            alert("✅ 기록이 삭제되었습니다.");
            refreshUI();

        } catch (err) {
            console.error("삭제 실패:", err);
            alert("삭제 중 오류가 발생했습니다.");
        }
    }

    // ------------------------------------------------------------
    // 4-2. 로그 수정 (인라인 모드 전환)
    // ------------------------------------------------------------
    function editLog(logId) {
        const row = document.getElementById(`log-row-${logId}`);
        if (!row) return;

        // 기존 값 가져오기
        const date = row.querySelector(".col-date").textContent;
        const subject = row.querySelector(".col-subject").textContent;
        const period = row.querySelector(".col-period").textContent;
        const amountText = row.querySelector(".col-amount").textContent;
        const amount = parseFloat(amountText.split(" ")[0]); // "100 mL" -> 100

        // 인라인 입력창으로 변환
        row.innerHTML = `
            <td><input type="date" id="edit-date-${logId}" value="${date}" style="width:100px;"></td>
            <td>
                <select id="edit-subject-${logId}" style="width:80px;">
                    <option value="통합과학">통합과학</option>
                    <option value="과학탐구실험">과학탐구실험</option>
                    <option value="물리학">물리학</option>
                    <option value="화학">화학</option>
                    <option value="생명과학">생명과학</option>
                    <option value="지구과학">지구과학</option>
                    <option value="동아리">동아리</option>
                    <option value="기타">기타</option>
                </select>
            </td>
            <td>
                <select id="edit-period-${logId}" style="width:80px;">
                    <option value="1교시">1교시</option>
                    <option value="2교시">2교시</option>
                    <option value="3교시">3교시</option>
                    <option value="4교시">4교시</option>
                    <option value="5교시">5교시</option>
                    <option value="6교시">6교시</option>
                    <option value="7교시">7교시</option>
                    <option value="점심시간">점심시간</option>
                    <option value="방과후">방과후</option>
                </select>
            </td>
            <td><input type="number" id="edit-amount-${logId}" value="${amount}" step="0.01" style="width:60px;"></td>
            <td>
                <button class="btn-mini btn-save" onclick="App.UsageRegister.saveLog(${logId}, ${amount})">저장</button>
                <button class="btn-mini btn-cancel" onclick="App.UsageRegister.cancelEdit(${selectedItem.id})">취소</button>
            </td>
        `;

        // Select 값 설정
        document.getElementById(`edit-subject-${logId}`).value = subject;
        document.getElementById(`edit-period-${logId}`).value = period;
    }

    // ------------------------------------------------------------
    // 4-3. 로그 저장
    // ------------------------------------------------------------
    async function saveLog(logId, oldAmount) {
        const newDate = document.getElementById(`edit-date-${logId}`).value;
        const newSubject = document.getElementById(`edit-subject-${logId}`).value;
        const newPeriod = document.getElementById(`edit-period-${logId}`).value;
        const newAmount = parseFloat(document.getElementById(`edit-amount-${logId}`).value);

        if (!newDate || !newSubject || !newPeriod || isNaN(newAmount) || newAmount <= 0) {
            alert("입력 값을 확인해주세요.");
            return;
        }

        const supabase = App.supabase;
        try {
            // 1. 로그 업데이트
            const { error: updateError } = await supabase
                .from("UsageLog")
                .update({
                    usage_date: newDate,
                    subject: newSubject,
                    period: newPeriod,
                    amount: newAmount
                })
                .eq("id", logId);

            if (updateError) throw updateError;

            // 2. 재고 조정 (차이만큼 반영)
            // 차이 = 새로운 사용량 - 기존 사용량
            // 재고 = 현재 재고 - 차이
            // 예: 기존 100, 신규 120 -> 차이 20 -> 재고 20 감소
            // 예: 기존 100, 신규 80 -> 차이 -20 -> 재고 20 증가
            const diff = newAmount - oldAmount;
            if (selectedItem && diff !== 0) {
                const newCurrentAmount = selectedItem.current_amount - diff;

                // 음수 방지 로직 (선택 사항)
                if (newCurrentAmount < 0) {
                    alert("수정된 사용량이 현재 재고보다 많습니다. 재고가 0으로 처리됩니다.");
                }
                const finalAmount = Math.max(0, newCurrentAmount);

                const { error: invError } = await supabase
                    .from("Inventory")
                    .update({ current_amount: finalAmount })
                    .eq("id", selectedItem.id);

                if (invError) throw invError;
                selectedItem.current_amount = finalAmount;
            }

            alert("✅ 수정되었습니다.");
            refreshUI();

        } catch (err) {
            console.error("수정 실패:", err);
            alert("수정 중 오류가 발생했습니다.");
        }
    }

    function cancelEdit(inventoryId) {
        loadUsageHistory(inventoryId);
    }

    function refreshUI() {
        if (selectedItem) {
            // 상세 카드 갱신
            document.getElementById("selected-item-display").innerHTML = renderItemCard(selectedItem, true);
            // 목록 갱신
            loadUsageHistory(selectedItem.id);
        }
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

        const usageInput = document.getElementById("usage-amount");
        const massInput = document.getElementById("usage-remaining-mass");

        const usageVal = usageInput.value && !isNaN(parseFloat(usageInput.value)) ? parseFloat(usageInput.value) : null;
        const massVal = massInput.value && !isNaN(parseFloat(massInput.value)) ? parseFloat(massInput.value) : null;

        // 1. 입력 유효성 검사 (XOR 조건 위배 시 경고)
        // 둘 다 값이 있거나, 둘 다 값이 없는 경우
        if ((usageVal !== null && massVal !== null) || (usageVal === null && massVal === null)) {
            alert("사용량과 사용 후 시약병 질량 중 하나만 입력해주세요.");
            return;
        }

        let calculatedUsage = 0;

        // 2. 사용량 계산 로직
        if (usageVal !== null) {
            // Case A: 사용량을 직접 입력한 경우
            if (usageVal <= 0) {
                alert("올바른 사용량을 입력하세요.");
                return;
            }
            calculatedUsage = usageVal;

        } else if (massVal !== null) {
            // Case B: 사용 후 시약병 질량을 입력한 경우
            if (massVal < 0) {
                alert("올바른 질량을 입력하세요.");
                return;
            }

            const bottleMass = selectedItem.bottle_mass;
            if (bottleMass == null) { // null or undefined
                alert("이 약품은 공병 질량 정보가 없어 계산할 수 없습니다.\n사용량을 직접 입력해주세요.");
                return;
            }

            const currentAmount = selectedItem.current_amount;
            const unit = selectedItem.unit;

            // 시약병에 남은 내용물의 질량
            const remainingContentMass = massVal - bottleMass;
            if (remainingContentMass < 0) {
                alert(`입력한 질량(${massVal}g)이 공병 질량(${bottleMass}g)보다 작습니다.`);
                return;
            }

            if (unit === 'g' || unit === 'kg' || unit === 'mg') {
                // 질량 단위인 경우: 단순 차이 계산
                // Usage = (Current Amount + Bottle Mass) - Input Mass
                // 또는 Usage = Current Amount - Remaining Content Mass
                // (단위가 g라고 가정. kg 등은 변환 필요하지만, 일단 g로 통일 가정)
                calculatedUsage = currentAmount - remainingContentMass;

            } else if (unit === 'mL' || unit === 'L') {
                // 부피 단위인 경우: 밀도 필요
                const props = selectedItem.Substance?.Properties || [];
                const densityProp = props.find(p => p.name === "Density");

                if (!densityProp || !densityProp.property) {
                    alert("이 약품은 밀도 정보가 없어 부피를 계산할 수 없습니다.\n사용량을 직접 입력해주세요.");
                    return;
                }

                // 밀도 값 파싱 (예: "1.84 g/cm3 @ 20 °C" -> 1.84)
                let density = parseFloat(densityProp.property);
                if (isNaN(density)) {
                    alert(`밀도 정보를 해석할 수 없습니다: ${densityProp.property}`);
                    return;
                }

                // 농도 보정 (퍼센트 농도인 경우)
                // 식: 밀도 = (원액밀도 * 농도%) + (물밀도1 * (1-농도%))
                if (selectedItem.concentration_unit === '%') {
                    const conc = parseFloat(selectedItem.concentration_value);
                    if (!isNaN(conc)) {
                        const ratio = conc / 100;
                        density = (density * ratio) + (1.0 * (1 - ratio));
                    }
                }

                // 남은 부피 계산 (Volume = Mass / Density)
                const remainingVolume = remainingContentMass / density;

                // 사용량 = 현재 잔량 - 남은 부피
                calculatedUsage = currentAmount - remainingVolume;

                // 소수점 처리 (예: 소수점 2자리)
                calculatedUsage = Math.round(calculatedUsage * 100) / 100;
            } else {
                alert(`지원하지 않는 단위입니다: ${unit}`);
                return;
            }
        }

        if (calculatedUsage <= 0) {
            // 계산된 사용량이 0 이하인 경우 (잔량이 더 늘어난 경우 등)
            // 사용자가 실수했을 수 있으므로 경고하되, 마이너스 사용량(충전?)은 일단 막음
            alert(`계산된 사용량이 유효하지 않습니다 (${calculatedUsage}${selectedItem.unit}).\n입력 값을 확인해주세요.`);
            return;
        }

        if (!confirm(`${calculatedUsage}${selectedItem.unit} 사용을 등록하시겠습니까?`)) return;

        try {
            // 1. UsageLog 삽입
            const { error: logError } = await supabase
                .from("UsageLog")
                .insert({
                    inventory_id: selectedItem.id,
                    usage_date: date,
                    subject: subject,
                    period: period,
                    amount: calculatedUsage,
                    unit: selectedItem.unit
                });

            if (logError) throw logError;

            // 2. Inventory 업데이트 (차감)
            const newAmount = selectedItem.current_amount - calculatedUsage;
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
            document.getElementById("usage-remaining-mass").value = "";

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
        selectItem,
        deleteLog,
        editLog,
        saveLog,
        cancelEdit
    };
})();
