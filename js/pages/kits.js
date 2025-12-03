(function () {
    const supabase = globalThis.App?.supabase || window.supabaseClient;

    // State
    let catalog = []; // Full list from experiment_kit table

    async function init() {
        console.log("📦 Kit Page Initialized");

        // 1. Setup Sync Button (Moved to Data Sync Page)
        // const syncBtn = document.getElementById('btn-sync-kits');

        // 2. Setup FAB
        // 2. Setup FAB
        if (App.Fab) {
            // setVisibility(visible, text, onClickAction)
            App.Fab.setVisibility(true, '<span class="material-symbols-outlined">add</span> 새 키트 등록', () => {
                openRegisterModal();
            });
        }

        // 3. Load Data
        await loadCatalog();
        await loadUserKits();

        // 4. Setup Modals
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

        const { data, error } = await supabase
            .from('user_kits')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            listContainer.innerHTML = `<p class="error">로드 실패: ${error.message}</p>`;
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
        data.forEach(kit => {
            const card = document.createElement('div');
            card.className = 'inventory-card'; // Use inventory-card style
            card.dataset.id = kit.id;

            // Image block (placeholder for kits)
            const imageBlock = `
                <div class="inventory-card__image inventory-card__image--empty">
                    <span class="material-symbols-outlined" style="font-size: 24px; color: #ccc;">science</span>
                </div>`;

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
                         <button class="icon-btn edit-kit-btn" data-id="${kit.id}" style="border:none; background:none; cursor:pointer; padding:4px;">
                            <span class="material-symbols-outlined" style="font-size: 20px; color: #00a0b2;">edit</span>
                        </button>
                        <button class="icon-btn delete-kit-btn" data-id="${kit.id}" style="border:none; background:none; cursor:pointer; padding:4px;">
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
    let isEditMode = false;
    let editKitId = null;

    function setupRegisterModal() {
        const modal = document.getElementById('modal-register-kit');
        const form = document.getElementById('form-register-kit');
        const btnCancel = document.getElementById('btn-cancel-kit');
        const classSelect = document.getElementById('kit-class-select');
        const nameSelect = document.getElementById('kit-name-select');
        const dateInput = document.getElementById('kit-date');
        const submitBtn = form.querySelector('button[type="submit"]');
        const modalTitle = modal.querySelector('h3');

        // Set default date to today
        if (dateInput) dateInput.valueAsDate = new Date();

        // Class Change -> Filter Names
        classSelect.addEventListener('change', (e) => {
            const selectedClass = e.target.value;
            updateNameSelect(selectedClass);
        });

        function updateNameSelect(selectedClass, selectedKitId = null) {
            nameSelect.innerHTML = '<option value="" disabled selected>키트를 선택하세요</option>';
            nameSelect.disabled = false;

            // Filter catalog: kit_class contains selectedClass
            const filtered = catalog.filter(k => k.kit_class && k.kit_class.includes(selectedClass));

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

        // Cancel
        btnCancel.addEventListener('click', () => {
            modal.style.display = 'none';
            form.reset();
            isEditMode = false;
            editKitId = null;
        });

        // Submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const selectedOption = nameSelect.options[nameSelect.selectedIndex];
            const kitId = selectedOption.value;
            const kitName = selectedOption.dataset.name;
            const kitClass = selectedOption.dataset.class; // Use original class from catalog
            const kitCas = selectedOption.dataset.cas;
            const quantity = document.getElementById('kit-quantity').value;
            const date = document.getElementById('kit-date').value;

            try {
                if (isEditMode && editKitId) {
                    // Update
                    const { error } = await supabase.from('user_kits').update({
                        kit_id: kitId,
                        kit_name: kitName,
                        kit_class: kitClass,
                        quantity: quantity,
                        purchase_date: date
                    }).eq('id', editKitId);

                    if (error) throw error;
                    alert('키트 정보가 수정되었습니다.');
                } else {
                    // Insert
                    const { error } = await supabase.from('user_kits').insert({
                        kit_id: kitId,
                        kit_name: kitName,
                        kit_class: kitClass,
                        quantity: quantity,
                        purchase_date: date
                    });

                    if (error) throw error;

                    // Process Chemicals (Background) only on new insert or if needed
                    if (kitCas) {
                        processKitChemicals(kitCas);
                    }
                    alert('키트가 등록되었습니다.');
                }

                modal.style.display = 'none';
                form.reset();
                isEditMode = false;
                editKitId = null;
                loadUserKits(); // Refresh list

            } catch (err) {
                alert('저장 실패: ' + err.message);
            }
        });

        // Expose open function for Edit
        window.openEditKitModal = (kit) => {
            isEditMode = true;
            editKitId = kit.id;
            modalTitle.textContent = '키트 정보 수정';
            submitBtn.textContent = '수정 완료';

            modal.style.display = 'flex';

            // Fill form
            document.getElementById('kit-quantity').value = kit.quantity;
            document.getElementById('kit-date').value = kit.purchase_date;

            // Set Class
            // Split class if multiple? Assuming single for now or primary
            // The catalog has comma separated classes maybe? 
            // Let's try to match one.
            const cls = kit.kit_class.split(',')[0].trim();
            classSelect.value = cls;

            // Update Name Select based on class and select the kit
            updateNameSelect(cls, kit.kit_id);
        };
    }

    function openRegisterModal() {
        const modal = document.getElementById('modal-register-kit');
        const modalTitle = modal.querySelector('h3');
        const submitBtn = document.querySelector('#form-register-kit button[type="submit"]');

        isEditMode = false;
        editKitId = null;
        modalTitle.textContent = '새 키트 등록';
        submitBtn.textContent = '등록';

        document.getElementById('form-register-kit').reset();
        document.getElementById('kit-date').valueAsDate = new Date();

        modal.style.display = 'flex';
    }

    // ---- Helpers ----
    function isCasNo(str) {
        // Simple CAS regex: digits-digits-digit
        return /^\d{1,7}-\d{2}-\d$/.test(str);
    }

    // ---- Chemical Processing ----
    async function processKitChemicals(casString) {
        // casString: "64-17-5, 7758-99-8" (already cleaned by sync)
        const casList = casString.split(',').map(c => c.trim()).filter(c => c);

        console.log('Processing chemicals:', casList);

        for (const cas of casList) {
            // Check if exists in kit_chemicals
            const { data } = await supabase
                .from('kit_chemicals')
                .select('id')
                .eq('cas_no', cas)
                .maybeSingle();

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

    // ---- Detail Modal ----
    function setupDetailModals() {
        // Kit Detail Close
        document.getElementById('btn-close-detail').addEventListener('click', () => {
            document.getElementById('modal-kit-detail').style.display = 'none';
        });

        // Chem Info Close
        document.getElementById('btn-close-chem').addEventListener('click', () => {
            document.getElementById('modal-chem-info').style.display = 'none';
        });
    }

    async function openKitDetail(userKit) {
        const modal = document.getElementById('modal-kit-detail');
        document.getElementById('detail-kit-name').textContent = userKit.kit_name;
        document.getElementById('detail-kit-info').textContent =
            `분류: ${userKit.kit_class} | 수량: ${userKit.quantity} | 구입일: ${userKit.purchase_date}`;

        const chemListDiv = document.getElementById('kit-chemical-list');
        chemListDiv.innerHTML = '로딩 중...';

        // Get CAS from catalog (via join or separate query)
        // Since user_kits has kit_id, we can fetch from experiment_kit
        const { data: catalogKit } = await supabase
            .from('experiment_kit')
            .select('kit_cas')
            .eq('id', userKit.kit_id)
            .single();

        chemListDiv.innerHTML = '';

        if (catalogKit && catalogKit.kit_cas) {
            const casList = catalogKit.kit_cas.split(',').map(c => c.trim()).filter(c => c);

            if (casList.length === 0) {
                chemListDiv.innerHTML = '<p>등록된 약품 정보가 없습니다.</p>';
            } else {
                for (const cas of casList) {
                    if (isCasNo(cas)) {
                        const btn = document.createElement('button');
                        btn.className = 'chem-chip';
                        btn.textContent = cas; // Show CAS initially
                        btn.dataset.cas = cas; // Mark as CAS for enhancement
                        btn.addEventListener('click', () => openChemInfo(cas));
                        chemListDiv.appendChild(btn);
                    } else {
                        const span = document.createElement('span');
                        span.className = 'chem-chip static'; // Add static class for styling if needed
                        span.style.cursor = 'default';
                        span.style.backgroundColor = '#f0f0f0';
                        span.style.color = '#333';
                        span.textContent = cas;
                        chemListDiv.appendChild(span);
                    }
                }

                // Enhance chips with names (only for CAS items)
                enhanceChemChips(casList.filter(c => isCasNo(c)));
            }
        } else {
            chemListDiv.innerHTML = '<p>등록된 약품 정보가 없습니다.</p>';
        }

        modal.style.display = 'flex';
    }

    async function enhanceChemChips(casList) {
        if (casList.length === 0) return;

        const { data } = await supabase
            .from('kit_chemicals')
            .select('cas_no, name_ko, name_en')
            .in('cas_no', casList);

        if (data) {
            const map = new Map(data.map(d => [d.cas_no, d.name_ko || d.name_en]));
            const chips = document.querySelectorAll('.chem-chip[data-cas]'); // Only target CAS chips
            chips.forEach(chip => {
                const cas = chip.dataset.cas;
                if (map.has(cas)) {
                    chip.textContent = `${map.get(cas)} (${cas})`;
                }
            });
        }
    }

    async function openChemInfo(cas) {
        const modal = document.getElementById('modal-chem-info');
        const body = document.getElementById('chem-info-body');
        const title = document.getElementById('chem-info-title');

        title.textContent = `약품 정보 (${cas})`;
        body.innerHTML = '로딩 중...';
        modal.style.display = 'flex';

        const { data, error } = await supabase
            .from('kit_chemicals')
            .select('*')
            .eq('cas_no', cas)
            .maybeSingle();

        if (error || !data) {
            body.innerHTML = '<p>상세 정보가 없습니다. (동기화가 필요할 수 있습니다)</p>';
            return;
        }

        // Render Info
        let msdsHtml = '';
        if (data.msds_data && Array.isArray(data.msds_data)) {
            msdsHtml = '<div class="msds-accordion">';
            data.msds_data.forEach(section => {
                // Parse content: no|||name|||detail
                const parts = section.content.split('|||');
                const title = parts[1] || `항목 ${section.section_number}`;
                const content = parts[2] || section.content;

                msdsHtml += `
                    <details>
                        <summary>${section.section_number}. ${title}</summary>
                        <div class="msds-content">${content.replace(/\n/g, '<br>')}</div>
                    </details>
                `;
            });
            msdsHtml += '</div>';
        }

        body.innerHTML = `
            <div class="chem-detail-grid">
                <p><strong>국문명:</strong> ${data.name_ko || '-'}</p>
                <p><strong>영문명:</strong> ${data.name_en || '-'}</p>
                <p><strong>화학식:</strong> ${data.formula || '-'}</p>
                <p><strong>분자량:</strong> ${data.molecular_weight || '-'}</p>
            </div>
            <hr>
            <h4>MSDS 정보</h4>
            ${msdsHtml}
        `;
    }

    // Expose init
    globalThis.App = globalThis.App || {};
    globalThis.App.Kits = { init };

})();
