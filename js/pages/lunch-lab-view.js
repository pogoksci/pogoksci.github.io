// /js/pages/lunch-lab-view.js
(function () {
    const LunchLabInquiry = {};

    let roomMap = {};
    let lastSearchResult = [];

    // State
    const PERIOD_LUNCH = '99';

    LunchLabInquiry.init = async function () {
        console.log("🔍 Lunch Lab Inquiry Init");

        // 1. Load Rooms Map
        await loadRooms();

        // 2. Bind Filter Events
        const btnSearch = document.getElementById('btn-search-lunch');
        if (btnSearch) {
            btnSearch.onclick = search;
        }

        // 3. Set Default Date Range (This week)
        const startEl = document.getElementById('filter-date-start');
        const endEl = document.getElementById('filter-date-end');
        if (startEl && endEl) {
            const today = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(today.getDate() + 7);

            startEl.value = today.toISOString().split('T')[0];
            endEl.value = nextWeek.toISOString().split('T')[0];
        }

        // 4. Initial Search
        await search();
    };

    async function loadRooms() {
        const supabase = globalThis.App?.supabase;
        const { data } = await supabase.from('lab_rooms').select('id, room_name');
        if (data) {
            data.forEach(r => roomMap[r.id] = r.room_name);
        }
    }

    async function search() {
        const supabase = globalThis.App?.supabase;
        const status = document.getElementById('filter-status').value;
        const start = document.getElementById('filter-date-start').value;
        const end = document.getElementById('filter-date-end').value;

        // Query: Only Lunch Period ('99')
        let query = supabase.from('lab_usage_log')
            .select('*')
            .eq('period', PERIOD_LUNCH)
            .order('usage_date', { ascending: false });

        if (status && status !== 'all') {
            query = query.eq('remarks', status); // remarks stores status
        }
        if (start) query = query.gte('usage_date', start);
        if (end) query = query.lte('usage_date', end);

        const { data, error } = await query;
        if (error) {
            console.error("Search failed:", error);
            alert("조회 실패: " + error.message);
            return;
        }

        lastSearchResult = data || [];
        renderTable(lastSearchResult);
    }

    function renderTable(list) {
        const tbody = document.getElementById('lunch-list-body');
        const empty = document.getElementById('lunch-list-empty');

        if (!tbody) return;
        tbody.innerHTML = '';

        if (!list || list.length === 0) {
            empty.style.display = 'flex';
            return;
        }
        empty.style.display = 'none';

        const userRole = globalThis.App?.Auth?.user?.role;
        const canManage = ['admin', 'teacher'].includes(userRole);

        list.forEach(item => {
            const tr = document.createElement('tr');

            // Status Badge Color
            let badgeClass = 'secondary';
            if (item.remarks === '승인') badgeClass = 'success';
            else if (item.remarks === '거절') badgeClass = 'danger';
            else if (item.remarks === '보류') badgeClass = 'warning';
            else if (item.remarks === '신청중') badgeClass = 'primary'; // blue

            // Parse Content (Backward compatibility: show raw if simple, show parsed if complex)
            // But requirement said just put everything in content.
            // Let's display content as is, maybe truncating or styling.

            tr.innerHTML = `
                <td>${item.usage_date}</td>
                <td>${roomMap[item.lab_room_id] || '-'}</td>
                <td>${item.activity_type}</td>
                <td style="white-space: pre-wrap; font-size: 0.9em;">${statusColorFilter(item.content)}</td>
                <td><span class="badge badge-${badgeClass}">${item.remarks || '신청중'}</span></td>
                <td>
                    ${canManage ? renderActionButtons(item) : '-'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function statusColorFilter(text) {
        // Optional: Highlight key parts if needed, or just return text
        if (!text) return '';
        // Make "[...]" bold
        return text.replace(/\[(.*?)\]/g, '<strong>[$1]</strong>');
    }

    function renderActionButtons(item) {
        // If approved/rejected, maybe show fewer buttons or allow rollback?
        // Let's allow changing to any status except current

        const current = item.remarks || '신청중';
        let html = '<div style="display:flex; gap: 4px; flex-wrap: wrap;">';

        if (current !== '승인') {
            html += `<button class="btn-xs btn-success" onclick="App.LunchLabInquiry.updateStatus(${item.id}, '승인')">승인</button>`;
        }
        if (current !== '보류') {
            html += `<button class="btn-xs btn-warning" onclick="App.LunchLabInquiry.updateStatus(${item.id}, '보류')">보류</button>`;
        }
        if (current !== '거절') {
            html += `<button class="btn-xs btn-danger" onclick="App.LunchLabInquiry.updateStatus(${item.id}, '거절')">거절</button>`;
        }

        html += '</div>';
        return html;
    }

    LunchLabInquiry.updateStatus = async function (id, newStatus) {
        if (!confirm(`상태를 '${newStatus}'(으)로 변경하시겠습니까?`)) return;

        const supabase = globalThis.App?.supabase;
        const { error } = await supabase
            .from('lab_usage_log')
            .update({ remarks: newStatus })
            .eq('id', id);

        if (error) {
            console.error("Update failed:", error);
            alert("상태 변경 실패: " + error.message);
        } else {
            // Refresh
            search();
        }
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.LunchLabInquiry = LunchLabInquiry;
})();
