// ================================================================
// /js/pages/teaching-tools.js — 교구/설비 및 관리 (Tools)
// ================================================================
(function () {
    console.log("🧩 App.TeachingTools 모듈 로드됨");

    let state = {
        tools: [],
        filterName: "",
        sortBy: "no_asc", // no_asc, name_asc, location
    };

    // ----------------------------------------------------------------
    // 1. 초기화 (List Page)
    // ----------------------------------------------------------------
    async function init() {
        console.log("🧩 App.TeachingTools.init() called");
        state = { tools: [], filterName: "", sortBy: "category_code", filterSection: "All" };

        bindEvents();
        setupStockModal(); // Initialize Stock Modal
        await loadList();
    }

    function bindEvents() {
        // 1) 검색
        const searchInput = document.getElementById("aid-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                state.filterName = e.target.value.trim().toLowerCase();
                renderList();
            });
        }

        // 2) 정렬
        setupSortDropdown();

        // 3) 새로고침
        const refreshBtn = document.getElementById("aid-refresh-btn");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", async () => {
                await loadList();
            });
        }

        // 4) Section Filter Buttons
        const btnAll = document.getElementById("btn-filter-all");
        const btnAid = document.getElementById("btn-filter-aid");
        const btnFact = document.getElementById("btn-filter-facility");

        if (btnAll && btnAid && btnFact) {
            btnAll.addEventListener("click", () => toggleSectionFilter("All"));
            btnAid.addEventListener("click", () => toggleSectionFilter("교구"));
            btnFact.addEventListener("click", () => toggleSectionFilter("설비"));
        }

        // 5) 등록 FAB (Go to Form Page)
        if (App.Fab) {
            App.Fab.setVisibility(true, '<span class="material-symbols-outlined">add</span> 교구/설비 등록', () => {
                App.Router.go("toolsForm");
            });
        }

        // Initialize Filter Buttons State
        updateFilterButtons();
    }

    function toggleSectionFilter(section) {
        // If clicking same button, do nothing? Or maybe toggle off (except 'All' usually stays)?
        // User requested: "All button default... aid/facility..."
        // If I click 'Aid', it selects Aid.
        // If I click 'All', it selects All.
        if (state.filterSection === section) return; // Already selected

        state.filterSection = section;

        // Special Sort Logic for 'All'
        if (section === 'All') {
            state.sortBy = 'category_code';
        } else {
            // Optional: Reset sort or keep current? 
            // "All button shows by category tools_code".
            // Aid button: user didn't specify sort. Keep current? Or default to section_code?
            // Prompt says: "Teaching Aid menu... All button default... shows category/code".
            // Does not explicitly say to change sort for Aid/Facility.
            // But 'category_code' works for them too if desired.
            // Let's just set it for All as requested.
        }

        updateFilterButtons();
        renderList();

        // Scroll to Top
        window.scrollTo(0, 0);
        const mainContent = document.getElementById('aid-list');
        if (mainContent) mainContent.scrollTop = 0;
    }

    function updateFilterButtons() {
        const btnAll = document.getElementById("btn-filter-all");
        const btnAid = document.getElementById("btn-filter-aid");
        const btnFact = document.getElementById("btn-filter-facility");
        if (!btnAll || !btnAid || !btnFact) return;

        // Reset Styles
        const defaultStyle = "flex: 1; padding: 10px; border: 1px solid #ddd; background: #fff; color: #666; font-weight: bold; cursor: pointer; transition: all 0.2s; border-radius: 6px;";
        // Active Style
        const activeStyle = "background: #e3f2fd; color: #1565c0; border-color: #2196f3;";

        btnAll.style.cssText = defaultStyle;
        btnAid.style.cssText = defaultStyle;
        btnFact.style.cssText = defaultStyle;

        if (state.filterSection === "All") {
            btnAll.style.cssText += activeStyle;
            btnAll.style.borderColor = "#2196f3";
        } else if (state.filterSection === "교구") {
            btnAid.style.cssText += activeStyle;
            btnAid.style.borderColor = "#2196f3";
        } else if (state.filterSection === "설비") {
            btnFact.style.cssText += activeStyle;
            btnFact.style.borderColor = "#2196f3";
        }
    }

    // ----------------------------------------------------------------
    // 2. 목록 로드 & 렌더링
    // ----------------------------------------------------------------
    async function loadList() {
        try {
            const supabase = App.supabase;
            if (!supabase) throw new Error("Supabase client not found");

            const container = document.getElementById("aid-list");
            if (container) {
                container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">hourglass_empty</span>
                <p>목록을 불러오는 중...</p>
            </div>`;
            }
            const { data, error } = await supabase
                .from("tools")
                .select("*")
                .order("tools_no", { ascending: true }); // Default sort by Number

            if (error) throw error;

            state.tools = data || [];
            renderList();

        } catch (err) {
            console.error("❌ loadList Error:", err);
            alert("목록을 불러오는 중 오류가 발생했습니다.");
        }
    }

    function renderList() {
        const container = document.getElementById("aid-list");
        if (!container) return;

        container.innerHTML = "";

        // Filter & Sort
        let list = state.tools.filter(item => {
            // 1. Text Search
            if (state.filterName) {
                const term = state.filterName;
                const name = (item.tools_name || "").toLowerCase();
                const code = (item.tools_code || "").toLowerCase();
                const no = String(item.tools_no || "");
                if (!(name.includes(term) || code.includes(term) || no.includes(term))) return false;
            }

            // 2. New Button Filter
            if (state.filterSection && state.filterSection !== 'All') {
                if ((item.tools_section || "").trim() !== state.filterSection) return false;
            }

            return true;
        });

        list = sortList(list, state.sortBy);

        // Group by Section (Teaching Aid vs Facility) if needed?
        // Or just list them. Let's just list them for now but maybe show section badge.

        if (list.length === 0) {
            if (state.filterName) {
                container.innerHTML = `
                <div class="empty-state">
                  <span class="material-symbols-outlined">search_off</span>
                  <p>검색 결과가 없습니다.</p>
                </div>`;
            } else {
                container.innerHTML = `
                <div class="empty-state">
                  <span class="material-symbols-outlined">school</span>
                  <p>등록된 교구/설비가 없습니다.</p>
                </div>`;
            }
            return;
        }

        const shouldGroup = (state.sortBy === 'category_name' || state.sortBy === 'section_code' || state.sortBy === 'category_code');
        let currentCategory = null;

        list.forEach(item => {
            // Header Logic
            if (shouldGroup) {
                // If section_code, verify if we group by "Section"? Or Category?
                // Existing logic: "Category"
                // If section_code: Sort by Section -> Code.
                // Group by Section makes sense if mixed.
                // But prompt: "tools_section 별로 tools_code 순서..."
                // Users usually want headers for these groups.
                // Let's Group by:
                // - category_name -> Category
                // - section_code -> Section
                // - category_code -> Category (New for "All" view)

                let cat = "";
                if (state.sortBy === 'category_name' || state.sortBy === 'category_code') cat = item.tools_category || "미분류";
                else if (state.sortBy === 'section_code') cat = item.tools_section || "기타";

                if (cat !== currentCategory) {
                    currentCategory = cat;
                    // Count items in this group (visual count)
                    // Note: Filtering logic above already filtered list.
                    // Counting logic needs to match grouping key.
                    let count = 0;
                    if (state.sortBy === 'category_name' || state.sortBy === 'category_code') {
                        count = list.filter(i => (i.tools_category || "미분류") === cat).length;
                    } else {
                        count = list.filter(i => (i.tools_section || "기타") === cat).length;
                    }

                    const wrapper = document.createElement("div");
                    wrapper.className = "section-header-wrapper";

                    const header = document.createElement("div");
                    header.className = "inventory-section-header";
                    // Styles are now handled by styles.css (including gradient border fix)

                    header.innerHTML = `
                         <span class="section-title">${cat}</span>
                         <span class="section-count">${count}</span>
                     `;
                    wrapper.appendChild(header);
                    container.appendChild(wrapper);
                }
            }

            const card = document.createElement("div");
            card.className = "inventory-card tool-card";
            // Navigate to detail on card click
            card.onclick = (e) => {
                // Prevent navigation if clicking buttons
                if (e.target.closest('button')) return;
                App.Router.go("teachingToolsDetail", { id: item.id });
            };

            const imgUrl = item.image_url;
            let imageBlock = '';
            if (imgUrl) {
                imageBlock = `
                    <div class="inv-card-img"> <!-- Should match .inventory-card__image class or reuse inv-card-img which I styled --> 
                         <!-- Wait, Kit uses .inventory-card__image. I styled .inv-card-img. User asked to match Kit. -->
                         <!-- Check if I should use .inv-card-img (75x100) or .inventory-card__image (Kit style). -->
                         <!-- Previous step I styled .inv-card-img to 75x100. Kit probably uses same or similar. -->
                         <!-- I will use .inv-card-img as I just styled it for this purpose. -->
                        <img src="${imgUrl}" alt="Photo" loading="lazy" style="width: 75px; height: 100px; object-fit: cover; object-position: center;">
                    </div>`;
            } else {
                imageBlock = `
                    <div class="inv-card-img empty">
                         <span style="font-size:12px; color:#999;">사진 없음</span>
                    </div>`;
            }

            const locStr = formatLocation(item.location);
            // Match Kit Tag Style: background, color, padding, border-radius, font-size
            const sectionTag = `<span class="kit-tag" style="background:#f3e5f5; color:#7b1fa2; padding:2px 6px; border-radius:4px; font-size:12px;">${item.tools_section || '교구'}</span>`;
            const categoryTag = `<span class="kit-tag" style="background:#e3f2fd; color:#0d47a1; padding:2px 6px; border-radius:4px; font-size:12px;">${item.tools_category || '-'}</span>`;

            // Stock Status
            let statusTag = "";
            // if (item.stock <= 0) { ... } Removed as requested

            // Code/No Display
            const displayNo = item.tools_no ? `No.${item.tools_no}` : '';

            card.innerHTML = `
        ${imageBlock}
        <div class="inv-card-content" style="display: flex; justify-content: space-between; align-items: stretch; width: 100%; padding: 12px 15px; box-sizing: border-box;">
            <div class="inv-card-left" style="display: flex; flex-direction: column; justify-content: space-between; flex: 1;">
                 <div>
                    ${sectionTag} ${categoryTag} ${statusTag}
                 </div>
                 <div class="inv-name" style="font-weight: bold; font-size: 16px;">
                    ${item.tools_name}
                 </div>
                 <div class="inv-location" style="font-size: 13px; color: #777;">
                    ${locStr}
                 </div>
            </div>

            <div class="inv-card-right" style="display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; margin-left: 10px;">
                <div style="font-size:12px; color:#666; font-weight:normal;">${displayNo}</div>
                <div class="inv-quantity" style="font-size: 14px; color: #555;">
                    수량: ${item.stock}개
                </div>
                

            </div>
        </div>
      `;
            container.appendChild(card);

            // Bind Events


        });
    }

    function sortList(list, sortBy) {
        if (sortBy === 'category_code') {
            // Sort by Category, then Code
            return list.sort((a, b) => {
                const catA = a.tools_category || "";
                const catB = b.tools_category || "";
                if (catA !== catB) return catA.localeCompare(catB);

                // Code (Ascending, Natural)
                const codeA = (a.tools_code || "").trim();
                const codeB = (b.tools_code || "").trim();
                return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
            });
        }
        else if (sortBy === 'section_code') {
            return list.sort((a, b) => {
                // 1. Section (Ascending) - Default to '교구'
                const secA = (a.tools_section || "교구").trim();
                const secB = (b.tools_section || "교구").trim();

                // Compare Sections
                const secDiff = secA.localeCompare(secB);
                if (secDiff !== 0) return secDiff;

                // 2. No (Ascending, Numeric)
                const noA = (a.tools_no || 0);
                const noB = (b.tools_no || 0);
                return noA - noB;
            });
        }
        else if (sortBy === 'all_name') {
            // Sort by Name only
            return list.sort((a, b) => (a.tools_name || "").localeCompare(b.tools_name || ""));
        }
        else if (sortBy === 'category_name') {
            // Sort by Category, then Name
            return list.sort((a, b) => {
                const catA = a.tools_category || "";
                const catB = b.tools_category || "";
                if (catA !== catB) return catA.localeCompare(catB);
                return (a.tools_name || "").localeCompare(b.tools_name || "");
            });
        }
        else if (sortBy === 'location') {
            return list.sort((a, b) => {
                const locA = formatLocation(a.location);
                const locB = formatLocation(b.location);
                return locA.localeCompare(locB);
            });
        }

        return list;
    }

    function setupSortDropdown() {
        if (App.SortDropdown) {
            App.SortDropdown.init({
                toggleId: 'aid-sort-toggle',
                menuId: 'aid-sort-menu',
                labelId: 'aid-sort-label',
                defaultLabel: '섹션 코드순',
                defaultValue: 'section_code',
                onChange: (value) => {
                    state.sortBy = value;
                    renderList();
                }
            });
        }
    }

    function formatLocation(loc) {
        if (!loc) return "위치 미지정";
        if (typeof loc === 'string') return loc;

        let parts = [];
        if (loc.area_name) parts.push(loc.area_name);
        if (loc.cabinet_name) parts.push(loc.cabinet_name);

        // Detailed Location Info
        if (loc.door_vertical) parts.push(`${loc.door_vertical}층`);
        if (loc.door_horizontal) parts.push(`${loc.door_horizontal}번`);
        if (loc.internal_shelf_level) parts.push(`${loc.internal_shelf_level}단`);
        if (loc.storage_column) parts.push(`${loc.storage_column}열`);

        return parts.join(" > ") || "위치 미지정";
    }

    // ----------------------------------------------------------------
    // 3. 상세 (Detail)
    // ----------------------------------------------------------------
    async function loadDetail(id) {
        console.log(`🧩 Detail Load: ${id}`);

        try {
            const supabase = App.supabase;
            const { data: tool, error } = await supabase
                .from('tools')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            // Updated Layout requires updated HTML in Detail Page.
            // Assuming we update 'teaching-tools-detail.html' to have matching IDs or we inject logic here.

            // Mapping to existing IDs in teaching-tools-detail.html (which was teaching-aid-detail.html)
            const setText = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val || '-';
            };

            setText('detail-aid-name', tool.tools_name);

            // Styled Tags for Class (Section & Category)
            const section = tool.tools_section || '교구';
            const category = tool.tools_category || '-';

            const sectionTag = `<span class="kit-tag" style="background:#f3e5f5; color:#7b1fa2; padding:2px 6px; border-radius:4px; font-size:12px; margin-right:5px;">${section}</span>`;
            const categoryTag = `<span class="kit-tag" style="background:#e3f2fd; color:#0d47a1; padding:2px 6px; border-radius:4px; font-size:12px;">${category}</span>`;

            const classEl = document.getElementById('detail-aid-class');
            if (classEl) {
                // Remove container styling to let inner tags handle it
                classEl.removeAttribute('class');
                classEl.style.background = 'none';
                classEl.style.padding = '0';
                classEl.style.color = 'inherit';
                classEl.style.fontSize = 'inherit';
                classEl.style.marginLeft = '10px';
                classEl.innerHTML = `${sectionTag}${categoryTag}`;
            }
            // 1. Tool/Item Code (Row 1)
            const isFacility = (tool.tools_section || '').trim() === '설비';
            const row1Label = document.getElementById('detail-row-1-label');
            const row1Value = document.getElementById('detail-row-1-value');
            if (row1Label) row1Label.textContent = isFacility ? '종목코드' : '교구코드';
            if (row1Value) row1Value.textContent = tool.tools_code || '-';

            // 2. Requirement Standard (Row 2) - 소요기준
            const row2Value = document.getElementById('detail-row-2-value');
            if (row2Value) row2Value.textContent = tool.standard_amount || '-';

            // 3. Standard Quantity (Row 3) - 기준량
            const row3Value = document.getElementById('detail-row-3-value');
            if (row3Value) row3Value.textContent = tool.requirement || '-';

            // 4. Stock (Row 4) - 보유량
            const row4Value = document.getElementById('detail-row-4-value');
            if (row4Value) row4Value.textContent = tool.stock || '0';

            // 5. Stock Rate (Row 5) - 보유율
            const row5Value = document.getElementById('detail-row-5-value');
            if (row5Value) {
                const prop = tool.proportion !== null && tool.proportion !== undefined ? tool.proportion : '-';
                row5Value.textContent = (prop !== '-') ? `${(prop * 100).toFixed(1)}%` : '-';
            }

            // 6. Essential/Standard (Row 6) - 필수/기준
            // Pattern: [Essential/Recommended] / [In-Spec/Out-Spec]
            const row6Value = document.getElementById('detail-row-6-value');
            if (row6Value) {
                const rec = tool.recommended || '-';
                const std = tool.out_of_standard || '-';
                row6Value.textContent = `${rec} / ${std}`;
            }

            // 7. Location (Row 7) - 보관 위치
            const row7Value = document.getElementById('detail-row-7-value');
            if (row7Value) row7Value.textContent = formatLocation(tool.location);

            const photoBox = document.getElementById('detail-aid-photo');
            if (photoBox) {
                if (tool.image_url) {
                    photoBox.innerHTML = `<img src="${tool.image_url}" alt="${tool.tools_name}" style="width: 100%; height: 100%; object-fit: cover; object-position: center;" onclick="App.createImageModal('${tool.image_url}')">`;
                } else {
                    photoBox.innerHTML = `<span style="color:#ccc;">사진 없음</span>`;
                }
            }

            setupDetailFab(tool);
            loadUsageLogs(tool); // Pass full tool object

        } catch (err) {
            console.error("Detail Error:", err);
            alert("상세 정보를 불러올 수 없습니다.");
        }
    }

    async function loadUsageLogs(tool) {
        const supabase = App.supabase;
        const tbody = document.getElementById('aid-usage-logs-body');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">로딩 중...</td></tr>';

        const { data: logs, error } = await supabase
            .from('tools_usage_log')
            .select('*')
            .eq('tools_id', tool.id)
            .order('created_at', { ascending: true }); // Oldest first

        if (error) {
            console.error("Logs Error:", error);
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:red;">기록을 불러오지 못했습니다.</td></tr>`;
            return;
        }

        // Calculate Initial Quantity: Current Stock - Sum (All Logs Change)
        let totalChange = 0;
        if (logs) {
            logs.forEach(l => totalChange += (l.change_amount || 0));
        }

        const initialQuantity = tool.stock - totalChange;

        // Determine Initial Date (purchase_date or created_at)
        const initialDate = tool.purchase_date || (tool.created_at ? tool.created_at.split('T')[0] : '');

        const initialLog = {
            id: 'initial',
            created_at: initialDate,
            reason: '최초 등록',
            change_amount: initialQuantity,
            is_initial: true
        };

        let allLogs = [];
        // Always show initial log
        allLogs.push(initialLog);
        if (logs) allLogs = [...allLogs, ...logs];

        // Sort by date ascending
        allLogs.sort((a, b) => new Date(a.created_at || '1970-01-01') - new Date(b.created_at || '1970-01-01'));

        if (allLogs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">기록이 없습니다.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        let currentQuantity = 0;

        allLogs.forEach(log => {
            const tr = document.createElement('tr');
            const rowId = log.is_initial ? 'tool-log-row-initial' : `tool-log-row-${log.id}`;
            tr.id = rowId;

            let change = 0;
            if (log.is_initial) {
                change = log.change_amount;
                currentQuantity = change; // Reset
            } else {
                change = log.change_amount;
                currentQuantity += change;
            }

            const changeText = change > 0 ? `+${change}` : `${change}`;
            let changeColor = 'black';
            if (change > 0) changeColor = 'blue';
            if (change < 0) changeColor = 'red';

            const dateStr = log.created_at ? log.created_at.split('T')[0] : '-';

            // Buttons
            let btnHtml = '';
            if (log.is_initial) {
                // Initial Log: Edit/Delete buttons (User said Kits style, where initial IS editable)
                // However, user said "Last request: Initial Registration does not need edit/delete" for Chemicals?
                // But for Kits I added it back.
                // For Teaching Tools, let's assume same as Kits (Edit Initial allowed).
                btnHtml = `
                    <button class="btn-mini btn-edit" style="background:#ffdd57; border:none; padding:4px 8px; cursor:pointer; margin-right:4px; border-radius:4px; font-size:11px;" onclick="App.TeachingTools.editToolInitial(${tool.id}, '${dateStr}', ${change})">수정</button>
                    <!-- <button class="btn-mini btn-delete" ... delete initial? Maybe restrict if inconsistent> -->
                `;
                // Let's hold off on Delete Initial unless requested, to avoid complexity (as per Chemical "no edit initial" recent request). 
                // Wait, user said "Display in the form of 'Usage History' displayed in Kits".
                // Kits has Edit/Delete for initial.
                // So I will execute that.
                btnHtml = `
                    <button class="btn-mini btn-edit" style="background:#ffdd57; border:none; padding:4px 8px; cursor:pointer; margin-right:4px; border-radius:4px; font-size:11px;" onclick="App.TeachingTools.editToolInitial(${tool.id}, '${dateStr}', ${change})">수정</button>
                    <button class="btn-mini btn-delete" style="background:#ff3860; color:white; border:none; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:11px;" onclick="App.TeachingTools.deleteToolInitial(${tool.id}, ${change})">삭제</button>
                 `;
            } else {
                btnHtml = `
                    <button class="btn-mini btn-edit" style="background:#ffdd57; border:none; padding:4px 8px; cursor:pointer; margin-right:4px; border-radius:4px; font-size:11px;" onclick="App.TeachingTools.editToolLog(${tool.id}, ${log.id}, '${dateStr}', '${log.reason || ''}', ${change})">수정</button>
                    <button class="btn-mini btn-delete" style="background:#ff3860; color:white; border:none; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:11px;" onclick="App.TeachingTools.deleteToolLog(${tool.id}, ${log.id}, ${change})">삭제</button>
                `;
            }

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${log.reason || (log.is_initial ? '최초 등록' : '-')}</td>
                <td><span style="color:${changeColor}; font-weight:bold;">${changeText}</span></td>
                <td>${currentQuantity}</td>
                <td style="text-align:center;">${btnHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function setupDetailFab(tool) {
        if (!App.Fab) return;

        App.Fab.setMenu([
            {
                icon: "inventory",
                label: "사용 등록",
                color: "#4caf50", // Green
                onClick: () => openStockModal(tool)
            },
            {
                icon: "edit",
                label: "정보 수정",
                color: "#2196f3", // Blue
                onClick: () => App.Router.go("toolsForm", { id: tool.id })
            },
            {
                icon: "delete",
                label: "교구 삭제",
                color: "#999", // Grey
                onClick: () => handleDelete(tool)
            }
        ]);
        App.Fab.setVisibility(true);
    }

    // ---- Stock Modal Management ----
    let openStockModal = null; // Defined in setupStockModal

    function setupStockModal() {
        if (document.getElementById('modal-tool-stock')) return;

        const modalHtml = `
            <div id="modal-tool-stock" class="modal-overlay" style="display: none; z-index: 1200;">
                <div class="modal-content stock-modal-content">
                    <h3 id="stock-tool-name" class="modal-title" style="text-align: center; margin: 0 0 15px 0; padding-bottom: 15px; border-bottom: 1px solid #eee;"></h3>

                    <form id="form-tool-stock">
                        <!-- Hidden Input for Type -->
                        <input type="hidden" id="tool-stock-type" value="usage">

                        <div class="form-group">
                            <label style="margin-bottom:8px; display:block; color:#666; font-size:13px;">등록 유형</label>
                            <div class="stock-toggle-group" style="display:flex; gap:0; border:1px solid #ddd; border-radius:6px; overflow:hidden;">
                                <button type="button" class="stock-toggle-btn active" data-type="usage" style="flex:1; padding:12px; border:none; background:#fff; cursor:pointer; font-weight:bold; color:#ccc; transition:all 0.2s;">사용 (차감)</button>
                                <button type="button" class="stock-toggle-btn" data-type="purchase" style="flex:1; padding:12px; border:none; background:#f5f5f5; cursor:pointer; font-weight:bold; color:#ccc; border-left:1px solid #ddd; transition:all 0.2s;">추가 (증가)</button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="stock-tool-amount" id="label-stock-amount">사용 수량</label>
                            <input type="number" id="stock-tool-amount" class="form-input" min="1" value="1" required style="font-size:16px; padding:12px;">
                        </div>

                        <div class="form-group">
                            <label for="stock-tool-date">날짜</label>
                            <input type="date" id="stock-tool-date" class="form-input" required>
                        </div>

                        <div class="modal-actions">
                            <button type="button" id="btn-cancel-tool-stock" class="btn-cancel">취소</button>
                            <button type="submit" id="btn-save-tool-stock" class="btn-primary">저장</button>
                        </div>
                    </form>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('modal-tool-stock');
        const form = document.getElementById('form-tool-stock');
        const btnCancel = document.getElementById('btn-cancel-tool-stock');
        let currentTool = null;

        btnCancel.addEventListener('click', () => {
            modal.style.display = 'none';
            if (App.Fab && typeof App.Fab.show === 'function') App.Fab.show();
            else if (App.Fab) App.Fab.setVisibility(true);
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentTool) return;

            if (!currentTool) return;

            const type = document.getElementById('tool-stock-type').value;
            const amount = parseInt(document.getElementById('stock-tool-amount').value, 10);
            const date = document.getElementById('stock-tool-date').value;

            await handleStockChange(currentTool, type, amount, date);
            modal.style.display = 'none';
            if (App.Fab && typeof App.Fab.show === 'function') App.Fab.show();
            else if (App.Fab) App.Fab.setVisibility(true); // Fallback
        });

        // Assign to local variable to be used by FAB
        openStockModal = (tool) => {
            currentTool = tool;
            document.getElementById('stock-tool-name').textContent = tool.tools_name;
            document.getElementById('stock-tool-amount').value = 1;
            document.getElementById('stock-tool-date').valueAsDate = new Date();

            document.getElementById('stock-tool-date').valueAsDate = new Date();

            // Default to 'usage'
            updateToggleState('usage');

            modal.style.display = 'flex';
            if (App.Fab && typeof App.Fab.hide === 'function') App.Fab.hide();
            else if (App.Fab) App.Fab.setVisibility(false); // Fallback
        };

        // Helper to handle toggle visuals
        function updateToggleState(type) {
            const hiddenInput = document.getElementById('tool-stock-type');
            const labelAmount = document.getElementById('label-stock-amount');
            const btns = modal.querySelectorAll('.stock-toggle-btn');

            hiddenInput.value = type;

            btns.forEach(btn => {
                const btnType = btn.dataset.type;
                if (btnType === type) {
                    btn.classList.add('active');
                    // Active Styles
                    if (type === 'usage') {
                        btn.style.background = '#ffebee'; // Light Red
                        btn.style.color = '#c62828';
                        labelAmount.textContent = "사용 수량 (몇 개를 썼나요?)";
                        labelAmount.style.color = '#c62828';
                    } else {
                        btn.style.background = '#e3f2fd'; // Light Blue
                        btn.style.color = '#1565c0';
                        labelAmount.textContent = "추가 수량 (몇 개가 늘었나요?)";
                        labelAmount.style.color = '#1565c0';
                    }
                } else {
                    btn.classList.remove('active');
                    // Inactive Styles
                    btn.style.background = '#f9f9f9';
                    btn.style.color = '#aaa';
                }
            });
        }

        // Toggle Click Events
        modal.querySelectorAll('.stock-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                updateToggleState(btn.dataset.type);
            });
        });
    }

    async function handleStockChange(tool, type, amount, date) {
        let change = 0;
        let reason = '';

        if (type === 'usage') {
            change = -amount;
            reason = '사용';
        } else {
            change = amount;
            reason = '추가'; // or 구입
        }

        const newQuantity = tool.stock + change;

        if (newQuantity < 0) {
            alert('재고가 부족합니다.');
            return;
        }

        try {
            const supabase = App.supabase;

            // 1. Update Tools Table
            const { error: updateError } = await supabase
                .from('tools')
                .update({ stock: newQuantity })
                .eq('id', tool.id);

            if (updateError) throw updateError;

            // 2. Insert Log
            // tools_usage_log table columns: tools_id, change_amount, final_quantity, reason
            // Note: Kits used log_type, log_date. Tools uses created_at (auto?) or specific date?
            // Currently `tools_usage_log` usually has `created_at` default now().
            // If we want to support Custom Date, we need to see if we can update `created_at` or if there is a `date` column.
            // Looking at `loadUsageLogs` in previous view: it uses `created_at`.
            // So we will try to insert `created_at` with the selected date as ISO string.

            const { error: logError } = await supabase.from('tools_usage_log').insert({
                tools_id: tool.id,
                change_amount: change,
                final_quantity: newQuantity,
                reason: reason,
                created_at: new Date(date).toISOString() // Overwrite created_at with user selected date
            });

            if (logError) {
                console.error('Failed to log usage:', logError);
                alert('재고는 수정되었으나 로그 저장에 실패했습니다.');
            } else {
                alert('저장되었습니다.');
            }

            // Reload Detail
            loadDetail(tool.id);

        } catch (err) {
            alert("처리 중 오류가 발생했습니다: " + err.message);
            console.error(err);
        }
    }

    async function handleDelete(tool) {
        if (!confirm(`'${tool.tools_name}' 항목을 정말 삭제하시겠습니까?`)) return;

        try {
            const supabase = App.supabase;
            const { error } = await supabase.from('tools').delete().eq('id', tool.id);
            if (error) throw error;

            alert("삭제되었습니다.");
            App.Router.go("teachingTools");
        } catch (err) {
            alert("삭제 실패");
            console.error(err);
        }
    }


    // ================================================================
    // 🪵 Log Management (Edit / Delete)
    // ================================================================

    // --- Normal Logs ---
    async function editToolLog(toolId, logId, date, reason, change) {
        const tr = document.getElementById(`tool-log-row-${logId}`);
        if (!tr) return;

        const absChange = Math.abs(change);

        tr.innerHTML = `
            <td><input type="date" id="edit-log-date-${logId}" value="${date}" style="width:110px;"></td>
            <td>
                 <input type="text" id="edit-log-reason-${logId}" value="${reason}" style="width:100px;">
            </td>
            <td>
                 <!-- Edit Signed Amount directly or Type? Teaching tools usually just +/- -->
                 <!-- Let's use signed input for flexibility or Select Type? -->
                 <!-- User wanted standardized "Usage History". Kits used Type + Amount. -->
                 <!-- Here we have Reason (Text). Let's use a simple Signed Number or Select. -->
                 <!-- The FAB has "Add" / "Use". -->
                 <select id="edit-log-type-${logId}" style="width:60px;">
                    <option value="1" ${change > 0 ? 'selected' : ''}>추가</option>
                    <option value="-1" ${change < 0 ? 'selected' : ''}>사용</option>
                 </select>
                 <input type="number" id="edit-log-amount-${logId}" value="${absChange}" min="1" style="width:60px;">
            </td>
            <td>-</td> 
            <td style="white-space:nowrap;">
                <button class="btn-mini btn-save" style="background:#4caf50; color:white; border:none; padding:4px 8px; cursor:pointer; margin-right:4px; border-radius:4px; font-size:11px;" onclick="App.TeachingTools.saveToolLog(${toolId}, ${logId}, ${change})">저장</button>
                <button class="btn-mini btn-cancel" style="background:#ccc; border:none; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:11px;" onclick="App.TeachingTools.cancelToolEdit(${toolId})">취소</button>
            </td>
        `;
    }

    async function saveToolLog(toolId, logId, oldSignedChange) {
        const dateInput = document.getElementById(`edit-log-date-${logId}`);
        const typeSelect = document.getElementById(`edit-log-type-${logId}`);
        const amountInput = document.getElementById(`edit-log-amount-${logId}`);
        const reasonInput = document.getElementById(`edit-log-reason-${logId}`);

        if (!dateInput || !typeSelect || !amountInput) return;

        const newDate = dateInput.value; // Text
        const polarity = parseInt(typeSelect.value);
        const newAmountAbs = parseInt(amountInput.value);
        const newReason = reasonInput.value;

        if (!newDate || isNaN(newAmountAbs) || newAmountAbs <= 0) {
            alert('값을 확인하세요.');
            return;
        }

        const newSignedChange = polarity * newAmountAbs;
        const diff = newSignedChange - oldSignedChange;

        try {
            // 1. Update Log
            const { error: logError } = await App.supabase
                .from('tools_usage_log')
                .update({
                    created_at: new Date(newDate).toISOString(), // Handle TZ? Date input is YYYY-MM-DD. ISO will be 00:00 UTC. Ok for sorting.
                    change_amount: newSignedChange,
                    reason: newReason
                    // final_quantity: we can't easily update this without fetch. Ignore for now or fetch.
                })
                .eq('id', logId);

            if (logError) throw logError;

            // 2. Update Stock if changed
            if (diff !== 0) {
                const { data: tool, error: toolError } = await App.supabase.from('tools').select('stock').eq('id', toolId).single();
                if (toolError) throw toolError;

                const newStock = tool.stock + diff;
                await App.supabase.from('tools').update({ stock: newStock }).eq('id', toolId);
            }

            alert('수정되었습니다.');
            loadDetail(toolId);

        } catch (e) {
            console.error(e);
            alert('수정 실패: ' + e.message);
        }
    }

    async function deleteToolLog(toolId, logId, oldSignedChange) {
        if (!confirm('정말 삭제하시겠습니까? 재고가 원복됩니다.')) return;

        try {
            const { error: logError } = await App.supabase
                .from('tools_usage_log')
                .delete()
                .eq('id', logId);

            if (logError) throw logError;

            // Revert Stock
            const { data: tool, error: toolError } = await App.supabase.from('tools').select('stock').eq('id', toolId).single();
            if (!toolError) {
                const newStock = tool.stock - oldSignedChange;
                await App.supabase.from('tools').update({ stock: newStock }).eq('id', toolId);
            }

            alert('삭제되었습니다.');
            loadDetail(toolId);

        } catch (e) {
            console.error(e);
            alert('삭제 실패: ' + e.message);
        }
    }

    // --- Initial Registration ---
    async function editToolInitial(toolId, date, currentInitialAmount) {
        const tr = document.getElementById('tool-log-row-initial');
        if (!tr) return;

        tr.innerHTML = `
            <td><input type="date" id="edit-initial-date" value="${date}" style="width:110px;"></td>
            <td>최초 등록 (고정)</td>
            <td>
                 <!-- Edit Initial Amount (Absolute, assummed positive stock) -->
                 <input type="number" id="edit-initial-amount" value="${currentInitialAmount}" min="0" style="width:60px;">
            </td>
            <td>-</td>
            <td style="white-space:nowrap;">
                <button class="btn-mini btn-save" style="background:#4caf50; color:white; border:none; padding:4px 8px; cursor:pointer; margin-right:4px; border-radius:4px; font-size:11px;" onclick="App.TeachingTools.saveToolInitial(${toolId}, ${currentInitialAmount})">저장</button>
                <button class="btn-mini btn-cancel" style="background:#ccc; border:none; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:11px;" onclick="App.TeachingTools.cancelToolEdit(${toolId})">취소</button>
            </td>
         `;
    }

    async function saveToolInitial(toolId, oldInitialAmount) {
        const dateInput = document.getElementById('edit-initial-date');
        const amountInput = document.getElementById('edit-initial-amount');
        if (!dateInput || !amountInput) return;

        const newDate = dateInput.value;
        const newAmount = parseInt(amountInput.value);

        if (!newDate || isNaN(newAmount) || newAmount < 0) {
            alert('값을 확인하세요.');
            return;
        }

        const diff = newAmount - oldInitialAmount;

        try {
            const { data: tool, error: toolError } = await App.supabase.from('tools').select('stock').eq('id', toolId).single();
            if (toolError) throw toolError;

            const newStock = tool.stock + diff;

            // Try updating buy_date. If column doesn't exist, this might fail or be ignored.
            // Teaching tools table schema usually has `buy_date`.
            const { error: updateError } = await App.supabase
                .from('tools')
                .update({
                    buy_date: newDate,
                    stock: newStock
                })
                .eq('id', toolId);

            if (updateError) throw updateError;

            alert('최초 등록 정보가 수정되었습니다.');
            loadDetail(toolId);

        } catch (e) {
            console.error(e);
            alert('수정 실패: ' + e.message);
        }
    }

    async function deleteToolInitial(toolId, initialAmount) {
        if (!confirm('최초 등록 정보를 삭제(초기화)하시겠습니까?\n총 재고에서 차감됩니다.')) return;

        try {
            const { data: tool, error: toolError } = await App.supabase.from('tools').select('stock').eq('id', toolId).single();
            if (toolError) throw toolError;

            const newStock = tool.stock - initialAmount;

            await App.supabase
                .from('tools')
                .update({
                    stock: newStock,
                    buy_date: null
                })
                .eq('id', toolId);

            alert('초기화되었습니다.');
            loadDetail(toolId);

        } catch (e) {
            console.error(e);
            alert('삭제 실패: ' + e.message);
        }
    }

    function cancelToolEdit(toolId) {
        loadDetail(toolId);
    }

    // ================================================================
    // Public Interface
    // ================================================================
    globalThis.App.TeachingTools = {
        init,
        loadList,
        loadDetail,
        // Helpers
        editToolLog,
        saveToolLog,
        deleteToolLog,
        cancelToolEdit,
        editToolInitial,
        saveToolInitial,
        deleteToolInitial
    };
})();
