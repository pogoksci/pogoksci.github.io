(function () {
    const supabase = globalThis.App?.supabase || window.supabaseClient;

    // State
    let catalog = []; // Full list from experiment_kit table
    let currentSort = 'name_class';
    let currentSearch = '';

    async function init() {
        console.log("📦 Kit Page Initialized");

        // 1. Setup FAB
        if (App.Fab) {
            App.Fab.setVisibility(true, '<span class="material-symbols-outlined">add</span> 새 키트 등록', () => {
                openRegisterModal();
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
                    loadUserKits();
                }
            });
        }

        // 3. Setup Search
        const searchInput = document.getElementById('kit-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearch = e.target.value.trim().toLowerCase();
                loadUserKits();
            });
        }

        // 4. Setup Refresh
        const refreshBtn = document.getElementById('kit-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                loadUserKits();
            });
        }

        // 5. Load Data
        await loadCatalog();
        await loadUserKits();

        // 6. Setup Modals
        setupRegisterModal();
        setupDetailModals();
    }

    // ---- Data Loading ----
    async function loadCatalog() {
        const { data, error } = await supabase
            .from('experiment_kit')
            .select('*')
            .order('kit_name');

        if (error) {
            console.error('Failed to load catalog:', error);
            return;
        }
        catalog = data;
    }

    async function loadUserKits() {
        const listContainer = document.getElementById('kit-list');
        if (!listContainer) return;



        let query = supabase
            .from('user_kits')
            .select('*');

        // Apply Sort
        if (currentSort === 'name_class') {
            query = query.order('kit_class', { ascending: true }).order('kit_name', { ascending: true });
        } else if (currentSort === 'name_all') {
            query = query.order('kit_name', { ascending: true });
        } else if (currentSort === 'location') {
            // Placeholder for location sort - currently sorting by ID as fallback
            query = query.order('id', { ascending: true });
        } else {
            // Default fallback
            query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query;

        if (error) {
            listContainer.innerHTML = `<p class="error">로드 실패: ${error.message}</p>`;
            return;
        }

        // Apply Search (Client-side for simplicity as kit_name is text)
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

        if (!data || data.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined" style="font-size:48px; color:#ccc;">inventory_2</span>
                    <p>등록된 키트가 없습니다.</p>
                </div>`;
            return;
        }

        listContainer.innerHTML = '';
        filteredData.forEach(kit => {
            const card = document.createElement('div');
            card.className = 'inventory-card'; // Use inventory-card style
            card.dataset.id = kit.id;

            // Image block
            let imageBlock = '';
            if (kit.image_url) {
                imageBlock = `
                    <div class="inventory-card__image">
                        <img src="${kit.image_url}" alt="${kit.kit_name}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>`;
            } else {
                imageBlock = `
                    <div class="inventory-card__image" style="background-color: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px;">
                        사진 없음
                    </div>`;
            }

            card.innerHTML = `
                ${imageBlock}
                <div class="inventory-card__body" style="padding: 10px;">
                    <div class="inventory-card__content" style="flex: 1; height: 100px; display: flex; flex-direction: column; justify-content: space-between;">
                        <!-- Line 1: Classification -->
                        <div class="inventory-card__line1">
                            <span class="kit-tag" style="background:#e3f2fd; color:#0d47a1; padding:2px 6px; border-radius:4px; font-size:12px;">${kit.kit_class || '미분류'}</span>
                        </div>
                        
                        <!-- Line 2: Name & Quantity -->
                        <div class="inventory-card__line2" style="display: flex; justify-content: space-between; align-items: center;">
                            <div class="name-kor" style="font-weight: bold; font-size: 16px;">${kit.kit_name}</div>
                            <div class="kit-quantity" style="font-size: 14px; color: #555;">수량: ${kit.quantity}개</div>
                        </div>

                        <!-- Line 3: Location (Future) & Buttons -->
                        <div class="inventory-card__line3" style="display: flex; justify-content: space-between; align-items: center;">
                            <div class="kit-location" style="font-size: 13px; color: #777;">
                                <!-- Location placeholder -->
                            </div>
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

            // Card Click -> Detail
            card.addEventListener('click', () => {
                if (window.openKitDetail) {
                    window.openKitDetail(kit);
                }
            });

            // Stock Button
            const stockBtn = card.querySelector('.stock-kit-btn');
            if (stockBtn) {
                stockBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setupStockModal(); // Ensure modal exists
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
    }

    async function deleteKit(id) {
        try {
            const { error } = await supabase.from('user_kits').delete().eq('id', id);
            if (error) throw error;
            loadUserKits();
        } catch (e) {
            alert('삭제 실패: ' + e.message);
        }
    }

    // ---- Register/Edit Modal ----
    function setupRegisterModal() {
        const modal = document.getElementById('modal-register-kit');
        const form = document.getElementById('form-register-kit');
        const btnCancel = document.getElementById('btn-cancel-kit');
        const classSelect = document.getElementById('kit-class-select');
        const classCheckboxesDiv = document.getElementById('kit-class-checkboxes');
        const nameSelect = document.getElementById('kit-name-select');
        const fileInput = document.getElementById('kit-photo');
        const previewDiv = document.getElementById('kit-photo-preview');
        const previewImg = document.getElementById('preview-img');

        // File Preview
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        previewImg.src = e.target.result;
                        previewDiv.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                } else {
                    previewDiv.style.display = 'none';
                }
            });
        }

        // Close Modal
        btnCancel.addEventListener('click', () => {
            modal.style.display = 'none';
            form.reset();
            if (previewDiv) previewDiv.style.display = 'none';
            form.removeAttribute('data-mode');
            form.removeAttribute('data-id');
            document.querySelector('.modal-title').textContent = '키트 등록';
            document.getElementById('btn-save-kit').textContent = '등록';
        });

        // Class Change -> Filter Names
        classSelect.addEventListener('change', (e) => {
            const selectedClass = classSelect.value;
            updateNameSelect(selectedClass);
        });

        function updateNameSelect(selectedClass, selectedKitId = null) {
            nameSelect.innerHTML = '<option value="" disabled selected>키트를 선택하세요</option>';
            nameSelect.disabled = false;

            let filtered = [];
            if (selectedClass === 'all') {
                filtered = catalog; // Show all
            } else {
                // Filter catalog: kit_class contains selectedClass
                filtered = catalog.filter(k => k.kit_class && k.kit_class.includes(selectedClass));
            }

            // Sort alphabetically for better UX when showing all
            filtered.sort((a, b) => a.kit_name.localeCompare(b.kit_name));

            filtered.forEach(k => {
                const opt = document.createElement('option');
                opt.value = k.id; // Use ID as value
                opt.textContent = k.kit_name;
                opt.dataset.cas = k.kit_cas || ''; // Store CAS for later
                opt.dataset.name = k.kit_name;
                opt.dataset.class = k.kit_class;
                if (selectedKitId && k.id == selectedKitId) {
                    opt.selected = true;
                }
                nameSelect.appendChild(opt);
            });
        }

        // Submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            let kitClass = '';
            const mode = form.getAttribute('data-mode'); // 'edit' or null
            const editId = form.getAttribute('data-id');

            if (mode === 'edit') {
                // Gather from checkboxes
                const checked = Array.from(classCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                    .map(cb => cb.value);
                kitClass = checked.join(', ');
            } else {
                // Gather from select
                if (classSelect.value === 'all') {
                    // If 'all' selected, use the class from the selected kit in catalog
                    const selectedOption = nameSelect.options[nameSelect.selectedIndex];
                    kitClass = selectedOption.dataset.class || '기타';
                } else {
                    kitClass = classSelect.value;
                }
            }

            let finalKitName = '';
            if (mode === 'edit') {
                finalKitName = nameSelect.value; // Existing logic
            } else {
                const selectedOption = nameSelect.options[nameSelect.selectedIndex];
                finalKitName = selectedOption.dataset.name;
            }

            const quantity = parseInt(document.getElementById('kit-quantity').value, 10);
            const purchaseDate = document.getElementById('kit-date').value;
            const file = fileInput ? fileInput.files[0] : null;

            // Upload Image if exists
            let imageUrl = null;
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt} `;
                const filePath = `${fileName} `;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('kit-photos')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error('Upload failed:', uploadError);
                    alert('사진 업로드 실패: ' + uploadError.message);
                    return;
                }

                const { data: publicUrlData } = supabase.storage
                    .from('kit-photos')
                    .getPublicUrl(filePath);

                imageUrl = publicUrlData.publicUrl;
            }

            if (mode === 'edit' && editId) {
                // Update
                const updatePayload = {
                    kit_class: kitClass,
                    kit_name: finalKitName,
                    quantity: quantity,
                    purchase_date: purchaseDate
                };
                if (imageUrl) {
                    updatePayload.image_url = imageUrl;
                }

                const { error } = await supabase
                    .from('user_kits')
                    .update(updatePayload)
                    .eq('id', editId);

                if (error) {
                    alert('수정 실패: ' + error.message);
                } else {
                    alert('수정되었습니다.');
                    modal.style.display = 'none';
                    loadUserKits();
                    // Check cleanup
                    if (quantity === 0) {
                        await checkAndCleanupChemicals(finalKitName);
                    }
                }
            } else {
                // Insert
                const { error } = await supabase
                    .from('user_kits')
                    .insert({
                        kit_class: kitClass,
                        kit_name: finalKitName,
                        quantity: quantity,
                        purchase_date: purchaseDate,
                        image_url: imageUrl
                    });

                if (error) {
                    alert('등록 실패: ' + error.message);
                } else {
                    alert('등록되었습니다.');
                    modal.style.display = 'none';
                    loadUserKits();
                    // Process Chemicals
                    await processKitChemicals(finalKitName);
                }
            }
        });

        // Expose open function
        window.openRegisterModal = () => {
            form.reset();
            if (previewDiv) previewDiv.style.display = 'none';
            form.removeAttribute('data-mode');
            form.removeAttribute('data-id');
            document.querySelector('.modal-title').textContent = '키트 등록';
            document.getElementById('btn-save-kit').textContent = '등록';

            // Show Select, Hide Checkboxes
            classSelect.style.display = 'block';
            classCheckboxesDiv.style.display = 'none';
            classSelect.required = true;

            nameSelect.disabled = true;
            nameSelect.innerHTML = '<option value="" disabled selected>분류를 먼저 선택하세요</option>';

            // Set default date to today
            document.getElementById('kit-date').valueAsDate = new Date();

            modal.style.display = 'flex';
        };

        window.openEditKitModal = (kit) => {
            form.reset();
            if (previewDiv) previewDiv.style.display = 'none';
            form.setAttribute('data-mode', 'edit');
            form.setAttribute('data-id', kit.id);
            document.querySelector('.modal-title').textContent = '키트 정보 수정';
            document.getElementById('btn-save-kit').textContent = '수정 완료';

            // Hide Select, Show Checkboxes
            classSelect.style.display = 'none';
            classCheckboxesDiv.style.display = 'flex';
            classSelect.required = false;

            // Populate Checkboxes
            const currentClasses = (kit.kit_class || '').split(',').map(s => s.trim());
            classCheckboxesDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = currentClasses.includes(cb.value);
            });

            // Fill Data
            const catalogItem = catalog.find(c => c.kit_name === kit.kit_name);
            if (catalogItem) {
                updateNameSelect('all', catalogItem.id);
            } else {
                nameSelect.innerHTML = `< option value = "${kit.kit_name}" selected > ${kit.kit_name}</option > `;
            }

            document.getElementById('kit-quantity').value = kit.quantity;
            document.getElementById('kit-date').value = kit.purchase_date;

            // Show existing image
            if (kit.image_url) {
                previewImg.src = kit.image_url;
                previewDiv.style.display = 'block';
            }

            modal.style.display = 'flex';
        };
    }

    // ---- Detail Modal ----
    function setupDetailModals() {
        // Kit Detail
        const modalDetail = document.getElementById('modal-kit-detail');
        const btnCloseDetail = document.getElementById('btn-close-detail');

        if (btnCloseDetail) {
            btnCloseDetail.addEventListener('click', () => {
                modalDetail.style.display = 'none';
            });
        }

        // Constants for MSDS
        const msdsTitles = [
            "1. 화학제품과 회사에 관한 정보", "2. 유해성·위험성", "3. 구성성분의 명칭 및 함유량", "4. 응급조치 요령",
            "5. 화재 시 조치방법", "6. 누출 시 조치방법", "7. 취급 및 저장방법", "8. 노출방지 및 개인보호구",
            "9. 물리화학적 특성", "10. 안정성 및 반응성", "11. 독성에 관한 정보", "12. 환경에 미치는 영향",
            "13. 폐기 시 주의사항", "14. 운송에 필요한 정보", "15. 법적 규제현황", "16. 그 밖의 참고사항"
        ];

        // Render Inline Chemical Info
        async function renderInlineChemInfo(cas) {
            const container = document.getElementById('kit-chem-detail-container');
            const title = document.getElementById('kit-chem-detail-title');
            const content = document.getElementById('kit-chem-detail-content');

            container.style.display = 'block';
            title.textContent = `${cas} 상세 정보 로딩 중...`;
            content.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">데이터를 불러오는 중입니다...</div>';

            try {
                // Fetch Substance with MSDS and Properties
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

                // Render Properties
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

                // Render MSDS Accordion
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

        window.openKitDetail = async (kit) => {
            // Populate Fields
            document.getElementById('detail-kit-name').textContent = kit.kit_name;
            document.getElementById('detail-kit-class').textContent = kit.kit_class || '-';
            document.getElementById('detail-kit-quantity').textContent = kit.quantity;
            document.getElementById('detail-kit-location').textContent = '(지정되지 않음)';

            // Photo
            const photoBox = document.getElementById('detail-kit-photo');
            if (kit.image_url) {
                photoBox.innerHTML = `<img src="${kit.image_url}" alt="키트 사진" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else {
                photoBox.innerHTML = '<span style="color: #999;">사진 없음</span>';
            }

            // Reset Chemical Container
            document.getElementById('kit-chem-detail-container').style.display = 'none';
            document.getElementById('kit-chem-detail-content').innerHTML = '';

            // 1. Fetch Chemicals
            const chemListDiv = document.getElementById('kit-chemical-list');
            chemListDiv.innerHTML = '<p>로딩 중...</p>';

            const catalogItem = catalog.find(c => c.kit_name === kit.kit_name);
            if (!catalogItem || !catalogItem.kit_cas) {
                chemListDiv.innerHTML = '<p style="color: #999; font-size: 13px;">등록된 약품 정보가 없습니다.</p>';
            } else {
                const casList = catalogItem.kit_cas.split(',').map(s => s.trim());
                chemListDiv.innerHTML = '';

                // Fetch Korean names
                const { data: chemData } = await supabase
                    .from('kit_chemicals')
                    .select('cas_no, name_ko')
                    .in('cas_no', casList);

                const map = new Map();
                if (chemData) chemData.forEach(c => map.set(c.cas_no, c.name_ko));

                casList.forEach(cas => {
                    if (isCasNo(cas)) {
                        const btn = document.createElement('div');
                        btn.className = 'chem-chip';
                        btn.style.cursor = 'pointer';
                        btn.style.padding = '4px 10px';
                        btn.style.background = '#e3f2fd';
                        btn.style.color = '#0277bd';
                        btn.style.borderRadius = '15px';
                        btn.style.fontSize = '13px';
                        btn.textContent = map.has(cas) ? `${map.get(cas)}` : cas;
                        btn.title = cas;

                        btn.addEventListener('click', () => renderInlineChemInfo(cas));
                        chemListDiv.appendChild(btn);
                    } else {
                        const span = document.createElement('div');
                        span.className = 'chem-chip static';
                        span.textContent = cas;
                        chemListDiv.appendChild(span);
                    }
                });
            }

            // 2. Fetch Usage Logs (Oldest First)
            const tbody = document.getElementById('kit-usage-logs-body');
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">기록 로딩 중...</td></tr>';

            modalDetail.style.display = 'flex';

            try {
                const { data: usageLogs, error } = await supabase
                    .from('kit_usage_log')
                    .select('*')
                    .eq('user_kit_id', kit.id)
                    .order('log_date', { ascending: true }); // Oldest first

                if (error) throw error;

                // Initial Log
                const initialLog = {
                    log_date: kit.purchase_date,
                    log_type: '구입 (초기)',
                    change_amount: null
                };

                let allLogs = [];
                if (kit.purchase_date) allLogs.push(initialLog);
                if (usageLogs) allLogs = [...allLogs, ...usageLogs];

                // Sort again just in case (Oldest first)
                allLogs.sort((a, b) => new Date(a.log_date) - new Date(b.log_date));

                if (allLogs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #999;">기록이 없습니다.</td></tr>';
                } else {
                    tbody.innerHTML = '';
                    allLogs.forEach(log => {
                        const tr = document.createElement('tr');

                        let typeText = log.log_type === 'usage' ? '사용' : (log.log_type === 'purchase' ? '구입' : log.log_type);
                        let amountText = log.change_amount ? `${log.change_amount > 0 ? '+' : ''}${log.change_amount}` : '-';
                        if (log.log_type === '구입 (초기)') {
                            typeText = '최초 등록';
                            amountText = kit.quantity;
                        }

                        tr.innerHTML = `
                            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">${log.log_date}</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: 500;">${typeText}</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${amountText}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            } catch (e) {
                console.error("Log fetch error:", e);
                tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">기록을 불러오지 못했습니다.</td></tr>';
            }
        };
    }





    // ---- Stock Modal ----
    function setupStockModal() {
        // Check if modal exists, if not create it
        if (document.getElementById('modal-kit-stock')) return;

        const modalHtml = `
            < div id = "modal-kit-stock" class="modal-overlay" style = "display: none; z-index: 1200;" >
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
            </div > `;

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
        // 1. Calculate new quantity
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

        // 2. Update user_kits
        const { error: updateError } = await supabase
            .from('user_kits')
            .update({ quantity: newQuantity })
            .eq('id', kit.id);

        if (updateError) {
            alert('재고 업데이트 실패: ' + updateError.message);
            return;
        }

        // 3. Log to kit_usage_log
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
        loadUserKits();

        // 4. Check Cleanup if quantity became 0
        if (newQuantity === 0) {
            await checkAndCleanupChemicals(kit.kit_name);
        }
    }

    // ---- Helper Functions ----
    function isCasNo(str) {
        return /^\d{2,7}-\d{2}-\d$/.test(str);
    }

    async function processKitChemicals(kitName) {
        // 1. Get CAS list from catalog
        const item = catalog.find(c => c.kit_name === kitName);
        if (!item || !item.kit_cas) return;

        const casList = item.kit_cas.split(',').map(s => s.trim());

        // 2. For each CAS, check if it exists in kit_chemicals
        // If not, fetch from Edge Function
        for (const cas of casList) {
            // Check existence
            const { data } = await supabase
                .from('kit_chemicals')
                .select('cas_no')
                .eq('cas_no', cas)
                .single();

            if (!data) {
                if (isCasNo(cas)) {
                    // Fetch and Insert via Edge Function
                    console.log(`Fetching info for ${cas}...`);
                    try {
                        await supabase.functions.invoke('kit-casimport', {
                            body: { cas_rn: cas }
                        });
                    } catch (e) {
                        console.error(`Failed to import ${cas}: `, e);
                    }
                } else {
                    // Not a CAS number (Korean Name), insert directly
                    console.log(`Inserting manual entry for ${cas}...`);
                    try {
                        await supabase.from('kit_chemicals').insert({
                            cas_no: cas, // Use name as ID
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
        // 1. Get CAS list for this kit
        const item = catalog.find(c => c.kit_name === kitName);
        if (!item || !item.kit_cas) return;
        const targetCasList = item.kit_cas.split(',').map(s => s.trim());

        // 2. Find ALL other active kits (quantity > 0)
        const { data: activeKits } = await supabase
            .from('user_kits')
            .select('kit_name')
            .gt('quantity', 0);

        if (!activeKits) return;

        // 3. Collect all CAS numbers used by other active kits
        const activeCasSet = new Set();
        activeKits.forEach(k => {
            const catItem = catalog.find(c => c.kit_name === k.kit_name);
            if (catItem && catItem.kit_cas) {
                catItem.kit_cas.split(',').forEach(cas => activeCasSet.add(cas.trim()));
            }
        });

        // 4. Identify CAS numbers to remove (in target list but NOT in active set)
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
    globalThis.App.Kits = {
        init,
        loadUserKits,
        deleteKit
    };

})();
