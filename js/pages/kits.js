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
            App.Fab.setVisibility(true, null, () => {
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
            card.className = 'kit-card';
            card.innerHTML = `
                <span class="kit-tag">${kit.kit_class || '미분류'}</span>
                <h4>${kit.kit_name}</h4>
                <p>수량: ${kit.quantity}개</p>
                <p>구입일: ${kit.purchase_date || '-'}</p>
            `;
            card.addEventListener('click', () => openKitDetail(kit));
            listContainer.appendChild(card);
        });
    }

    // ---- Register Modal ----
    function setupRegisterModal() {
        const modal = document.getElementById('modal-register-kit');
        const form = document.getElementById('form-register-kit');
        const btnCancel = document.getElementById('btn-cancel-kit');
        const classSelect = document.getElementById('kit-class-select');
        const nameSelect = document.getElementById('kit-name-select');
        const dateInput = document.getElementById('kit-date');

        // Set default date to today
        if (dateInput) dateInput.valueAsDate = new Date();

        // Class Change -> Filter Names
        classSelect.addEventListener('change', (e) => {
            const selectedClass = e.target.value;
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
                nameSelect.appendChild(opt);
            });
        });

        // Cancel
        btnCancel.addEventListener('click', () => {
            modal.style.display = 'none';
            form.reset();
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
                // 1. Insert into user_kits
                const { error } = await supabase.from('user_kits').insert({
                    kit_id: kitId,
                    kit_name: kitName,
                    kit_class: kitClass,
                    quantity: quantity,
                    purchase_date: date
                });

                if (error) throw error;

                // 2. Process Chemicals (Background)
                if (kitCas) {
                    processKitChemicals(kitCas);
                }

                alert('키트가 등록되었습니다.');
                modal.style.display = 'none';
                form.reset();
                loadUserKits(); // Refresh list

            } catch (err) {
                alert('등록 실패: ' + err.message);
            }
        });
    }

    function openRegisterModal() {
        const modal = document.getElementById('modal-register-kit');
        modal.style.display = 'flex';
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
                // Fetch and Insert via Edge Function
                console.log(`Fetching info for ${cas}...`);
                try {
                    await supabase.functions.invoke('kit-casimport', {
                        body: { cas_rn: cas }
                    });
                } catch (e) {
                    console.error(`Failed to import ${cas}:`, e);
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
                    const btn = document.createElement('button');
                    btn.className = 'chem-chip';
                    btn.textContent = cas; // Show CAS initially

                    // Fetch name for better display?
                    // We can do a bulk fetch from kit_chemicals to get names
                    btn.addEventListener('click', () => openChemInfo(cas));
                    chemListDiv.appendChild(btn);
                }

                // Enhance chips with names
                enhanceChemChips(casList);
            }
        } else {
            chemListDiv.innerHTML = '<p>등록된 약품 정보가 없습니다.</p>';
        }

        modal.style.display = 'flex';
    }

    async function enhanceChemChips(casList) {
        const { data } = await supabase
            .from('kit_chemicals')
            .select('cas_no, name_ko, name_en')
            .in('cas_no', casList);

        if (data) {
            const map = new Map(data.map(d => [d.cas_no, d.name_ko || d.name_en]));
            const chips = document.querySelectorAll('.chem-chip');
            chips.forEach(chip => {
                const cas = chip.textContent;
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
