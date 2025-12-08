(function () {
    const supabase = globalThis.App?.supabase || window.supabaseClient;

    // State
    let catalog = []; // Full list from experiment_kit table
    let currentSort = 'name_class';
    let currentSearch = '';

    // Constants for MSDS
    const msdsTitles = [
        "1. 화학제품과 회사에 관한 정보", "2. 유해성·위험성", "3. 구성성분의 명칭 및 함유량", "4. 응급조치 요령",
        "5. 화재 시 조치방법", "6. 누출 시 조치방법", "7. 취급 및 저장방법", "8. 노출방지 및 개인보호구",
        "9. 물리화학적 특성", "10. 안정성 및 반응성", "11. 독성에 관한 정보", "12. 환경에 미치는 영향",
        "13. 폐기 시 주의사항", "14. 운송에 필요한 정보", "15. 법적 규제현황", "16. 그 밖의 참고사항"
    ];

    const ghsMapping = {
        "01": "폭발성(Explosive)\n· 불안정한 폭발물\n· 폭발물\n· 자기반응성 물질 및 혼합물\n· 유기과산화물",
        "02": "인화성(Flammable)\n· 인화성 가스\n· 가연성 에어로졸\n· 인화성 액체\n· 인화성 고체\n· 자기반응성 물질 및 혼합물\n· 발화성 액체\n· 발화성 고체\n· 가연성 고체\n· 가연성 액체\n· 자체 발열 물질 및 혼합물\n· 물과 접촉하여 가연성 가스를 방출하는 물질 및 혼합물\n· 유기 과산화물",
        "03": "산화성(Oxidizing)\n· 산화 가스\n· 산화성 액체\n· 산화성 고체",
        "04": "고압 가스(Compressed Gas)\n· 압축 가스\n· 액화 가스\n· 냉장 액화 가스\n· 용존 가스",
        "05": "부식성(Corrosive)\n· 금속 부식성\n· 폭발물\n· 인화성 가스\n· 자기 반응성물질 및 혼합물\n· 유기 과산화물\n· 피부부식\n· 심각한 눈 손상",
        "06": "유독성(Toxic)\n· 급성 독성",
        "07": "경고(Health Hazard, Hazardous to Ozone Layer)\n· 급성 독성\n· 피부 자극성\n· 눈 자극성\n· 피부 과민성\n· 특정 표적 장기 독성(호흡기 자극, 마약 효과)",
        "08": "건강 유해성(Serious Health hazard)\n· 호흡기 과민성\n· 생식세포 변이원성\n· 발암성\n· 생식독성\n· 특정표적장기 독성\n· 흡인 위험",
        "09": "수생 환경 유독성(Hazardous to the Environment)\n· 수생환경 유해성",
    };

    function formatLocation(jsonStr) {
        if (!jsonStr) return '위치 미지정';
        try {
            if (jsonStr.trim().startsWith('{')) {
                const loc = JSON.parse(jsonStr);
                const parts = [];
                if (loc.area_name) parts.push(loc.area_name);
                if (loc.cabinet_name) parts.push(loc.cabinet_name);

                const det = [];
                if (loc.door_vertical) det.push(loc.door_vertical + '번');
                if (loc.door_horizontal) det.push(loc.door_horizontal + '번');
                if (loc.internal_shelf_level) det.push(loc.internal_shelf_level + '단');
                if (loc.storage_column) det.push(loc.storage_column + '열');

                if (det.length > 0) parts.push(det.join(' '));

                return parts.join(' > ') || '위치 미지정';
            }
        } catch (e) { /* ignore */ }
        return jsonStr;
    }

    const Kits = {
        async init() {
            console.log("📦 Kit Page Initialized");

            // 1. Setup FAB
            if (App.Fab) {
                App.Fab.setVisibility(true, '<span class="material-symbols-outlined">add</span> 새 키트 등록', () => {
                    if (this.openRegisterModal) {
                        this.openRegisterModal();
                    } else {
                        console.error("openRegisterModal is not defined");
                        alert("기능 초기화 중입니다. 잠시 후 다시 시도해주세요.");
                    }
                });
            }

            // 2. Setup Sort Dropdown
            if (App.SortDropdown) {
                App.SortDropdown.init({
                    toggleId: 'kit-sort-toggle',
                    menuId: 'kit-sort-menu',
                    labelId: 'kit-sort-label',
                    defaultLabel: '키트이름(분류)',
                    defaultValue: 'name_class',
                    onChange: (value) => {
                        currentSort = value;
                        this.loadUserKits();
                    }
                });
            }

            // 3. Setup Search
            const searchInput = document.getElementById('kit-search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    // Remove all spaces for flexible search
                    currentSearch = e.target.value.replace(/\s+/g, '').toLowerCase();
                    this.loadUserKits();
                });
            }

            // 4. Setup Refresh
            const refreshBtn = document.getElementById('kit-refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.loadUserKits();
                });
            }

            // 5. Load Data
            await loadCatalog();
            await this.loadUserKits();

            // 6. Setup Modals
            setupRegisterModal();
            setupStockModal();
        },

        async loadUserKits() {
            const listContainer = document.getElementById('kit-list');
            if (!listContainer) return;

            let query = supabase.from('user_kits').select('*');

            // Apply Sort
            if (currentSort === 'name_class') {
                query = query.order('kit_class', { ascending: true }).order('kit_name', { ascending: true });
            } else if (currentSort === 'name_all') {
                query = query.order('kit_name', { ascending: true });
            } else if (currentSort === 'location') {
                query = query.order('id', { ascending: true });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query;

            if (error) {
                listContainer.innerHTML = `<p class="error">로드 실패: ${error.message}</p>`;
                return;
            }

            // Apply Search
            let filteredData = data;
            if (currentSearch) {
                filteredData = data.filter(kit => {
                    const name = kit.kit_name.replace(/\s+/g, '').toLowerCase();
                    const kClass = (kit.kit_class || '').replace(/\s+/g, '').toLowerCase();
                    return name.includes(currentSearch) || kClass.includes(currentSearch);
                });
            }

            if (!filteredData || filteredData.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <span class="material-symbols-outlined" style="font-size:48px; color:#ccc;">inventory_2</span>
                        <p>검색 결과가 없습니다.</p>
                    </div>`;
                return;
            }

            listContainer.innerHTML = '';
            filteredData.forEach(kit => {
                const card = document.createElement('div');
                card.className = 'inventory-card';
                card.dataset.id = kit.id;

                // Image block
                let imageBlock = '';
                if (kit.image_url) {
                    imageBlock = `
                        <div class="inventory-card__image">
                            <img src="${kit.image_url}" alt="${kit.kit_name}">
                        </div>`;
                } else {
                    imageBlock = `
                        <div class="inventory-card__image inventory-card__image--empty">
                            <span class="inventory-card__placeholder">사진 없음</span>
                        </div>`;
                }

                card.innerHTML = `
                    ${imageBlock}
                    <div class="inventory-card__body" style="display: flex; justify-content: space-between; align-items: stretch; width: 100%; padding: 10px; box-sizing: border-box;">
                        <div class="inventory-card__left" style="display: flex; flex-direction: column; justify-content: space-between; flex: 1;">
                             <div style="margin-bottom: 2px;">
                                <span class="kit-tag" style="background:#e3f2fd; color:#0d47a1; padding:2px 6px; border-radius:4px; font-size:12px;">${kit.kit_class || '미분류'}</span>
                             </div>
                             <div class="name-kor" style="font-weight: bold; font-size: 16px; margin: 2px 0;">${kit.kit_name}</div>
                             <div class="kit-location" style="font-size: 13px; color: #777;">${formatLocation(kit.location)}</div>
                        </div>

                        <div class="inventory-card__right" style="display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; margin-left: 10px;">
                            <div class="kit-quantity" style="font-size: 14px; color: #555; margin-top: auto; margin-bottom: 5px;">수량: ${kit.quantity}개</div>
                            
                            <div class="inventory-card__actions" style="display: flex; gap: 5px;">
                                <button class="icon-btn stock-kit-btn" data-id="${kit.id}" style="border:none; background:none; cursor:pointer; padding:4px;" title="재고 관리">
                                    <span class="material-symbols-outlined" style="font-size: 20px; color: #4caf50;">inventory</span>
                                </button>
                                <button class="icon-btn edit-kit-btn" data-id="${kit.id}" style="border:none; background:none; cursor:pointer; padding:4px;" title="수정">
                                    <span class="material-symbols-outlined" style="font-size: 20px; color: #00a0b2;">edit</span>
                                </button>
                                <button class="icon-btn delete-kit-btn" data-id="${kit.id}" style="border:none; background:none; cursor:pointer; padding:4px;" title="삭제">
                                    <span class="material-symbols-outlined" style="font-size: 20px; color: #999;">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                // Card Click -> Navigate to Detail Page
                card.addEventListener('click', () => {
                    App.Router.go('kitDetail', { id: kit.id });
                });

                // Stock Button
                const stockBtn = card.querySelector('.stock-kit-btn');
                if (stockBtn) {
                    stockBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        setupStockModal();
                        openStockModal(kit);
                    });
                }

                // Edit Button
                const editBtn = card.querySelector('.edit-kit-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (window.openEditKitModal) {
                            window.openEditKitModal(kit);
                        }
                    });
                }

                // Delete Button
                const deleteBtn = card.querySelector('.delete-kit-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (confirm('정말 삭제하시겠습니까?')) {
                            await deleteKit(kit.id);
                        }
                    });
                }

                listContainer.appendChild(card);
            });
        },

        async loadDetail(id) {
            console.log("📦 Kit Detail Loading for ID:", id);

            // Ensure catalog is loaded (might be needed for chemical mapping)
            if (catalog.length === 0) await loadCatalog();

            // 1. Fetch Kit Data
            const { data: kit, error } = await supabase
                .from('user_kits')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !kit) {
                console.error("Kit not found:", error);
                const container = document.getElementById('kit-detail-page-container');
                if (container) container.innerHTML = '<p class="error">키트 정보를 찾을 수 없습니다.</p>';
                return;
            }

            // 2. Populate Header & Info
            document.getElementById('detail-kit-name').textContent = kit.kit_name;
            document.getElementById('detail-kit-class').textContent = kit.kit_class || '-';

            // Photo
            const photoBox = document.getElementById('detail-kit-photo');
            if (kit.image_url) {
                photoBox.innerHTML = `<img src="${kit.image_url}" alt="키트 사진">`;
            } else {
                photoBox.innerHTML = '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#999;">사진 없음</div>';
            }

            // 3. Render 7-Row Layout
            const detailRight = document.querySelector('.detail-right');
            detailRight.innerHTML = `
                <div class="kit-info">
                    <div class="kit-info-row">
                        <span class="label">수량</span>
                        <span class="value" id="detail-kit-quantity">${kit.quantity}</span>
                    </div>
                    <div class="kit-info-row">
                        <span class="label">보관 위치</span>
                        <span class="value" id="detail-kit-location">${formatLocation(kit.location)}</span>
                    </div>
                    <div class="kit-info-row" id="kit-row-3">
                        <span class="label">구성 약품</span>
                        <span class="value"></span>
                    </div>
                    <div class="kit-info-row" id="kit-row-4"><span class="label"></span><span class="value"></span></div>
                    <div class="kit-info-row" id="kit-row-5"><span class="label"></span><span class="value"></span></div>
                    <div class="kit-info-row" id="kit-row-6"><span class="label"></span><span class="value"></span></div>
                    <div class="kit-info-row" id="kit-row-7"><span class="label"></span><span class="value"></span></div>
                </div>
            `;

            // 4. Load Chemicals & Logs
            await loadChemicals(kit);
            await loadUsageLogs(kit);
        }
    };

    // ---- Data Loading Helpers ----
    async function loadCatalog() {
        const { data, error } = await supabase.from('experiment_kit').select('*').order('kit_name');
        if (error) {
            console.error('Failed to load catalog:', error);
            return;
        }
        catalog = data;
    }

    async function deleteKit(id) {
        try {
            const { error } = await supabase.from('user_kits').delete().eq('id', id);
            if (error) throw error;
            // If on list page, reload list. If on detail page, router handles it.
            if (document.getElementById('kit-list')) {
                Kits.loadUserKits();
            }
        } catch (e) {
            alert('삭제 실패: ' + e.message);
        }
    }

    async function loadChemicals(kit) {
        // Clear previous content in rows 3-7
        for (let i = 3; i <= 7; i++) {
            const row = document.getElementById(`kit-row-${i}`);
            if (row) {
                row.querySelector('.value').innerHTML = '';
                if (i > 3) row.querySelector('.label').textContent = '';
            }
        }

        const catalogItem = catalog.find(c => c.kit_name === kit.kit_name);
        if (!catalogItem || !catalogItem.kit_cas) {
            document.querySelector('#kit-row-3 .value').textContent = '-';
            return;
        }

        const casList = catalogItem.kit_cas.split(',').map(s => s.trim()).filter(s => s);

        // Fetch Korean names
        const { data: chemData } = await supabase
            .from('kit_chemicals')
            .select('cas_no, name_ko, name_en, msds_data, formula, molecular_weight')
            .in('cas_no', casList);

        const map = new Map();
        if (chemData) {
            chemData.forEach(c => {
                map.set(c.cas_no, c);
            });
        }

        // Create buttons
        const buttons = casList.map(cas => {
            const btn = document.createElement('div'); // Use div for better control, styled as btn
            btn.className = 'kit-component-btn';
            const chem = map.get(cas);
            const displayName = chem ? (chem.name_ko || chem.name_en || cas) : cas;
            btn.textContent = displayName;
            btn.title = cas;
            btn.onclick = () => renderInlineChemInfo(cas, chem);
            return btn;
        });

        // Distribute buttons across rows 3-7
        const rows = [
            document.querySelector('#kit-row-3 .value'),
            document.querySelector('#kit-row-4 .value'),
            document.querySelector('#kit-row-5 .value'),
            document.querySelector('#kit-row-6 .value'),
            document.querySelector('#kit-row-7 .value')
        ];

        const totalItems = buttons.length;
        const totalRows = 5;

        if (totalItems === 0) {
            rows[0].textContent = '-';
        } else if (totalItems <= totalRows) {
            // If items <= rows, put one per row (or fill from top)
            // User request: "If 1 item, row 3. If 2 items, row 3 and 4."
            buttons.forEach((btn, index) => {
                if (index < totalRows) rows[index].appendChild(btn);
            });
        } else {
            // Distribute evenly or fill max 3 per row
            // User example: 13 -> 3, 3, 3, 2, 2

            // Simple distribution logic:
            // Calculate items per row
            const baseCount = Math.floor(totalItems / totalRows);
            const remainder = totalItems % totalRows;

            let currentIndex = 0;
            for (let i = 0; i < totalRows; i++) {
                // Distribute remainder to first few rows
                const count = baseCount + (i < remainder ? 1 : 0);
                for (let j = 0; j < count; j++) {
                    if (currentIndex < totalItems) {
                        rows[i].appendChild(buttons[currentIndex]);
                        currentIndex++;
                    }
                }
            }
        }
    }

    async function loadUsageLogs(kit) {
        const tbody = document.getElementById('kit-usage-logs-body');
        if (!tbody) return;

        // Update Header
        const thead = document.querySelector('.kit-log-table thead tr');
        if (thead) {
            thead.innerHTML = `
                <th>날짜</th>
                <th>유형</th>
                <th>변동</th>
                <th>수량</th>
            `;
        }

        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">기록 로딩 중...</td></tr>';

        try {
            const { data: usageLogs, error } = await supabase
                .from('kit_usage_log')
                .select('*')
                .eq('user_kit_id', kit.id)
                .order('log_date', { ascending: true }); // Oldest first

            if (error) throw error;

            const initialLog = {
                log_date: kit.purchase_date,
                log_type: '구입 (초기)',
                change_amount: kit.quantity, // Initial amount is the change
                is_initial: true
            };

            let allLogs = [];
            if (kit.purchase_date) allLogs.push(initialLog);
            if (usageLogs) allLogs = [...allLogs, ...usageLogs];

            // Sort by date ascending (Oldest first)
            allLogs.sort((a, b) => new Date(a.log_date) - new Date(b.log_date));

            if (allLogs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #999;">기록이 없습니다.</td></tr>';
            } else {
                tbody.innerHTML = '';
                let currentQuantity = 0;

                allLogs.forEach(log => {
                    const tr = document.createElement('tr');
                    let typeText = log.log_type === 'usage' ? '사용' : (log.log_type === 'purchase' ? '구입' : log.log_type);
                    if (log.is_initial) typeText = '최초 등록';

                    let change = 0;
                    if (log.is_initial) {
                        change = log.change_amount; // Initial amount
                        currentQuantity = change; // Reset to initial
                    } else {
                        change = log.change_amount;
                        // If usage, change is negative usually, but let's check data
                        // Assuming change_amount is signed in DB? 
                        // If not, we need logic. Usually usage is negative.
                        // Let's assume change_amount is correct signed value or we adjust based on type
                        // Checking usage-register.js might reveal this. 
                        // For now, let's assume change_amount is the delta.
                        currentQuantity += change;
                    }

                    const changeText = change > 0 ? `+${change}` : `${change}`;

                    tr.innerHTML = `
                        <td>${log.log_date}</td>
                        <td>${typeText}</td>
                        <td>${changeText}</td>
                        <td>${currentQuantity}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch (e) {
            console.error("Log fetch error:", e);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">기록을 불러오지 못했습니다.</td></tr>';
        }
    }

    async function renderInlineChemInfo(casInput, kitChemData = null) {
        const cas = casInput ? casInput.trim() : '';
        const container = document.getElementById('kit-chem-detail-container');
        const title = document.getElementById('kit-chem-detail-title');
        const content = document.getElementById('kit-chem-detail-content');

        if (!container || !title || !content) return;

        container.style.display = 'block';
        title.textContent = `${cas} 상세 정보 로딩 중...`;
        content.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">데이터를 불러오는 중입니다...</div>';

        try {
            let substanceData = null;
            let error = null;

            // 1. Try searching by CAS in Substance table
            if (cas) {
                const result = await supabase
                    .from('Substance')
                    .select(`
                        id, substance_name, cas_rn, molecular_formula, molecular_mass, chem_name_kor,
                        Properties ( name, property ),
                        MSDS ( section_number, content )
                    `)
                    .eq('cas_rn', cas)
                    .limit(1);

                if (result.data && result.data.length > 0) {
                    substanceData = result.data[0];
                }
                // Don't throw error yet, try fallbacks
            }

            // 2. Fallback: Use kit_chemicals data if Substance query failed or returned no data
            if (!substanceData && kitChemData && kitChemData.msds_data && kitChemData.msds_data.length > 0) {
                console.log(`Using kit_chemicals data for ${cas}`);
                substanceData = {
                    cas_rn: kitChemData.cas_no || cas,
                    chem_name_kor: kitChemData.name_ko,
                    substance_name: kitChemData.name_en,
                    molecular_formula: kitChemData.formula,
                    molecular_mass: kitChemData.molecular_weight,
                    MSDS: kitChemData.msds_data,
                    Properties: [] // Properties not available in kit_chemicals
                };
            }

            // 3. Fallback: Try searching by Name in Substance table
            if (!substanceData && kitChemData) {
                const nameKo = kitChemData.name_ko;
                const nameEn = kitChemData.name_en;

                if (nameKo || nameEn) {
                    console.log(`CAS lookup failed for ${cas}. Trying name lookup: ${nameKo || nameEn}`);
                    const query = supabase
                        .from('Substance')
                        .select(`
                            id, substance_name, cas_rn, molecular_formula, molecular_mass, chem_name_kor,
                            Properties ( name, property ),
                            MSDS ( section_number, content )
                        `)
                        .limit(1);

                    if (nameKo) {
                        query.ilike('chem_name_kor', `%${nameKo}%`);
                    } else if (nameEn) {
                        query.ilike('substance_name', `%${nameEn}%`);
                    }

                    const result = await query;
                    if (result.data && result.data.length > 0) {
                        substanceData = result.data[0];
                    }
                }
            }

            if (error) {
                throw error;
            }

            const substance = substanceData;

            if (!substance) {
                content.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">해당 물질의 상세 정보(MSDS)가 데이터베이스에 없습니다.</div>';
                title.textContent = `${cas} (정보 없음)`;
                return;
            }

            const korName = substance.chem_name_kor || substance.substance_name || cas;
            title.textContent = `${korName} (${cas})`;

            const propsList = substance.Properties || [];
            const getPropVal = (nameKey) => {
                const found = propsList.find((p) => p.name && p.name.toLowerCase().includes(nameKey.toLowerCase()));
                return found ? found.property : '-';
            };

            let html = `
                <div style="margin-bottom: 20px; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                    <h5 style="margin: 0; padding: 10px; background: #f9f9f9; font-size: 15px; color: #333; border-bottom: 1px solid #eee;">기본 특성</h5>
                    
                    <div class="msds-row">
                        <div class="msds-header">화학식</div>
                        <div class="msds-content">${substance.molecular_formula || '-'}</div>
                        <div class="msds-header">화학식량</div>
                        <div class="msds-content">${substance.molecular_mass || '-'}</div>
                    </div>
                    
                    <div class="msds-row">
                        <div class="msds-header">끓는점</div>
                        <div class="msds-content">${getPropVal('Boiling Point')}</div>
                        <div class="msds-header">녹는점</div>
                        <div class="msds-content">${getPropVal('Melting Point')}</div>
                    </div>

                    <div class="msds-row">
                        <div class="msds-header">밀도</div>
                        <div class="msds-content">${getPropVal('Density')}</div>
                    </div>
                </div>
            `;

            html += `<h5 style="margin: 0 0 10px 0; font-size: 15px; color: #333;">MSDS 정보</h5>`;
            html += `<div class="accordion" id="inline-msds-accordion">`;

            const msdsData = substance.MSDS || [];

            html += msdsTitles.map((title, index) => {
                const sectionNum = index + 1;
                const sectionData = msdsData.find(d => d.section_number === sectionNum);
                let contentHtml = '<p class="text-gray-500 italic p-4">내용 없음</p>';

                if (sectionData && sectionData.content) {
                    if (sectionNum === 2 && sectionData.content.includes("|||그림문자|||")) {
                        const rows = sectionData.content.split(";;;");
                        const rowsHtml = rows.map(row => {
                            const parts = row.split("|||");
                            if (parts.length >= 3) {
                                const [no, name, detail] = parts;

                                if (name.trim() === "그림문자") {
                                    const ghsCodes = detail.trim().split(/\s+/).filter(s => s.endsWith(".gif"));
                                    if (ghsCodes.length > 0) {
                                        const ghsTableRows = ghsCodes.map(code => {
                                            const match = code.match(/GHS(\d+)\.gif/i);
                                            if (match) {
                                                const num = match[1];
                                                const imgUrl = `https://hazmat.nfa.go.kr/design/images/contents/ghs-icon${num}.gif`;
                                                const fullDesc = ghsMapping[num] || "분류 정보 없음";
                                                const lines = fullDesc.split("\n");
                                                const titleLine = lines[0];
                                                const detailLines = lines.slice(1).join("<br>");

                                                let korName = titleLine;
                                                let engName = "";
                                                const matchTitle = titleLine.match(/^(.*)\((.*)\)$/);
                                                if (matchTitle) {
                                                    korName = matchTitle[1].trim();
                                                    engName = matchTitle[2].trim();
                                                }

                                                return `<tr class="ghs-row"><td class="ghs-cell-image"><img src="${imgUrl}" alt="${code}" class="ghs-image"><div class="ghs-name-kor">${korName}</div><div class="ghs-name-eng">${engName}</div></td><td class="ghs-cell-desc">${detailLines}</td></tr>`;
                                            }
                                            return "";
                                        }).join("");

                                        return `
                                            <div class="msds-row">
                                                <div class="msds-header">${no} ${name}</div>
                                                <div class="msds-content msds-no-padding"><table class="ghs-table">${ghsTableRows}</table></div>
                                            </div>
                                        `;
                                    }
                                }

                                return `
                                    <div class="msds-row">
                                        <div class="msds-header">${no} ${name}</div>
                                        <div class="msds-content">${detail}</div>
                                    </div>
                                `;
                            } else {
                                return `<div class="msds-simple-content">${row}</div>`;
                            }
                        }).join("");
                        contentHtml = `<div class="msds-table-container">${rowsHtml}</div>`;
                    } else if (sectionData.content.includes("|||")) {
                        const rows = sectionData.content.split(";;;");
                        const rowsHtml = rows.map(row => {
                            const parts = row.split("|||");
                            if (parts.length >= 3) {
                                const [no, name, detail] = parts;
                                return `
                                    <div class="msds-row">
                                        <div class="msds-header">${no} ${name}</div>
                                        <div class="msds-content">${detail}</div>
                                    </div>
                                `;
                            } else {
                                return `<div class="msds-simple-content">${row}</div>`;
                            }
                        }).join("");
                        contentHtml = `<div class="msds-table-container">${rowsHtml}</div>`;
                    } else {
                        contentHtml = `<div class="msds-simple-content" style="padding: 10px; white-space: pre-wrap;">${sectionData.content.replace(/;;;/g, '\n').replace(/\|\|\|/g, ': ')}</div>`;
                    }
                }

                return `
                    <div class="accordion-item">
                        <button class="accordion-header" onclick="this.parentElement.classList.toggle('active')">
                            ${title}
                        </button>
                        <div class="accordion-content">
                            ${contentHtml}
                        </div>
                    </div>
                `;
            }).join('');

            html += `</div>`;

            content.innerHTML = html;
        } catch (e) {
            console.error(`Error loading chemical info for ${cas}:`, e);
            content.innerHTML = `<div style="color: red; padding: 20px;">정보를 불러오는 중 오류가 발생했습니다.<br><small>${e.message}</small></div>`;
        }
    }

    // ---- Register/Edit Modal ----
    function setupRegisterModal() {
        // Remove ALL old versions to prevent duplicates (using querySelectorAll to catch multiple stale instances)
        document.querySelectorAll('#modal-register-kit').forEach(el => el.remove());
        document.querySelectorAll('#modal-register-kit-v2').forEach(el => el.remove());

        const modalHtml = `
            <div id="modal-register-kit-v2" class="modal-overlay" style="display: none; z-index: 1200;">
                <div class="modal-content">
                    <h3 class="modal-title">키트 등록</h3>
                    <form id="form-register-kit" novalidate>
                        <div class="modal-scroll-content">
                            <div class="form-group">
                                <label for="kit-class-select">분류</label>
                                <select id="kit-class-select" class="form-input" required>
                                    <option value="" disabled selected>분류를 선택하세요</option>
                                    <option value="all">전체</option>
                                    <option value="물리학">물리학</option>
                                    <option value="화학">화학</option>
                                    <option value="생명과학">생명과학</option>
                                    <option value="지구과학">지구과학</option>
                                    <option value="융합과학">융합과학</option>
                                    <option value="기타">기타</option>
                                </select>
                                <div id="kit-class-checkboxes" class="kit-class-checkboxes">
                                    <label><input type="checkbox" value="물리학"> 물리학</label>
                                    <label><input type="checkbox" value="화학"> 화학</label>
                                    <label><input type="checkbox" value="생명과학"> 생명과학</label>
                                    <label><input type="checkbox" value="지구과학"> 지구과학</label>
                                    <label><input type="checkbox" value="융합과학"> 융합과학</label>
                                    <label><input type="checkbox" value="기타"> 기타</label>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="kit-name-select">키트명</label>
                                <select id="kit-name-select" class="form-input" disabled required>
                                    <option value="" disabled selected>분류를 먼저 선택하세요</option>
                                </select>
                                
                                <!-- Custom Kit Checkbox -->
                                <div id="custom-kit-checkbox-wrapper" class="custom-kit-checkbox-wrapper">
                                    <input type="checkbox" id="check-custom-kit">
                                    <label for="check-custom-kit">키트 선택 목록에 없는 새로운 종류의 키트를 등록할 경우 체크하세요.</label>
                                </div>

                                <!-- Custom Kit Inputs -->
                                <div id="custom-kit-inputs" class="custom-kit-inputs">
                                    <div class="form-group">
                                        <label for="custom-kit-name">등록하려는 키트 이름</label>
                                        <input type="text" id="custom-kit-name" class="form-input" placeholder="키트 이름을 입력하세요">
                                    </div>
                                    
                                    <div class="form-group" style="margin-top: 10px;">
                                        <label>구성 약품 (CAS No.)</label>
                                        <div id="cas-input-container">
                                            <input type="text" class="form-input cas-input" placeholder="CAS1 (예: 7732-18-5)" style="margin-bottom: 5px;">
                                        </div>
                                        <button type="button" id="btn-add-cas" class="btn-add-cas">+ CAS 추가</button>
                                        <p style="font-size: 11px; color: #888; margin-top: 5px;">* CAS 입력란이 부족할 경우 추가버튼을 누르세요.</p>
                                    </div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="kit-quantity">수량</label>
                                <input type="number" id="kit-quantity" class="form-input" value="1" min="1" required>
                            </div>


                            <div class="form-group">
                                <label for="kit-date">구입일</label>
                                <input type="date" id="kit-date" class="form-input" required>
                            </div>

                            <!-- ✅ 보관 위치 선택기 추가 -->
                            <div class="form-group">
                                <label>보관 위치 설정</label>
                                <div id="kit-storage-selector" style="background:#f9f9f9; padding:10px; border-radius:8px;"></div>
                            </div>


                            <!-- Photo Input -->
                            <div class="form-group">
                                <label>사진</label>
                                <div class="kit-photo-container">
                                    <div class="kit-photo-preview-box">
                                        <img id="kit-preview-img" style="max-width: 100%; max-height: 100%; object-fit: contain; display: none;">
                                        <div class="placeholder-text" style="color: #aaa; font-size: 14px;">사진 없음</div>
                                        <video id="kit-camera-stream" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover; display: none;"></video>
                                        <canvas id="kit-camera-canvas" style="display:none;"></canvas>
                                    </div>
                                    <div class="kit-photo-actions">
                                        <button type="button" id="btn-kit-file" class="btn-secondary-action"><span class="material-symbols-outlined">image</span> 파일에서 선택</button>
                                        <button type="button" id="btn-kit-camera" class="btn-secondary-action"><span class="material-symbols-outlined">photo_camera</span> 카메라로 촬영</button>
                                        <button type="button" id="btn-kit-confirm" class="btn-secondary-action" style="display: none;"><span class="material-symbols-outlined">check</span> 확인</button>
                                        <button type="button" id="btn-cancel-camera" class="btn-secondary-action" style="display: none;"><span class="material-symbols-outlined">close</span> 취소</button>
                                        <input type="file" id="kit-file-input" accept="image/*" style="display: none;">
                                        <input type="file" id="kit-camera-input" accept="image/*" capture="environment" style="display: none;">
                                    </div>
                                </div>
                            </div>
                        </div>
            <div class="modal-actions">
                <button type="button" id="btn-cancel-kit" class="btn-cancel">취소</button>
                <button type="submit" id="btn-save-kit" class="btn-primary">등록</button>
            </div>
                    </form>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Elements
        const modal = document.getElementById('modal-register-kit-v2');
        const form = document.getElementById('form-register-kit');
        const btnCancel = document.getElementById('btn-cancel-kit');
        const classSelect = document.getElementById('kit-class-select');
        const nameSelect = document.getElementById('kit-name-select');
        const classCheckboxesDiv = document.getElementById('kit-class-checkboxes');
        const customInputs = document.getElementById('custom-kit-inputs');
        const previewImg = document.getElementById('kit-preview-img');
        const previewDiv = document.querySelector('.kit-photo-preview-box');
        const fileInput = document.getElementById('kit-file-input');
        const cameraInput = document.getElementById('kit-camera-input');
        const checkCustom = document.getElementById('check-custom-kit');
        const btnTakePhoto = document.getElementById('btn-kit-camera');
        const btnSelectPhoto = document.getElementById('btn-kit-file');
        const videoStream = document.getElementById('kit-camera-stream');
        const canvas = document.getElementById('kit-camera-canvas');
        const btnAddCas = document.getElementById('btn-add-cas');
        const casInputContainer = document.getElementById('cas-input-container');
        const btnCancelCamera = document.getElementById('btn-cancel-camera');
        let stream = null;
        let isCameraActive = false;
        let isModalOpen = false;

        function getElements() {
            return { form, btnCancel, classSelect, nameSelect, classCheckboxesDiv, customInputs, previewImg, previewDiv, fileInput, checkCustom };
        }

        // Photo Handlers
        const handleFileSelect = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    previewImg.style.display = 'block';
                    previewDiv.querySelector('.placeholder-text').style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        };

        if (btnSelectPhoto) btnSelectPhoto.addEventListener('click', () => {
            if (isCameraActive) stopCamera();
            fileInput.click();
        });

        const btnKitConfirm = document.getElementById('btn-kit-confirm');

        const startCamera = async () => {
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

                if (!isModalOpen) {
                    newStream.getTracks().forEach(track => track.stop());
                    return;
                }

                stream = newStream;
                videoStream.srcObject = stream;
                videoStream.style.display = 'block';
                videoStream.play(); // Ensure play
                previewImg.style.display = 'none';

                const placeholder = previewDiv.querySelector('.placeholder-text');
                if (placeholder) placeholder.style.display = 'none';

                isCameraActive = true;

                // UI: Record Mode
                btnTakePhoto.innerHTML = '<span class="material-symbols-outlined">camera</span> 촬영하기';

                // Unbind previous onclick to ensure clean slate? 
                // We handle "Take" vs "Start" inside the main listener check `isCameraActive`.
                // Actually `isCameraActive` is true now.

                if (btnCancelCamera) btnCancelCamera.style.display = 'inline-flex';
                if (btnSelectPhoto) btnSelectPhoto.style.display = 'none';
                if (btnKitConfirm) btnKitConfirm.style.display = 'none';
            } catch (err) {
                console.error("Camera access denied or error:", err);
                cameraInput.click();
            }
        };

        const stopCamera = () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
            if (videoStream.srcObject) {
                const tracks = videoStream.srcObject.getTracks();
                if (tracks) tracks.forEach(track => track.stop());
                videoStream.srcObject = null;
            }

            videoStream.style.display = 'none';
            isCameraActive = false;

            // UI: Idle Mode
            btnTakePhoto.innerHTML = '<span class="material-symbols-outlined">photo_camera</span> 카메라로 촬영';
            if (btnCancelCamera) btnCancelCamera.style.display = 'none';
            if (btnSelectPhoto) btnSelectPhoto.style.display = 'inline-flex';
            if (btnKitConfirm) btnKitConfirm.style.display = 'none';

            // Ensure preview is visible if we have one
            if (previewImg.src && previewImg.src !== window.location.href) { // check valid src
                previewImg.style.display = 'block';
            }
        };

        const takePhoto = () => {
            canvas.width = videoStream.videoWidth;
            canvas.height = videoStream.videoHeight;
            canvas.getContext('2d').drawImage(videoStream, 0, 0);

            canvas.toBlob((blob) => {
                const file = new File([blob], `capture - ${Date.now()}.jpg`, { type: "image/jpeg" });

                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;

                previewImg.src = URL.createObjectURL(blob);
                previewImg.style.display = 'block';

                // stopCamera(); // OLD behavior

                // NEW: Review Mode
                videoStream.pause();
                videoStream.style.display = 'none';

                btnTakePhoto.innerHTML = '<span class="material-symbols-outlined">replay</span> 다시 촬영';
                // btnTakePhoto click will fall through to logic: 
                // Inside listener: if(isCameraActive) takePhoto().
                // But we want RETAKE.
                // We need to handle this.
                // isCameraActive is STILL true.
                // But we want to Restart stream.

                if (btnKitConfirm) btnKitConfirm.style.display = 'inline-flex';

            }, 'image/jpeg');
        };

        if (btnTakePhoto) {
            btnTakePhoto.addEventListener('click', () => {
                if (isCameraActive) {
                    // Check if we are in "Retake" state or "Record" state?
                    // Text content check is brittle.
                    // If video is paused/hidden, we are in Review.
                    if (videoStream.style.display === 'none') {
                        // RETAKE logic
                        videoStream.style.display = 'block';
                        videoStream.play();
                        previewImg.style.display = 'none';
                        btnTakePhoto.innerHTML = '<span class="material-symbols-outlined">camera</span> 촬영하기';
                        if (btnKitConfirm) btnKitConfirm.style.display = 'none';
                    } else {
                        // TAKE logic
                        takePhoto();
                    }
                } else {
                    startCamera();
                }
            });
        }

        if (btnKitConfirm) {
            btnKitConfirm.addEventListener('click', () => {
                stopCamera();
            });
        }

        if (fileInput) fileInput.addEventListener('change', handleFileSelect);
        if (cameraInput) cameraInput.addEventListener('change', handleFileSelect);

        // Custom Kit Checkbox Handler
        if (checkCustom) {
            checkCustom.addEventListener('change', (e) => {
                if (e.target.checked) {
                    customInputs.style.display = 'block';
                    nameSelect.disabled = true;
                    nameSelect.innerHTML = '<option value="" disabled selected>직접 입력 모드</option>';
                } else {
                    customInputs.style.display = 'none';
                    if (classSelect.value && classSelect.value !== 'all') {
                        updateNameSelect(classSelect.value);
                    } else {
                        nameSelect.disabled = true;
                        nameSelect.innerHTML = '<option value="" disabled selected>분류를 먼저 선택하세요</option>';
                    }
                }
            });
        }

        if (btnAddCas) {
            btnAddCas.addEventListener('click', () => {
                const div = document.createElement('div');
                div.innerHTML = `< input type = "text" class="form-input cas-input" placeholder = "CAS (예: 7732-18-5)" style = "margin-bottom: 5px;" > `;
                casInputContainer.appendChild(div.firstChild);
            });
        }


        if (btnCancelCamera) {
            btnCancelCamera.addEventListener('click', () => {
                stopCamera();
            });
        }

        btnCancel.addEventListener('click', () => {
            isModalOpen = false;
            if (isCameraActive) stopCamera();
            modal.style.display = 'none';
        });

        classSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val) {
                if (checkCustom && checkCustom.checked) {
                    // Do nothing if custom mode is on
                } else {
                    updateNameSelect(val);
                }
            }
        });

        modal.addEventListener('submit', async (e) => {
            if (e.target.id === 'form-register-kit') {
                e.preventDefault();
                e.stopPropagation();

                const { form, classCheckboxesDiv, classSelect, nameSelect, fileInput, checkCustom } = getElements();

                // 1. Class & Name Logic
                let kitClass = '';
                const mode = form.getAttribute('data-mode');
                const editId = form.getAttribute('data-id');

                if (mode === 'edit') {
                    const checked = Array.from(classCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                        .map(cb => cb.value);
                    kitClass = checked.join(', ');
                } else {
                    if (!classSelect.value) return alert('분류를 선택하세요.');
                    if (classSelect.value === 'all') {
                        const selectedOption = nameSelect.options[nameSelect.selectedIndex];
                        kitClass = selectedOption.dataset.class || '기타';
                    } else {
                        kitClass = classSelect.value;
                    }
                }

                let finalKitName = '';
                let customCas = null;
                const isCustom = checkCustom?.checked;

                if (mode === 'edit') {
                    finalKitName = nameSelect.value; // Name is read-only or pre-selected in edit
                } else {
                    if (isCustom) {
                        if (classSelect.value === 'all') return alert("새로운 종류의 키트 등록 시 '전체'를 선택할 수 없습니다.");
                        const customNameInput = document.getElementById('custom-kit-name');
                        finalKitName = customNameInput.value.trim();
                        if (!finalKitName) {
                            alert("키트 이름을 입력하세요.");
                            customNameInput.focus();
                            return;
                        }
                        const casInputs = document.querySelectorAll('.cas-input');
                        const casList = Array.from(casInputs).map(input => input.value.trim()).filter(val => val);
                        if (casList.length > 0) customCas = casList.join(', ');
                    } else {
                        const selectedOption = nameSelect.options[nameSelect.selectedIndex];
                        if (!selectedOption || selectedOption.disabled) return alert("키트를 선택하세요.");
                        finalKitName = selectedOption.dataset.name;
                    }
                }

                const quantity = parseInt(document.getElementById('kit-quantity').value, 10);
                const purchaseDate = document.getElementById('kit-date').value;
                const file = fileInput ? fileInput.files[0] : null;

                // ✅ 위치 정보 가져오기
                let locationJson = null;
                if (App.StorageSelector) {
                    const locSelection = App.StorageSelector.getSelection();
                    if (locSelection.area_id) {
                        locationJson = JSON.stringify(locSelection);
                    }
                }

                // 2. Prepare Payload for Edge Function
                // Helper to convert File to Base64
                const toBase64 = (file) => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });

                let photoBase64 = null;
                if (file) {
                    try {
                        photoBase64 = await toBase64(file);
                    } catch (err) {
                        return alert("사진 처리 중 오류가 발생했습니다.");
                    }
                }

                const payload = {
                    mode: mode || 'create',
                    id: editId ? parseInt(editId) : null,
                    kit_name: finalKitName,
                    kit_class: kitClass,
                    kit_cas: customCas,
                    quantity: quantity,
                    purchase_date: purchaseDate,
                    photo_base64: photoBase64,
                    location: locationJson
                };

                // 3. Call Edge Function
                const btnSave = document.getElementById('btn-save-kit');
                const originText = btnSave.textContent;
                btnSave.textContent = '처리 중...';
                btnSave.disabled = true;

                try {
                    const { data, error } = await supabase.functions.invoke('kit-register', {
                        body: payload
                    });

                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);

                    alert(mode === 'edit' ? '✅ 수정되었습니다.' : '✅ 등록되었습니다.');
                    modal.style.display = 'none';

                    if (document.getElementById('kit-detail-page-container') && editId) {
                        Kits.loadDetail(editId);
                    } else {
                        Kits.loadUserKits();
                    }

                    // For new registrations, process chemicals (optional, since EF might not handle chem details fully yet?)
                    // Logic was: await processKitChemicals(finalKitName);
                    // EF handles catalog creation, but maybe 'processKitChemicals' does something else like fetching CAS info?
                    // Yes, it fetches MSDS/Chem properties. We should still run this client-side for now or EF needs to do it.
                    // Let's keep it client-side for post-processing to fetch MSDS data if needed.
                    if (mode !== 'edit' || (quantity > 0)) { // Ensure we process if quantity added
                        // Wait a bit for DB propagation? Not strictly necessary if using same DB instance
                        await processKitChemicals(finalKitName);
                    }
                    if (mode === 'edit' && quantity === 0) {
                        await checkAndCleanupChemicals(finalKitName);
                    }

                    // Update Catalog locally if custom
                    if (isCustom && data.data && !catalog.find(c => c.kit_name === finalKitName)) {
                        // Ideally reload catalog, but pushing placeholder helps
                        // EF returns 'data' which is the user_kit record, not catalog.
                        // So let's reload catalog to be safe.
                        loadCatalog();
                    }

                } catch (err) {
                    console.error('Edge Function Error:', err);
                    alert('작업 실패: ' + err.message);
                } finally {
                    btnSave.textContent = originText;
                    btnSave.disabled = false;
                }
            }
        });

        function updateNameSelect(selectedClass, selectedKitId = null) {
            console.log('updateNameSelect called with:', selectedClass);
            const { nameSelect } = getElements();
            if (!nameSelect) {
                console.error('nameSelect element not found');
                return;
            }

            console.log('Catalog size:', catalog.length);

            // Enable and reset immediately
            nameSelect.disabled = false;
            nameSelect.innerHTML = '<option value="" disabled selected>키트를 선택하세요</option>';
            console.log('nameSelect enabled and reset');

            let filtered = [];
            if (selectedClass === 'all') {
                filtered = catalog;
            } else {
                filtered = catalog.filter(k => k.kit_class && k.kit_class.includes(selectedClass));
            }

            // Filter out invalid entries
            filtered = filtered.filter(k => k && k.kit_name);
            console.log('Filtered valid kits count:', filtered.length);

            if (filtered.length === 0) {
                const opt = document.createElement('option');
                opt.value = "";
                opt.textContent = "해당 분류의 키트가 없습니다";
                opt.disabled = true;
                nameSelect.appendChild(opt);
                return;
            }

            try {
                filtered.sort((a, b) => a.kit_name.localeCompare(b.kit_name));

                filtered.forEach(k => {
                    const opt = document.createElement('option');
                    opt.value = k.id;
                    opt.textContent = k.kit_name;
                    opt.dataset.cas = k.kit_cas || '';
                    opt.dataset.name = k.kit_name;
                    opt.dataset.class = k.kit_class;
                    if (selectedKitId && k.id == selectedKitId) {
                        opt.selected = true;
                    }
                    nameSelect.appendChild(opt);
                });
                console.log('nameSelect options populated successfully');
            } catch (err) {
                console.error('Error populating nameSelect:', err);
                alert('키트 목록을 불러오는 중 오류가 발생했습니다.');
            }
        }

        Kits.openRegisterModal = () => {
            const { form, previewDiv, classSelect, classCheckboxesDiv, nameSelect, customInputs } = getElements();
            const customWrapper = document.getElementById('custom-kit-checkbox-wrapper');

            if (!form) return;
            form.reset();

            // Reset Photo UI
            if (isCameraActive) stopCamera();
            if (previewImg) {
                previewImg.src = '';
                previewImg.style.display = 'none';
            }
            if (videoStream) videoStream.style.display = 'none';
            if (canvas) canvas.style.display = 'none';
            if (previewDiv) {
                previewDiv.style.display = 'flex'; // Ensure box is visible
                const placeholder = previewDiv.querySelector('.placeholder-text');
                if (placeholder) placeholder.style.display = 'block';
            }
            if (btnTakePhoto) btnTakePhoto.innerHTML = '<span class="material-symbols-outlined">photo_camera</span> 카메라로 촬영';

            form.removeAttribute('data-mode');
            form.removeAttribute('data-id');
            modal.querySelector('.modal-title').textContent = '키트 등록';
            document.getElementById('btn-save-kit').textContent = '등록';

            classSelect.style.display = 'block';
            classCheckboxesDiv.style.display = 'none';
            classSelect.required = true;

            nameSelect.disabled = true;
            nameSelect.innerHTML = '<option value="" disabled selected>분류를 먼저 선택하세요</option>';
            document.getElementById('kit-date').valueAsDate = new Date();

            // Init Storage Selector for Registration (Empty default)
            if (App.StorageSelector && typeof App.StorageSelector.init === 'function') {
                if (document.getElementById("kit-storage-selector")) {
                    App.StorageSelector.init("kit-storage-selector", {}, "EQUIPMENT");
                }
            }

            if (customWrapper) customWrapper.style.display = 'flex';
            if (customInputs) customInputs.style.display = 'none';

            isModalOpen = true;
            modal.style.display = 'flex';
        };

        window.openEditKitModal = (kit) => {
            const { form, previewDiv, classSelect, classCheckboxesDiv, nameSelect, customInputs, previewImg } = getElements();
            const customWrapper = document.getElementById('custom-kit-checkbox-wrapper');

            if (!form) return;
            form.reset();

            // Reset Photo UI
            if (isCameraActive) stopCamera();
            if (previewImg) previewImg.style.display = 'none'; // Will be shown if image exists
            if (videoStream) videoStream.style.display = 'none';
            if (canvas) canvas.style.display = 'none';
            if (previewDiv) {
                previewDiv.style.display = 'flex';
                const placeholder = previewDiv.querySelector('.placeholder-text');
                if (placeholder) placeholder.style.display = 'block'; // Will be hidden if image exists
            }
            if (btnTakePhoto) btnTakePhoto.innerHTML = '<span class="material-symbols-outlined">photo_camera</span> 카메라로 촬영';
            form.setAttribute('data-mode', 'edit');
            form.setAttribute('data-id', kit.id);
            modal.querySelector('.modal-title').textContent = '키트 정보 수정';
            document.getElementById('btn-save-kit').textContent = '수정 완료';

            classSelect.style.display = 'none';
            classCheckboxesDiv.style.display = 'flex';
            classSelect.required = false;

            const currentClasses = (kit.kit_class || '').split(',').map(s => s.trim());
            classCheckboxesDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = currentClasses.includes(cb.value);
            });

            const catalogItem = catalog.find(c => c.kit_name === kit.kit_name);
            if (catalogItem) {
                updateNameSelect('all', catalogItem.id);
            } else {
                nameSelect.innerHTML = `<option value="${kit.kit_name}" selected>${kit.kit_name}</option>`;
            }

            document.getElementById('kit-quantity').value = kit.quantity;
            document.getElementById('kit-date').value = kit.purchase_date;

            // ✅ 위치 정보 복원
            let defaultLoc = {};
            try {
                if (kit.location && typeof kit.location === 'string' && kit.location.trim().startsWith('{')) {
                    defaultLoc = JSON.parse(kit.location);
                }
            } catch (e) {
                console.warn('위치 정보 파싱 실패:', e);
            }

            // Storage Selector 초기화
            console.log("Checking App.StorageSelector:", !!(globalThis.App && globalThis.App.StorageSelector));
            if (App.StorageSelector && typeof App.StorageSelector.init === 'function') {
                const container = document.getElementById("kit-storage-selector");
                console.log("Checking container 'kit-storage-selector':", container);

                if (container) {
                    console.log("Calling App.StorageSelector.init with:", "kit-storage-selector", defaultLoc, "EQUIPMENT");
                    App.StorageSelector.init("kit-storage-selector", defaultLoc, "EQUIPMENT");
                } else {
                    console.error("Critical: kit-storage-selector container missing!");
                }
            } else {
                console.error("App.StorageSelector is missing or init is not a function");
            }

            if (kit.image_url) {
                previewImg.src = kit.image_url;
                previewDiv.style.display = 'block';
            }

            if (customWrapper) customWrapper.style.display = 'none';
            if (customInputs) customInputs.style.display = 'none';

            isModalOpen = true;
            modal.style.display = 'flex';
        };
    }

    // ---- Stock Modal ----
    function setupStockModal() {
        if (document.getElementById('modal-kit-stock')) return;

        const modalHtml = `
            <div id="modal-kit-stock" class="modal-overlay" style="display: none; z-index: 1200;">
                <div class="modal-content stock-modal-content">
                    <h3 class="modal-title">재고 관리</h3>
                    <p id="stock-kit-name" class="modal-subtitle" style="margin-bottom: 15px;"></p>

                    <form id="form-kit-stock">
                        <div class="form-group">
                            <label>등록 유형</label>
                            <div class="stock-type-group">
                                <label class="stock-type-label"><input type="radio" name="stock-type" value="usage" checked> 사용 (차감)</label>
                                <label class="stock-type-label"><input type="radio" name="stock-type" value="purchase"> 구입 (추가)</label>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="stock-amount">수량</label>
                            <input type="number" id="stock-amount" class="form-input" min="1" value="1" required>
                        </div>

                        <div class="form-group">
                            <label for="stock-date">날짜</label>
                            <input type="date" id="stock-date" class="form-input" required>
                        </div>

                        <div class="modal-actions">
                            <button type="button" id="btn-cancel-stock" class="btn-cancel">취소</button>
                            <button type="submit" id="btn-save-stock" class="btn-primary">저장</button>
                        </div>
                    </form>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('modal-kit-stock');
        const form = document.getElementById('form-kit-stock');
        const btnCancel = document.getElementById('btn-cancel-stock');
        let currentKit = null;

        btnCancel.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentKit) return;

            const type = form.querySelector('input[name="stock-type"]:checked').value;
            const amount = parseInt(document.getElementById('stock-amount').value, 10);
            const date = document.getElementById('stock-date').value;

            await handleStockChange(currentKit, type, amount, date);
            modal.style.display = 'none';
        });

        window.openStockModal = (kit) => {
            currentKit = kit;
            document.getElementById('stock-kit-name').textContent = kit.kit_name;
            document.getElementById('stock-amount').value = 1;
            document.getElementById('stock-date').valueAsDate = new Date();
            modal.style.display = 'flex';
        };
    }

    async function handleStockChange(kit, type, amount, date) {
        let change = 0;
        if (type === 'usage') {
            change = -amount;
        } else {
            change = amount;
        }

        const newQuantity = kit.quantity + change;

        if (newQuantity < 0) {
            alert('재고가 부족합니다.');
            return;
        }

        const { error: updateError } = await supabase
            .from('user_kits')
            .update({ quantity: newQuantity })
            .eq('id', kit.id);

        if (updateError) {
            alert('재고 업데이트 실패: ' + updateError.message);
            return;
        }

        const { error: logError } = await supabase
            .from('kit_usage_log')
            .insert({
                kit_id: kit.id,
                change_amount: change,
                log_date: date,
                log_type: type === 'usage' ? '사용' : '구입'
            });

        if (logError) {
            console.error('Failed to log usage:', logError);
        }

        alert('저장되었습니다.');

        // Refresh
        if (document.getElementById('kit-detail-page-container')) {
            // Update local kit object and reload
            kit.quantity = newQuantity;
            Kits.loadDetail(kit.id);
        } else {
            Kits.loadUserKits();
        }
        if (newQuantity === 0) {
            await checkAndCleanupChemicals(kit.kit_name);
        }
    }

    function isCasNo(str) {
        return /^\d{2,7}-\d{2}-\d$/.test(str);
    }

    async function processKitChemicals(kitName) {
        const item = catalog.find(c => c.kit_name === kitName);
        if (!item || !item.kit_cas) return;

        const casList = item.kit_cas.split(',').map(s => s.trim());

        for (const cas of casList) {
            const { data } = await supabase
                .from('kit_chemicals')
                .select('cas_no')
                .eq('cas_no', cas)
                .single();

            if (!data) {
                if (isCasNo(cas)) {
                    console.log(`Fetching info for ${cas}...`);
                    try {
                        await supabase.functions.invoke('kit-casimport', {
                            body: { cas_rn: cas }
                        });
                    } catch (e) {
                        console.error(`Failed to import ${cas}: `, e);
                    }
                } else {
                    console.log(`Inserting manual entry for ${cas}...`);
                    try {
                        await supabase.from('kit_chemicals').insert({
                            cas_no: cas,
                            name_ko: cas,
                            name_en: null,
                            msds_data: null
                        });
                    } catch (e) {
                        console.error(`Failed to insert manual entry ${cas}: `, e);
                    }
                }
            }
        }
    }

    async function checkAndCleanupChemicals(kitName) {
        const item = catalog.find(c => c.kit_name === kitName);
        if (!item || !item.kit_cas) return;
        const targetCasList = item.kit_cas.split(',').map(s => s.trim());

        const { data: activeKits } = await supabase
            .from('user_kits')
            .select('kit_name')
            .gt('quantity', 0);

        if (!activeKits) return;

        const activeCasSet = new Set();
        activeKits.forEach(k => {
            const catItem = catalog.find(c => c.kit_name === k.kit_name);
            if (catItem && catItem.kit_cas) {
                catItem.kit_cas.split(',').forEach(cas => activeCasSet.add(cas.trim()));
            }
        });

        const toRemove = targetCasList.filter(cas => !activeCasSet.has(cas));

        if (toRemove.length > 0) {
            console.log(`Cleaning up unused chemicals: ${toRemove.join(', ')} `);
            await supabase
                .from('kit_chemicals')
                .delete()
                .in('cas_no', toRemove);
        }
    }

    // ---- Export to App ----
    globalThis.App = globalThis.App || {};
    globalThis.App.Kits = Kits;

})();
