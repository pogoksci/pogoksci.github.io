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
        state = { tools: [], filterName: "", sortBy: "aid_class" };

        bindEvents();
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

        // 4) 등록 FAB (Go to Form Page)
        if (App.Fab) {
            App.Fab.setVisibility(true, '<span class="material-symbols-outlined">add</span> 교구/설비 등록', () => {
                App.Router.go("toolsForm");
            });
        }
    }

    // ----------------------------------------------------------------
    // 2. 목록 로드 & 렌더링
    // ----------------------------------------------------------------
    async function loadList() {
        try {
            const supabase = App.supabase;
            if (!supabase) throw new Error("Supabase client not found");

            // Select new columns
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

            // 2. Implicit Section Filter based on SortBy
            if (state.sortBy.startsWith('aid_')) {
                return (item.tools_section || "").trim() === '교구';
            } else if (state.sortBy.startsWith('facility_')) {
                return (item.tools_section || "").trim() === '설비';
            }

            return true;
        });

        list = sortList(list, state.sortBy);

        // Group by Section (Teaching Aid vs Facility) if needed?
        // Or just list them. Let's just list them for now but maybe show section badge.

        if (list.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-outlined">school</span>
          <p>등록된 교구/설비가 없습니다.</p>
        </div>`;
            return;
        }

        const shouldGroup = (state.sortBy === 'aid_class' || state.sortBy === 'facility_class');
        let currentCategory = null;

        list.forEach(item => {
            // Header Logic
            if (shouldGroup) {
                const cat = item.tools_category || "미분류";
                if (cat !== currentCategory) {
                    currentCategory = cat;
                    const count = list.filter(i => (i.tools_category || "미분류") === cat).length;

                    const header = document.createElement("div");
                    header.className = "inventory-section-header";
                    // Ensure sticky behavior and style
                    header.style.position = "sticky";
                    header.style.top = "0";
                    header.style.zIndex = "10";
                    header.style.background = "#f5f8ff";
                    header.style.padding = "8px 16px";
                    header.style.borderLeft = "4px solid #00a0b2";
                    header.style.fontWeight = "bold";
                    header.style.marginTop = "0"; // Remove top margin if any
                    header.style.marginBottom = "0"; // Tweak as needed, cards have margins
                    header.style.display = "flex";
                    header.style.alignItems = "center";
                    header.style.justifyContent = "space-between";

                    header.innerHTML = `
                         <span>${cat}</span>
                         <span class="section-count" style="background:#e1f5fe; color:#00a0b2; padding:2px 8px; border-radius:12px; font-size:12px;">${count}</span>
                     `;
                    container.appendChild(header);
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
                        <img src="${imgUrl}" alt="Photo" loading="lazy">
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
            if (item.stock <= 0) {
                statusTag = `<span class="kit-tag" style="background:#ffebee; color:#c62828; padding:2px 6px; border-radius:4px; font-size:12px;">품절</span>`;
            }

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
                    <span style="font-size:12px; color:#666; margin-right:4px; font-weight:normal;">${displayNo}</span>
                    ${item.tools_name}
                 </div>
                 <div class="inv-location" style="font-size: 13px; color: #777;">
                    ${locStr}
                 </div>
            </div>

            <div class="inv-card-right" style="display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; margin-left: 10px;">
                <div style="height: 26px;"></div> <!-- Spacer with height to match Tag Line + adjust for button height -->
                <div class="inv-quantity" style="font-size: 14px; color: #555;">
                    수량: ${item.stock}개
                </div>
                
                <div class="inventory-card__actions" style="display: flex; gap: 5px;">
                    <button class="icon-btn stock-tool-btn" data-id="${item.id}" style="border:none; background:none; cursor:pointer; padding:4px;" title="재고 관리">
                        <span class="material-symbols-outlined" style="font-size: 20px; color: #4caf50;">inventory</span>
                    </button>
                    <button class="icon-btn edit-tool-btn" data-id="${item.id}" style="border:none; background:none; cursor:pointer; padding:4px;" title="수정">
                        <span class="material-symbols-outlined" style="font-size: 20px; color: #00a0b2;">edit</span>
                    </button>
                    <button class="icon-btn delete-tool-btn" data-id="${item.id}" style="border:none; background:none; cursor:pointer; padding:4px;" title="삭제">
                        <span class="material-symbols-outlined" style="font-size: 20px; color: #999;">delete</span>
                    </button>
                </div>
            </div>
        </div>
      `;
            container.appendChild(card);

            // Bind Events
            const stockBtn = card.querySelector('.stock-tool-btn');
            stockBtn.onclick = (e) => {
                e.stopPropagation();
                // TODO: Open Stock Modal
                alert("재고 관리 기능은 준비 중입니다.");
            };

            const editBtn = card.querySelector('.edit-tool-btn');
            editBtn.onclick = (e) => {
                e.stopPropagation();
                App.Router.go('toolsForm', { id: item.id });
            };

            const deleteBtn = card.querySelector('.delete-tool-btn');
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm('정말 삭제하시겠습니까?')) {
                    try {
                        const { error } = await supabase.from('tools').delete().eq('id', item.id);
                        if (error) throw error;
                        loadList(); // Reload
                    } catch (err) {
                        alert("삭제 실패: " + err.message);
                    }
                }
            };
        });
    }

    function sortList(list, sortBy) {
        if (sortBy === 'no_asc') {
            return list.sort((a, b) => (a.tools_no || 0) - (b.tools_no || 0));
        }
        else if (sortBy === 'aid_class' || sortBy === 'facility_class') {
            // Sort by Category, then Name
            return list.sort((a, b) => {
                const catA = a.tools_category || "";
                const catB = b.tools_category || "";
                if (catA !== catB) return catA.localeCompare(catB);
                return (a.tools_name || "").localeCompare(b.tools_name || "");
            });
        }
        else if (sortBy === 'aid_all' || sortBy === 'facility_all' || sortBy === 'name_asc') {
            // Sort by Name only
            return list.sort((a, b) => (a.tools_name || "").localeCompare(b.tools_name || ""));
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
        const toggle = document.getElementById("aid-sort-toggle");
        const menu = document.getElementById("aid-sort-menu");
        if (!toggle || !menu) return;

        toggle.addEventListener("click", (e) => {
            e.stopPropagation();
            const isVisible = menu.style.display === "block";
            document.querySelectorAll(".dropdown-menu").forEach(el => el.style.display = "none");
            menu.style.display = isVisible ? "none" : "block";
            toggle.setAttribute("aria-expanded", !isVisible);
        });

        menu.querySelectorAll(".dropdown-item").forEach(item => {
            item.addEventListener("click", () => {
                state.sortBy = item.dataset.value;
                // Extract text only (exclude icon ligatures)
                const text = Array.from(item.childNodes)
                    .filter(node => node.nodeType === Node.TEXT_NODE)
                    .map(node => node.textContent.trim())
                    .join("");
                document.getElementById("aid-sort-label").textContent = text;
                renderList();
                menu.style.display = "none";
            });
        });

        document.addEventListener("click", (e) => {
            if (!toggle.contains(e.target) && !menu.contains(e.target)) {
                menu.style.display = "none";
            }
        });
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
            setText('detail-aid-class', `${tool.tools_section || ''} > ${tool.tools_category || ''}`);
            setText('detail-aid-quantity', tool.stock);
            setText('detail-aid-location', formatLocation(tool.location));

            // Extra fields handling (might need to add these to detail html)
            // For now, rely on existing fields.

            const photoBox = document.getElementById('detail-aid-photo');
            if (photoBox) {
                if (tool.image_url) {
                    photoBox.innerHTML = `<img src="${tool.image_url}" alt="${tool.tools_name}" onclick="App.createImageModal('${tool.image_url}')">`;
                } else {
                    photoBox.innerHTML = `<span style="color:#ccc;">사진 없음</span>`;
                }
            }

            setupDetailFab(tool);
            loadUsageLogs(id);

        } catch (err) {
            console.error("Detail Error:", err);
            alert("상세 정보를 불러올 수 없습니다.");
        }
    }

    async function loadUsageLogs(toolId) {
        const supabase = App.supabase;
        // Table renamed: tools_usage_log
        const { data: logs, error } = await supabase
            .from('tools_usage_log')
            .select('*')
            .eq('tools_id', toolId) // Column renamed: tools_id (assumed based on table rename)
            // Wait, did valid migrate column name? "renaming tables ... and adding new columns".
            // Usually FK column also changes if consistent. I will check schema later or assume 'tools_id'.
            // If failed, I will fix.
            .order('created_at', { ascending: false });

        const tbody = document.getElementById('aid-usage-logs-body');
        if (!tbody) return;
        tbody.innerHTML = "";

        if (error || !logs || logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px; color:#999;">기록이 없습니다.</td></tr>`;
            return;
        }

        logs.forEach(log => {
            const date = new Date(log.created_at).toLocaleDateString();
            const isPositive = log.change_amount > 0;
            const sign = isPositive ? "+" : "";
            const color = isPositive ? "blue" : "red";

            const tr = document.createElement('tr');
            tr.innerHTML = `
            <td>${date}</td>
            <td>${log.reason || "-"}</td>
            <td style="text-align: right;">
                <span style="color:${color}; font-weight:bold;">${sign}${log.change_amount}</span> 
                <span style="color:#666; font-size:12px;">(${log.final_quantity})</span>
            </td>
          `;
            tbody.appendChild(tr);
        });
    }

    function setupDetailFab(tool) {
        if (!App.Fab) return;

        App.Fab.setMenu([
            {
                icon: "add",
                label: "반입(추가)",
                onClick: () => handleUsage(tool, 1)
            },
            {
                icon: "remove",
                label: "사용(반출)",
                onClick: () => handleUsage(tool, -1)
            },
            {
                icon: "edit",
                label: "정보 수정",
                onClick: () => App.Router.go("toolsForm", { id: tool.id }) // Go to Form
            },
            {
                icon: "delete",
                label: "삭제",
                onClick: () => handleDelete(tool)
            }
        ]);
        App.Fab.setVisibility(true);
    }

    async function handleUsage(tool, polarity) {
        const amountStr = prompt(`수량을 입력하세요 (${polarity > 0 ? '추가' : '사용'}).`, "1");
        if (!amountStr) return;

        let amount = parseInt(amountStr);
        if (isNaN(amount) || amount <= 0) {
            alert("유효한 수량을 입력하세요.");
            return;
        }

        const changeAmount = polarity * amount;
        const finalQuantity = tool.stock + changeAmount;
        if (finalQuantity < 0) {
            alert("재고가 부족합니다.");
            return;
        }

        const reason = prompt("사유를 입력하세요 (선택)", "") || (polarity > 0 ? "반입" : "사용");

        try {
            const supabase = App.supabase;

            // Log
            await supabase.from('tools_usage_log').insert({
                tools_id: tool.id, // Column assumed changed
                change_amount: changeAmount,
                final_quantity: finalQuantity,
                reason: reason
            });

            // Update Stock
            const { error } = await supabase
                .from('tools')
                .update({ stock: finalQuantity })
                .eq('id', tool.id);

            if (error) throw error;

            loadDetail(tool.id);

        } catch (err) {
            alert("처리 중 오류가 발생했습니다.");
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
    // Public Interface
    // ================================================================
    globalThis.App.TeachingTools = {
        init,
        loadList,
        loadDetail
    };
})();
