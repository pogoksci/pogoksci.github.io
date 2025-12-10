// ================================================================
// /js/pages/teaching-aids.js — 교구 관리 (Teaching Aids)
// ================================================================
(function () {
    console.log("🧩 App.TeachingAids 모듈 로드됨");

    let state = {
        aids: [],
        filterName: "",
        sortBy: "name_class", // name_class, name_all, location, out_of_stock
        currentDetailId: null,
    };

    // ----------------------------------------------------------------
    // 1. 초기화 (List Page)
    // ----------------------------------------------------------------
    async function init() {
        console.log("🧩 App.TeachingAids.init() called");
        state = { aids: [], filterName: "", sortBy: "name_class", currentDetailId: null };

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

        // 4) 등록 FAB (Floating Action Button)
        if (App.Fab) {
            App.Fab.setVisibility(true, '<span class="material-symbols-outlined">add</span> 새 교구 등록', () => {
                openRegisterModal();
            });
        }

        const formRegister = document.getElementById("form-register-aid");
        if (formRegister) {
            formRegister.addEventListener("submit", handleRegisterSubmit);
        }

        // 6) 위치 설정 모달 관련
        const btnSetLocation = document.getElementById("btn-set-aid-location");
        if (btnSetLocation) {
            btnSetLocation.addEventListener("click", openLocationSelector);
        }
        const btnCancelLocation = document.getElementById("btn-cancel-aid-location");
        if (btnCancelLocation) {
            btnCancelLocation.addEventListener("click", closeLocationSelector);
        }

        // 7) 분류 선택 시 체크박스 토글 (키트와 동일 로직)
        const classSelect = document.getElementById("aid-class-select");
        const classCheckboxesDiv = document.getElementById("aid-class-checkboxes");
        if (classSelect && classCheckboxesDiv) {
            // 등록 시에는 dropdwon 사용, 수정 시에는 checkbox 사용할 수도 있음.
            // 하지만 여기서는 등록 모달만 다룸. 수정 시 로직은 openEditModal에서 처리.
            // 키트처럼 다중 선택이 필요한지? 키트는 "분류"가 multi-select(comma separated)로 저장될 수 있음.
            // 등록 폼에서는 select(single)로 시작하지만, checkbox(multi)로 전환될 수도 있음. 
            // 키트 로직: form submission 시 display:none이 아닌 쪽의 값을 가져감.
        }
    }

    // ----------------------------------------------------------------
    // 2. 목록 로드 & 렌더링
    // ----------------------------------------------------------------
    async function loadList() {
        try {
            showLoading(true);
            const supabase = App.supabase;
            if (!supabase) throw new Error("Supabase client not found");

            // Fetch Teaching Aids
            const { data, error } = await supabase
                .from("teaching_aids")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            state.aids = data || [];
            renderList();

            showLoading(false);
        } catch (err) {
            console.error("❌ loadList Error:", err);
            alert("목록을 불러오는 중 오류가 발생했습니다.");
            showLoading(false);
        }
    }

    function renderList() {
        const container = document.getElementById("aid-list");
        if (!container) return;

        container.innerHTML = "";

        // 1) 필터링
        let list = state.aids.filter(item => {
            // 이름 검색
            if (state.filterName && !item.name.toLowerCase().includes(state.filterName)) return false;
            return true;
        });

        // 2) 정렬
        list = sortList(list, state.sortBy);

        if (list.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-outlined">school</span>
          <p>검색된 교구가 없습니다.</p>
        </div>`;
            return;
        }

        // 3) 카드 렌더링
        list.forEach(item => {
            const card = document.createElement("div");
            card.className = "inventory-card"; // Reusing inventory card style
            card.onclick = () => App.Router.go("teachingAidDetail", { id: item.id });

            // Image
            const imgUrl = item.image_url || "css/no-image.png";

            // Location String
            let locStr = "위치 미지정";
            if (item.location) {
                // Assuming location object structure matches others: { area, cabinet, section... }
                // Helper to format location string
                locStr = formatLocation(item.location);
            }

            // Tags (Category)
            const categoryTag = `<span class="chem-tag" style="background:#e3f2fd; color:#0d47a1;">${item.category}</span>`;

            // Status (Out of Stock)
            let statusTag = "";
            if (item.quantity <= 0) {
                statusTag = `<span class="chem-tag" style="background:#ffebee; color:#c62828;">소모완료</span>`;
            }

            card.innerHTML = `
        <div class="inv-card-img">
            <img src="${imgUrl}" alt="Photo" loading="lazy">
        </div>
        <div class="inv-card-content">
            <div class="inv-card-header">
                <div class="inv-name">${item.name}</div>
            </div>
            <div class="inv-card-meta">
                ${categoryTag} ${statusTag}
            </div>
            <div class="inv-card-info">
                <span><span class="material-symbols-outlined icon-sm">tag</span> 수량: ${item.quantity}</span>
                <span><span class="material-symbols-outlined icon-sm">location_on</span> ${locStr}</span>
            </div>
        </div>
      `;
            container.appendChild(card);
        });
    }

    function sortList(list, sortBy) {
        if (sortBy === 'name_class') {
            // Category then Name
            return list.sort((a, b) => {
                if (a.category !== b.category) return a.category.localeCompare(b.category);
                return a.name.localeCompare(b.name);
            });
        } else if (sortBy === 'name_all') {
            return list.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'location') {
            return list.sort((a, b) => {
                const locA = formatLocation(a.location);
                const locB = formatLocation(b.location);
                return locA.localeCompare(locB);
            });
        } else if (sortBy === 'out_of_stock') {
            // Quantity 0 first, then by name
            return list.sort((a, b) => {
                const aEmpty = a.quantity <= 0;
                const bEmpty = b.quantity <= 0;
                if (aEmpty && !bEmpty) return -1;
                if (!aEmpty && bEmpty) return 1;
                return a.name.localeCompare(b.name);
            });
        }
        return list;
    }

    function updateSortLabel(label) {
        const labelEl = document.getElementById("aid-sort-label");
        if (labelEl) labelEl.textContent = label;

        // Update selected style
        document.querySelectorAll('#aid-sort-menu .dropdown-item').forEach(el => {
            el.classList.remove('selected');
            if (el.dataset.value === state.sortBy) el.classList.add('selected');
        });
    }

    function setupSortDropdown() {
        const toggle = document.getElementById("aid-sort-toggle");
        const menu = document.getElementById("aid-sort-menu");

        if (!toggle || !menu) return;

        // Toggle
        toggle.addEventListener("click", (e) => {
            e.stopPropagation();
            const isVisible = menu.style.display === "block";
            closeAllDropdowns(); // Close others
            menu.style.display = isVisible ? "none" : "block";
            toggle.setAttribute("aria-expanded", !isVisible);
        });

        // Item Click
        menu.querySelectorAll(".dropdown-item").forEach(item => {
            item.addEventListener("click", () => {
                state.sortBy = item.dataset.value;
                const text = item.innerText.trim();
                updateSortLabel(text);
                renderList();
                menu.style.display = "none";
                toggle.setAttribute("aria-expanded", "false");
            });
        });

        // Close when clicking outside
        document.addEventListener("click", (e) => {
            if (!toggle.contains(e.target) && !menu.contains(e.target)) {
                menu.style.display = "none";
                toggle.setAttribute("aria-expanded", "false");
            }
        });

        // Initial state
        updateSortLabel("교구이름(분류)");
    }

    function closeAllDropdowns() {
        document.querySelectorAll(".dropdown-menu").forEach(el => el.style.display = "none");
    }

    function showLoading(show) {
        // Implement loading spinner if needed
    }

    function formatLocation(loc) {
        if (!loc) return "위치 미지정";
        // Assuming loc: { type: "Equipment", area_name, cabinet_name, door_vertical, door_horizontal, shelf_level, column_index }
        // Or simple string.
        if (typeof loc === 'string') return loc;

        let parts = [];
        if (loc.area_name) parts.push(loc.area_name);
        if (loc.cabinet_name) parts.push(loc.cabinet_name);

        let details = [];
        // Logic from inventory list formatting
        // Door
        let doorStr = "";
        if (loc.door_vertical) {
            if (loc.door_vertical === 1 || loc.door_vertical === "1") doorStr += "왼쪽문";
            else if (loc.door_vertical === 2 || loc.door_vertical === "2") doorStr += "오른쪽문";
            else doorStr += loc.door_vertical; // "상단", "하단" e.g.
        }
        if (doorStr) details.push(doorStr);

        // Shelf/Col
        if (loc.shelf_level) details.push(`${loc.shelf_level}층`);
        if (loc.column_index) details.push(`${loc.column_index}열`);

        if (details.length > 0) parts.push(details.join(" "));

        return parts.join(" ") || "위치 미지정";
    }

    // ----------------------------------------------------------------
    // 3. 등록 (Register)
    // ----------------------------------------------------------------
    function openRegisterModal() {
        const modal = document.getElementById("modal-register-aid");
        if (modal) {
            modal.style.display = "flex";
            // Reset form
            document.getElementById("form-register-aid").reset();
            document.getElementById("aid-date").valueAsDate = new Date();
            document.getElementById("aid-location-display").innerHTML = '<span class="placeholder">위치 설정 필요</span>';
            state.selectedLocation = null;
            document.getElementById("aid-photo-preview").style.display = "none";
            document.getElementById("preview-img").src = "";
        }
    }

    function closeRegisterModal() {
        const modal = document.getElementById("modal-register-aid");
        if (modal) modal.style.display = "none";
    }

    // 위치 설정 모달
    function openLocationSelector() {
        const modal = document.getElementById("modal-aid-location");
        const container = document.getElementById("aid-storage-selector");
        if (modal && container) {
            modal.style.display = "flex";
            // Reuse StorageSelector
            // Assuming "EQUIPMENT" mode
            if (App.StorageSelector) {
                App.StorageSelector.init("aid-storage-selector", {}, "EQUIPMENT");
            }
        }
    }

    function closeLocationSelector() {
        const modal = document.getElementById("modal-aid-location");
        if (modal) modal.style.display = "none";

        // Check if location was selected
        if (App.StorageSelector && App.StorageSelector.getState) {
            const locState = App.StorageSelector.getState();
            // Minimal validation: need Area and Cabinet
            if (locState.area_id && locState.cabinet_id) {
                state.selectedLocation = locState;
                updateLocationDisplay(locState);
            }
        }
    }

    async function updateLocationDisplay(locState) {
        const display = document.getElementById("aid-location-display");
        if (!display) return;

        // We need names, not just IDs. StorageSelector state might have names if we improved it,
        // usually it stores IDs. We might need to fetch names or rely on StorageSelector exposing them.
        // Assuming StorageSelector.getState() returns names too or we fetch them.s
        // Actually, StorageSelector in kits.js seems to handle this by keeping state locally or fetching.
        // For simplicity, let's construct a string summary using what we have, or show "설정됨 (Area, Cabinet)".
        // Better: StorageSelector often returns objects with names if configured.
        // Let's assume we store the whole state object which usually mimics the location object structure.

        // Construct location object to match DB schema requirements (names) if possible.
        // But we plan to save the JSON. Ideally we also want names for display.
        // Let's just update the UI text for now.

        // Fetch names if missing? Or just display "위치 설정 완료"
        display.innerHTML = `<span class="val">위치 설정 완료</span>`;
        // Ideally show actual location.
        // If StorageSelector state provides names (it should if updated), usage is easier.
        // Checking storage-selector.js: it stores `area_id`.
        // Let's do a quick fetch or just proceed.
        // For now, simple text.
    }

    async function handleRegisterSubmit(e) {
        e.preventDefault();

        // Validate
        if (!state.selectedLocation) {
            alert("보관 위치를 설정해주세요.");
            return;
        }

        const category = document.getElementById("aid-class-select").value;
        const name = document.getElementById("aid-name-input").value;
        const quantity = parseInt(document.getElementById("aid-quantity").value) || 0;
        const date = document.getElementById("aid-date").value;
        const photoFile = document.getElementById("aid-photo").files[0];

        try {
            const supabase = App.supabase;

            // 1. Upload Photo if exists
            let imageUrl = null;
            if (photoFile) {
                const fileExt = photoFile.name.split('.').pop();
                const fileName = `aid_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('kit_photos') // Reusing kit_photos bucket? Or creating new? Let's use kit_photos for now.
                    .upload(fileName, photoFile);

                if (uploadError) throw uploadError;

                const { data: publicData } = supabase.storage
                    .from('kit_photos')
                    .getPublicUrl(fileName);
                imageUrl = publicData.publicUrl;
            }

            // 2. Resolve Location Names (Area Name, Cabinet Name) for storing in JSON
            // Since we only have IDs in state.selectedLocation, we might want to fetch names.
            // Or store IDs and names.
            // Let's fetch area and cabinet info to store rich location data.
            const { data: areaData } = await supabase.from('Area').select('name').eq('id', state.selectedLocation.area_id).single();
            const { data: cabinetData } = await supabase.from('EquipmentCabinet').select('name').eq('id', state.selectedLocation.cabinet_id).single(); // Table name might be Cabinet or EquipmentCabinet?
            // Teaching aids use EquipmentCabinet? Kit used 'Cabinet' which was EquipmentCabinet in context of 'EQUIPMENT' mode?
            // Let's check storage-selector.js logic. (Step 37: loadCabinets looks at EquipmentCabinet if mode Equipment)

            const richLocation = {
                ...state.selectedLocation,
                area_name: areaData?.name,
                cabinet_name: cabinetData?.name
            };

            // 3. Insert ID
            const { error: insertError } = await supabase.from('teaching_aids').insert({
                name,
                category,
                quantity,
                purchase_date: date,
                location: richLocation,
                image_url: imageUrl
            });

            if (insertError) throw insertError;

            alert("교구가 등록되었습니다.");
            closeRegisterModal();
            await loadList();

        } catch (err) {
            console.error("❌ Register Error:", err);
            alert(`등록 실패: ${err.message}`);
        }
    }

    // ----------------------------------------------------------------
    // 4. 상세 (Detail)
    // ----------------------------------------------------------------
    async function loadDetail(id) {
        console.log(`🧩 Detail Load: ${id}`);
        state.currentDetailId = id;

        try {
            const supabase = App.supabase;

            // Fetch Aid
            const { data: aid, error } = await supabase
                .from('teaching_aids')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            // Render Detail Header
            document.getElementById('detail-aid-name').textContent = aid.name;
            document.getElementById('detail-aid-class').textContent = aid.category;

            // Render Info
            document.getElementById('detail-aid-quantity').textContent = aid.quantity;
            document.getElementById('detail-aid-location').textContent = formatLocation(aid.location);

            // Render Photo
            const photoBox = document.getElementById('detail-aid-photo');
            if (aid.image_url) {
                photoBox.innerHTML = `<img src="${aid.image_url}" alt="${aid.name}">`;
            } else {
                photoBox.innerHTML = `<span style="color:#ccc;">사진 없음</span>`;
            }

            // Fetch Logs
            loadUsageLogs(id);

            // Use Fab for Edit/Delete actions in Detail View?
            // Typically Floating Menu for Add/Subtract/Edit/Delete
            // setupDetailFab(aid);

        } catch (err) {
            console.error("Detail Error:", err);
            alert("상세 정보를 불러올 수 없습니다.");
        }
    }

    async function loadUsageLogs(aidId) {
        const supabase = App.supabase;
        const { data: logs, error } = await supabase
            .from('teaching_aid_usage_log')
            .select('*')
            .eq('teaching_aid_id', aidId)
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

    function setupDetailFab(aid) {
        if (!App.Fab) return;

        App.Fab.setMenu([
            {
                icon: "add",
                label: "반입(추가)",
                onClick: () => handleUsage(aid, 1) // Simple increment? Or prompt.
            },
            {
                icon: "remove",
                label: "사용(반출)",
                onClick: () => handleUsage(aid, -1)
            },
            {
                icon: "edit",
                label: "정보 수정",
                onClick: () => handleEdit(aid)
            },
            {
                icon: "delete",
                label: "삭제",
                onClick: () => handleDelete(aid)
            }
        ]);
        App.Fab.setVisibility(true);
    }

    async function handleUsage(aid, polarity) {
        const amountStr = prompt(`수량을 입력하세요 (${polarity > 0 ? '추가' : '사용'}).`, "1");
        if (!amountStr) return;

        let amount = parseInt(amountStr);
        if (isNaN(amount) || amount <= 0) {
            alert("유효한 수량을 입력하세요.");
            return;
        }

        const changeAmount = polarity * amount;
        const finalQuantity = aid.quantity + changeAmount;
        if (finalQuantity < 0) {
            alert("재고가 부족합니다.");
            return;
        }

        const reason = prompt("사유를 입력하세요 (선택)", "") || (polarity > 0 ? "반입" : "사용");

        try {
            const supabase = App.supabase;

            // 1. Insert Log
            await supabase.from('teaching_aid_usage_log').insert({
                teaching_aid_id: aid.id,
                change_amount: changeAmount,
                final_quantity: finalQuantity,
                reason: reason
            });

            // 2. Update Aid
            const { error } = await supabase
                .from('teaching_aids')
                .update({ quantity: finalQuantity })
                .eq('id', aid.id);

            if (error) throw error;

            // Reload
            loadDetail(aid.id);

        } catch (err) {
            alert("처리 중 오류가 발생했습니다.");
            console.error(err);
        }
    }

    async function handleDelete(aid) {
        if (!confirm(`'${aid.name}' 교구를 정말 삭제하시겠습니까?`)) return;

        try {
            const supabase = App.supabase;
            const { error } = await supabase.from('teaching_aids').delete().eq('id', aid.id);
            if (error) throw error;

            alert("삭제되었습니다.");
            App.Router.go("teachingAids");
        } catch (err) {
            alert("삭제 실패");
            console.error(err);
        }
    }

    function handleEdit(aid) {
        alert("수정 기능은 아직 구현되지 않았습니다. (등록 로직 재사용 필요)");
        // To implement: Open register modal, populate fields, switch 'submit' handler to 'update'
    }

    // ================================================================
    // Public Interface
    // ================================================================
    globalThis.App.TeachingAids = {
        init,
        loadList,
        loadDetail
    };
})();
