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
            App.SortDropdown.init('kit-sort-dropdown', (value) => {
                currentSort = value;
                loadUserKits();
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

        listContainer.innerHTML = '<p>로딩 중...</p>';

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
                    <div class="inventory-card__image inventory-card__image--empty">
                        <span class="material-symbols-outlined" style="font-size: 24px; color: #ccc;">science</span>
                    </div>`;
            }

            card.innerHTML = `
                ${imageBlock}
                <div class="inventory-card__body">
                    <div class="inventory-card__left">
                        <div class="inventory-card__line1">
                            <span class="kit-tag" style="background:#e3f2fd; color:#0d47a1; padding:2px 6px; border-radius:4px; font-size:12px;">${kit.kit_class || '미분류'}</span>
                        </div>
                        <div class="inventory-card__line2 name-kor">${kit.kit_name}</div>
                        <div class="inventory-card__line3 name-eng">수량: ${kit.quantity}개</div>
                        <div class="inventory-card__line4 inventory-card__location">구입일: ${kit.purchase_date || '-'}</div>
                    </div>
                    <div class="inventory-card__meta" style="flex-direction: row; gap: 5px; align-items: center;">
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
            `;

            // Click on card body to open detail (exclude buttons)
            card.querySelector('.inventory-card__body').addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                openKitDetail(kit);
            });

            // Stock Button
            card.querySelector('.stock-kit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                setupStockModal(); // Ensure modal exists
                openStockModal(kit);
            });

            // Edit Button
            card.querySelector('.edit-kit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.openEditKitModal) {
                    window.openEditKitModal(kit);
                }
            });

            // Delete Button
            card.querySelector('.delete-kit-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('정말 삭제하시겠습니까?')) {
                    await deleteKit(kit.id);
                }
            });

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
                const fileName = `${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

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
                nameSelect.innerHTML = `<option value="${kit.kit_name}" selected>${kit.kit_name}</option>`;
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

        btnCloseDetail.addEventListener('click', () => {
            modalDetail.style.display = 'none';
        });

        // Chem Info
        const modalChem = document.getElementById('modal-chem-info');
        const btnCloseChem = document.getElementById('btn-close-chem');

        btnCloseChem.addEventListener('click', () => {
            modalChem.style.display = 'none';
        });

        window.openKitDetail = async (kit) => {
            document.getElementById('detail-kit-name').textContent = kit.kit_name;
            document.getElementById('detail-kit-info').textContent = `분류: ${kit.kit_class} | 수량: ${kit.quantity}`;

            const chemListDiv = document.getElementById('kit-chemical-list');
            chemListDiv.innerHTML = '<p>로딩 중...</p>';
            modalDetail.style.display = 'flex';

            // Fetch chemicals from kit_chemicals table
            // We need to find chemicals linked to this kit.
            // But wait, kit_chemicals is a flat list of chemicals used in kits, keyed by cas_no?
            // No, the previous logic was:
            // 1. Get kit_cas from catalog (experiment_kit)
            // 2. Split by ','
            // 3. Show chips.
            // But we also have `kit_chemicals` table which stores detailed info.
            // Let's look at how we did it before.
            // Ah, we need to look up the kit in the catalog to get the CAS list.
            const catalogItem = catalog.find(c => c.kit_name === kit.kit_name);
            if (!catalogItem || !catalogItem.kit_cas) {
                chemListDiv.innerHTML = '<p>등록된 약품 정보가 없습니다.</p>';
                return;
            }

            const casList = catalogItem.kit_cas.split(',').map(s => s.trim());
            chemListDiv.innerHTML = '';

            // Create chips
            // We also want to show Korean names if available in kit_chemicals
            // So we should fetch from kit_chemicals where cas_no in casList
            const { data: chemData } = await supabase
                .from('kit_chemicals')
                .select('cas_no, name_ko')
                .in('cas_no', casList);

            const map = new Map();
            if (chemData) {
                chemData.forEach(c => map.set(c.cas_no, c.name_ko));
            }

            casList.forEach(cas => {
                if (isCasNo(cas)) {
                    const btn = document.createElement('button');
                    btn.className = 'chem-chip';
                    btn.textContent = map.has(cas) ? `${map.get(cas)} (${cas})` : cas;
                    btn.dataset.cas = cas;
                    btn.addEventListener('click', () => openChemInfo(cas));
                    chemListDiv.appendChild(btn);
                } else {
                    const span = document.createElement('span');
                    span.className = 'chem-chip static';
                    span.style.cursor = 'default';
                    span.style.backgroundColor = '#f0f0f0';
                    span.style.color = '#333';
                    span.textContent = cas;
                    chemListDiv.appendChild(span);
                }
            });
        };

        window.openChemInfo = async (cas) => {
            const modalChem = document.getElementById('modal-chem-info');
            const title = document.getElementById('chem-info-title');
            const body = document.getElementById('chem-info-body');

            title.textContent = `약품 정보 (${cas})`;
            body.innerHTML = '<p>로딩 중...</p>';
            modalChem.style.display = 'flex';

            const { data, error } = await supabase
                .from('kit_chemicals')
                .select('*')
                .eq('cas_no', cas)
                .single();

            if (error || !data) {
                body.innerHTML = '<p>정보를 불러올 수 없습니다.</p>';
                return;
            }

            // Render MSDS Data
            // data.msds_data is JSON
            const msds = data.msds_data || {};

            let html = `<div style="text-align:left;">`;
            html += `<p><strong>국문명:</strong> ${data.name_ko || '-'}</p>`;
            html += `<p><strong>영문명:</strong> ${data.name_en || '-'}</p>`;
            html += `<hr>`;

            // Simple render of MSDS sections
            for (const [key, val] of Object.entries(msds)) {
                html += `<p><strong>${key}:</strong> ${val}</p>`;
            }
            html += `</div>`;

            body.innerHTML = html;
        };
    }

    // ---- Stock Modal ----
    function setupStockModal() {
        // Check if modal exists, if not create it
        if (document.getElementById('modal-kit-stock')) return;

        const modalHtml = `
        <div id="modal-kit-stock" class="modal-overlay" style="display: none; z-index: 1200;">
            <div class="modal-content" style="max-width: 350px;">
                <h3 class="modal-title">재고 관리</h3>
                <p id="stock-kit-name" class="modal-subtitle" style="margin-bottom: 15px;"></p>
                
                <form id="form-kit-stock">
                    <div class="form-group">
                        <label>작업 유형</label>
                        <div style="display: flex; gap: 10px; margin-top: 5px;">
                            <label><input type="radio" name="stock-type" value="usage" checked> 사용 (차감)</label>
                            <label><input type="radio" name="stock-type" value="purchase"> 구입 (추가)</label>
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
                        console.error(`Failed to import ${cas}:`, e);
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
                        console.error(`Failed to insert manual entry ${cas}:`, e);
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
            console.log(`Cleaning up unused chemicals: ${toRemove.join(', ')}`);
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
