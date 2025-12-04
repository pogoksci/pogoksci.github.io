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
                    currentSearch = e.target.value.trim().toLowerCase();
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
                filteredData = data.filter(kit =>
                    kit.kit_name.toLowerCase().includes(currentSearch) ||
                    (kit.kit_class && kit.kit_class.toLowerCase().includes(currentSearch))
                );
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
                    <div class="inventory-card__body">
                        <div class="inventory-card__left">
                            <div class="inventory-card__line1">
                                <span class="kit-tag" style="background:#e3f2fd; color:#0d47a1; padding:2px 6px; border-radius:4px; font-size:12px;">${kit.kit_class || '미분류'}</span>
                            </div>
                            <div class="inventory-card__line2" style="display: flex; justify-content: space-between; align-items: center;">
                                <div class="name-kor">${kit.kit_name}</div>
                                <div class="kit-quantity" style="font-size: 14px; color: #555; font-weight: normal;">수량: ${kit.quantity}개</div>
                            </div>
                            <div class="inventory-card__line3" style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                                <div class="kit-location" style="font-size: 13px; color: #777;"></div>
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
                        <span class="value" id="detail-kit-location">(지정되지 않음)</span>
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
            .select('cas_no, name_ko')
            .in('cas_no', casList);

        const map = new Map();
        if (chemData) chemData.forEach(c => map.set(c.cas_no, c.name_ko));

        // Create buttons
        const buttons = casList.map(cas => {
            const btn = document.createElement('div'); // Use div for better control, styled as btn
            btn.className = 'kit-component-btn';
            btn.textContent = map.has(cas) ? map.get(cas) : cas;
            btn.title = cas;
            btn.onclick = () => renderInlineChemInfo(cas);
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

    async function renderInlineChemInfo(cas) {
        const container = document.getElementById('kit-chem-detail-container');
        const title = document.getElementById('kit-chem-detail-title');
        const content = document.getElementById('kit-chem-detail-content');

        if (!container || !title || !content) return;

        container.style.display = 'block';
        title.textContent = `${cas} 상세 정보 로딩 중...`;
        content.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">데이터를 불러오는 중입니다...</div>';

        try {
            const { data: substance, error } = await supabase
                .from('Substance')
                .select(`
                    id, substance_name, cas_rn, molecular_formula, molecular_mass, chem_name_kor,
                    Properties ( name, property ),
                    MSDS ( section_number, content )
                `)
                .eq('cas_rn', cas)
                .single();

            if (error || !substance) {
                throw new Error('물질 정보를 찾을 수 없습니다.');
            }

            const korName = substance.chem_name_kor || substance.substance_name || cas;
            title.textContent = `${korName} (${cas})`;

            const propsList = substance.Properties || [];
            const getPropVal = (nameKey) => {
                const found = propsList.find((p) => p.name && p.name.toLowerCase().includes(nameKey.toLowerCase()));
                return found ? found.property : '-';
            };

            let html = `
                <div style="margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
                    <h5 style="margin: 0 0 10px 0; font-size: 15px; color: #333;">기본 특성</h5>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; font-size: 14px;">
                        <div><strong>화학식:</strong> ${substance.molecular_formula || '-'}</div>
                        <div><strong>분자량:</strong> ${substance.molecular_mass || '-'}</div>
                        <div><strong>끓는점:</strong> ${getPropVal('Boiling Point')}</div>
                        <div><strong>녹는점:</strong> ${getPropVal('Melting Point')}</div>
                        <div><strong>밀도:</strong> ${getPropVal('Density')}</div>
                    </div>
                </div>
            `;

            html += `<h5 style="margin: 0 0 10px 0; font-size: 15px; color: #333;">MSDS 정보</h5>`;
            html += `<div class="msds-accordion" id="inline-msds-accordion">`;

            const msdsData = substance.MSDS || [];

            html += msdsTitles.map((title, index) => {
                const sectionNum = index + 1;
                const sectionData = msdsData.find(d => d.section_number === sectionNum);
                let contentHtml = '<p class="text-gray-500 italic p-4">내용 없음</p>';

                if (sectionData && sectionData.content) {
                    if (sectionNum === 2 && sectionData.content.includes("|||그림문자|||")) {
                        contentHtml = '<div style="padding: 10px;">GHS 그림문자 정보가 있습니다 (상세 보기 권장)</div>';
                    } else {
                        contentHtml = `<div class="msds-simple-content" style="padding: 10px; white-space: pre-wrap;">${sectionData.content.replace(/;;;/g, '\n').replace(/\|\|\|/g, ': ')}</div>`;
                    }
                }

                return `
                    <div class="accordion-item" style="border: 1px solid #eee; border-bottom: none;">
                        <button class="accordion-header" onclick="this.parentElement.classList.toggle('active')" style="width: 100%; text-align: left; padding: 10px; background: #fff; border: none; cursor: pointer; font-weight: 500; display: flex; justify-content: space-between;">
                            ${title} <span style="font-size: 12px;">▼</span>
                        </button>
                        <div class="accordion-content" style="display: none; border-top: 1px solid #eee; padding: 10px; background: #fafafa;">
                            ${contentHtml}
                        </div>
                    </div>
                `;
            }).join('');

            html += `</div>`;
            html += `
                <style>
                    .accordion-item.active .accordion-content { display: block !important; }
                    .accordion-item:last-child { border-bottom: 1px solid #eee; }
                </style>
            `;

            content.innerHTML = html;
        } catch (e) {
            console.error(e);
            content.innerHTML = '<div style="color: red; padding: 20px;">정보를 불러오는 중 오류가 발생했습니다.</div>';
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
                    <div id="kit-class-checkboxes" style="display: none; flex-wrap: wrap; gap: 10px; margin-top: 5px;">
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
                    <div id="custom-kit-checkbox-wrapper" style="margin-top: 8px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666;">
                        <input type="checkbox" id="check-custom-kit">
                        <label for="check-custom-kit">키트 선택 목록에 없는 새로운 종류의 키트를 등록할 경우 체크하세요.</label>
                    </div>

                    <!-- Custom Kit Inputs -->
                    <div id="custom-kit-inputs" style="display: none; margin-top: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px; border: 1px solid #eee;">
                        <div class="form-group">
                            <label for="custom-kit-name">등록하려는 키트 이름</label>
                            <input type="text" id="custom-kit-name" class="form-input" placeholder="키트 이름을 입력하세요">
                        </div>
                        
                        <div class="form-group" style="margin-top: 10px;">
                            <label>구성 약품 (CAS No.)</label>
                            <div id="cas-input-container">
                                <input type="text" class="form-input cas-input" placeholder="CAS1 (예: 7732-18-5)" style="margin-bottom: 5px;">
                            </div>
                            <button type="button" id="btn-add-cas" style="margin-top: 5px; font-size: 12px; padding: 4px 8px; background: #eee; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">+ CAS 추가</button>
                            <p style="font-size: 11px; color: #888; margin-top: 5px;">* CAS 입력란이 부족할 경우 추가버튼을 누르세요.</p>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="kit-quantity">수량</label>
                    <input type="number" id="kit-quantity" class="form-input" value="1" min="1" required>
                </div>
                <div class="form-group">
                    <label for="kit-date">등록일(구입일)</label>
                    <input type="date" id="kit-date" class="form-input" required>
                </div>
                <div class="form-group">
                    <label for="kit-photo">키트 사진</label>
                    <input type="file" id="kit-photo" class="form-input" accept="image/*">
                    <div id="kit-photo-preview" style="margin-top: 10px; text-align: center; display: none;">
                        <img id="preview-img" src="" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 1px solid #ddd;">
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

        // Select Modal Container for Delegation
        const modal = document.getElementById('modal-register-kit-v2');

        // Helper to get elements dynamically
        const getElements = () => ({
            form: document.getElementById('form-register-kit'),
            classSelect: document.getElementById('kit-class-select'),
            classCheckboxesDiv: document.getElementById('kit-class-checkboxes'),
            nameSelect: document.getElementById('kit-name-select'),
            fileInput: document.getElementById('kit-photo'),
            previewDiv: document.getElementById('kit-photo-preview'),
            previewImg: document.getElementById('preview-img'),
            checkCustom: document.getElementById('check-custom-kit'),
            customInputs: document.getElementById('custom-kit-inputs'),
            btnAddCas: document.getElementById('btn-add-cas'),
            casContainer: document.getElementById('cas-input-container')
        });

        // Event Delegation on Modal
        modal.addEventListener('click', (e) => {
            // Cancel Button
            if (e.target.id === 'btn-cancel-kit' || e.target.closest('#btn-cancel-kit')) {
                console.log('Delegated Cancel Click');
                e.preventDefault();
                e.stopPropagation();
                modal.style.display = 'none';
                const { form, previewDiv } = getElements();
                if (form) {
                    form.reset();
                    form.removeAttribute('data-mode');
                    form.removeAttribute('data-id');
                }
                if (previewDiv) previewDiv.style.display = 'none';
                document.querySelector('.modal-title').textContent = '키트 등록';
                document.getElementById('btn-save-kit').textContent = '등록';
            }

            // Add CAS Button
            if (e.target.id === 'btn-add-cas' || e.target.closest('#btn-add-cas')) {
                const { casContainer } = getElements();
                const count = casContainer.querySelectorAll('.cas-input').length + 1;
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'form-input cas-input';
                input.placeholder = `CAS${count}`;
                input.style.marginBottom = '5px';
                casContainer.appendChild(input);
            }
        });

        modal.addEventListener('change', (e) => {
            console.log('Modal Change Event:', e.target.id, e.target.value);
            const { checkCustom, customInputs, nameSelect, classSelect, fileInput, previewImg, previewDiv } = getElements();

            // Custom Kit Checkbox
            if (e.target.id === 'check-custom-kit') {
                console.log('Custom Kit Checkbox Changed:', e.target.checked);
                const isCustom = e.target.checked;
                customInputs.style.display = isCustom ? 'block' : 'none';
                nameSelect.disabled = isCustom;
                if (isCustom) nameSelect.value = "";
            }

            // Class Select
            if (e.target.id === 'kit-class-select') {
                console.log('Class Select Changed:', e.target.value);
                updateNameSelect(e.target.value);
            }

            // File Input
            if (e.target.id === 'kit-photo') {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        previewImg.src = ev.target.result;
                        previewDiv.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                } else {
                    previewDiv.style.display = 'none';
                }
            }
        });

        modal.addEventListener('submit', async (e) => {
            if (e.target.id === 'form-register-kit') {
                console.log('Delegated Form Submit');
                e.preventDefault();
                e.stopPropagation();

                const { form, classCheckboxesDiv, classSelect, nameSelect, fileInput, checkCustom } = getElements();

                let kitClass = '';
                const mode = form.getAttribute('data-mode');
                const editId = form.getAttribute('data-id');

                if (mode === 'edit') {
                    const checked = Array.from(classCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                        .map(cb => cb.value);
                    kitClass = checked.join(', ');
                } else {
                    if (!classSelect.value) {
                        alert('분류를 선택하세요.');
                        return;
                    }
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
                    finalKitName = nameSelect.value;
                } else {
                    if (isCustom) {
                        if (classSelect.value === 'all') {
                            alert("새로운 종류의 키트 등록 시 '전체'를 선택할 수 없습니다.");
                            return;
                        }
                        const customNameInput = document.getElementById('custom-kit-name');
                        finalKitName = customNameInput.value.trim();
                        if (!finalKitName) {
                            alert("등록하려는 키트 이름을 입력하세요.");
                            customNameInput.focus();
                            return;
                        }
                        const exists = catalog.find(k => k.kit_name === finalKitName);
                        if (exists) {
                            alert("이미 존재하는 키트 이름입니다. 목록에서 선택해주세요.");
                            return;
                        }
                        const casInputs = document.querySelectorAll('.cas-input');
                        const casList = Array.from(casInputs).map(input => input.value.trim()).filter(val => val);
                        if (casList.length > 0) customCas = casList.join(', ');

                        const { data: newCatalogKit, error: catalogError } = await supabase
                            .from('experiment_kit')
                            .insert([{
                                kit_name: finalKitName,
                                kit_class: kitClass,
                                kit_cas: customCas
                            }])
                            .select()
                            .single();

                        if (catalogError) {
                            alert('키트 카탈로그 등록 실패: ' + catalogError.message);
                            return;
                        }
                        catalog.push(newCatalogKit);
                    } else {
                        const selectedOption = nameSelect.options[nameSelect.selectedIndex];
                        if (!selectedOption || selectedOption.disabled) {
                            alert("키트를 선택하세요.");
                            return;
                        }
                        finalKitName = selectedOption.dataset.name;
                    }
                }

                const quantity = parseInt(document.getElementById('kit-quantity').value, 10);
                const purchaseDate = document.getElementById('kit-date').value;
                const file = fileInput ? fileInput.files[0] : null;

                let imageUrl = null;
                if (file) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}.${fileExt}`;
                    const filePath = `${fileName}`;
                    const { error: uploadError } = await supabase.storage.from('kit-photos').upload(filePath, file);
                    if (uploadError) {
                        alert('사진 업로드 실패: ' + uploadError.message);
                        return;
                    }
                    const { data: publicUrlData } = supabase.storage.from('kit-photos').getPublicUrl(filePath);
                    imageUrl = publicUrlData.publicUrl;
                }

                if (mode === 'edit' && editId) {
                    const updatePayload = {
                        kit_class: kitClass,
                        kit_name: finalKitName,
                        quantity: quantity,
                        purchase_date: purchaseDate
                    };
                    if (imageUrl) updatePayload.image_url = imageUrl;

                    const { error } = await supabase.from('user_kits').update(updatePayload).eq('id', editId);
                    if (error) alert('수정 실패: ' + error.message);
                    else {
                        alert('수정되었습니다.');
                        modal.style.display = 'none';
                        if (document.getElementById('kit-detail-page-container')) Kits.loadDetail(editId);
                        else Kits.loadUserKits();
                        if (quantity === 0) await checkAndCleanupChemicals(finalKitName);
                    }
                } else {
                    const { error } = await supabase.from('user_kits').insert({
                        kit_class: kitClass,
                        kit_name: finalKitName,
                        quantity: quantity,
                        purchase_date: purchaseDate,
                        image_url: imageUrl
                    });
                    if (error) alert('등록 실패: ' + error.message);
                    else {
                        alert('등록되었습니다.');
                        modal.style.display = 'none';
                        Kits.loadUserKits();
                        await processKitChemicals(finalKitName);
                    }
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
            nameSelect.style.border = '2px solid red'; // Visual Debugging
            nameSelect.innerHTML = '<option value="" disabled selected>키트를 선택하세요</option>';
            console.log('nameSelect enabled and reset. Border set to red.');

            const allSelects = document.querySelectorAll('#kit-name-select');
            console.log('Total #kit-name-select elements in DOM:', allSelects.length);
            allSelects.forEach((el, idx) => {
                console.log(`Select #${idx}: visible=${el.offsetParent !== null}, disabled=${el.disabled}`);
            });

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
            if (previewDiv) previewDiv.style.display = 'none';
            form.removeAttribute('data-mode');
            form.removeAttribute('data-id');
            document.querySelector('.modal-title').textContent = '키트 등록';
            document.getElementById('btn-save-kit').textContent = '등록';

            classSelect.style.display = 'block';
            classCheckboxesDiv.style.display = 'none';
            classSelect.required = true;

            nameSelect.disabled = true;
            nameSelect.innerHTML = '<option value="" disabled selected>분류를 먼저 선택하세요</option>';
            document.getElementById('kit-date').valueAsDate = new Date();

            if (customWrapper) customWrapper.style.display = 'flex';
            if (customInputs) customInputs.style.display = 'none';

            modal.style.display = 'flex';
        };

        window.openEditKitModal = (kit) => {
            const { form, previewDiv, classSelect, classCheckboxesDiv, nameSelect, customInputs, previewImg } = getElements();
            const customWrapper = document.getElementById('custom-kit-checkbox-wrapper');

            if (!form) return;
            form.reset();
            if (previewDiv) previewDiv.style.display = 'none';
            form.setAttribute('data-mode', 'edit');
            form.setAttribute('data-id', kit.id);
            document.querySelector('.modal-title').textContent = '키트 정보 수정';
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

            if (kit.image_url) {
                previewImg.src = kit.image_url;
                previewDiv.style.display = 'block';
            }

            if (customWrapper) customWrapper.style.display = 'none';
            if (customInputs) customInputs.style.display = 'none';

            modal.style.display = 'flex';
        };
    }

    // ---- Stock Modal ----
    function setupStockModal() {
        if (document.getElementById('modal-kit-stock')) return;

        const modalHtml = `
            <div id="modal-kit-stock" class="modal-overlay" style="display: none; z-index: 1200;">
                <div class="modal-content" style="max-width: 400px; width: 90%;">
                    <h3 class="modal-title">재고 관리</h3>
                    <p id="stock-kit-name" class="modal-subtitle" style="margin-bottom: 15px;"></p>

                    <form id="form-kit-stock">
                        <div class="form-group">
                            <label>등록 유형</label>
                            <div style="display: flex; gap: 20px; margin-top: 5px; width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; background-color: #fff; justify-content: center;">
                                <label style="cursor: pointer;"><input type="radio" name="stock-type" value="usage" checked> 사용 (차감)</label>
                                <label style="cursor: pointer;"><input type="radio" name="stock-type" value="purchase"> 구입 (추가)</label>
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
