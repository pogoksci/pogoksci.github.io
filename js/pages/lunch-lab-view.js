// /js/pages/lunch-lab-view.js
(function () {
    const LunchLabView = {};

    // State
    let selectedDate = new Date();
    let weekDates = [];
    let currentRoomId = ""; // "" means ALL rooms
    let allRooms = [];
    let roomMap = {};

    const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

    LunchLabView.init = async function () {
        console.log("🍱 Lunch Lab View Init (Calendar Mode)");

        // 1. Reset State
        selectedDate = new Date();
        weekDates = []; // reset

        // 2. Bind Elements & Setup UI FIRST (Always render UI)
        try {
            const monthSel = document.getElementById('lunch-month-select');

            // Listeners
            if (monthSel) monthSel.onchange = (e) => {
                const m = parseInt(e.target.value);
                const y = selectedDate.getFullYear();
                selectedDate = new Date(y, m - 1, 1);
                updateWeekLabel();
                refresh();
            };

            const btnPrev = document.getElementById('btn-prev-week');
            if (btnPrev) btnPrev.onclick = () => { selectedDate.setDate(selectedDate.getDate() - 7); updateWeekLabel(); refresh(); };

            const btnNext = document.getElementById('btn-next-week');
            if (btnNext) btnNext.onclick = () => { selectedDate.setDate(selectedDate.getDate() + 7); updateWeekLabel(); refresh(); };

            const btnToday = document.getElementById('btn-today');
            if (btnToday) btnToday.onclick = () => { selectedDate = new Date(); updateWeekLabel(); refresh(); };

            // Initial UI Logic
            initMonthSelect();
            updateWeekLabel(); // Determines weekDates

            // Render Empty Grid first (so headers appear)
            // We'll call refresh() which does header rendering, but safely
            await refresh();

        } catch (e) {
            console.error("UI Setup failed:", e);
        }

        // 3. Load Dependencies (Supabase) & Data
        const supabase = globalThis.App?.supabase;
        if (!supabase) {
            console.warn("Supabase not found. UI initialized without data.");
            return;
        }

        // 4. Load Data (Parallel)
        try {
            // refresh() was called above, but maybe called again with data? 
            // actually refresh() usually fetches data. 
            // Let's just load rooms here. refresh() inside will check supabase.
            await loadRooms();
            // Re-fetch with rooms populated
            await refresh();
        } catch (err) {
            console.error("Data load failed:", err);
        }
    };

    async function loadRooms() {
        const supabase = globalThis.App?.supabase;
        const { data } = await supabase.from('lab_rooms').select('*').order('sort_order');
        allRooms = data || [];
        roomMap = {};
        allRooms.forEach(r => roomMap[r.id] = r.room_name);

        const sel = document.getElementById('lunch-room-select');
        if (sel) {
            sel.innerHTML = '<option value="">전체 과학실</option>' +
                allRooms.map(r => `<option value="${r.id}">${r.room_name}</option>`).join('');
        }
    }

    function initMonthSelect() {
        const sel = document.getElementById('lunch-month-select');
        if (!sel) return;
        const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        // Sort for school year? 3,4...1,2. But simple 1-12 is fine for now or match user pref.
        // Let's stick to 1-12 or similar to lab-usage-log if requested. Lab usage log does 3..2.
        // For simplicity here, let's do 1..12 unless user specified school year order.
        // Let's follow lab-usage-log style: 3..12, 1, 2
        const schoolMonths = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
        sel.innerHTML = schoolMonths.map(m => `<option value="${m}">${m}월</option>`).join('');
        sel.value = selectedDate.getMonth() + 1;
    }

    function updateWeekLabel() {
        const label = document.getElementById('current-week-label');
        const day = selectedDate.getDay();
        const diffToMon = (day === 0 ? -6 : 1 - day);
        const mon = new Date(selectedDate);
        mon.setDate(selectedDate.getDate() + diffToMon);

        weekDates = [];
        // User requested Mon-Fri only
        for (let i = 0; i < 5; i++) {
            const d = new Date(mon);
            d.setDate(mon.getDate() + i);
            weekDates.push(d);
        }

        if (label) {
            const fmt = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
            // Show Mon ~ Fri
            label.textContent = `${fmt(weekDates[0])} ~ ${fmt(weekDates[4])}`;
        }
    }

    async function refresh() {
        const supabase = globalThis.App?.supabase;

        // Safety Check
        if (!weekDates || weekDates.length === 0) {
            console.warn("Refresh called but weekDates is empty. Skipping.");
            return;
        }

        // Render Header Dates
        const headRow = document.getElementById('usage-grid-header');
        if (headRow) {
            headRow.innerHTML = '<th style="width: 60px; text-align:center;">과학실</th>'; // Changed width to 60px
            weekDates.forEach(d => {
                const day = d.getDay();

                const isToday = d.toDateString() === new Date().toDateString();
                const th = document.createElement('th');
                if (isToday) th.classList.add('is-today');
                th.innerHTML = `<span class="date-num">${d.getDate()}</span><span class="day-text">${DAY_LABELS[day]}요일</span>`;
                headRow.appendChild(th);
            });
        }

        // Fetch Data
        const start = weekDates[0].toISOString().split('T')[0];
        const end = weekDates[weekDates.length - 1].toISOString().split('T')[0];

        let query = supabase.from('lab_usage_log')
            .select('*')
            .eq('period', '99') // Lunch
            .gte('usage_date', start)
            .lte('usage_date', end);

        // Remove Room Filter Logic (Show all rooms)

        const { data, error } = await query;
        if (error) {
            console.error(error);
            // Even on error, render empty body to show grid structure
            renderBody([]);
            return;
        }

        renderBody(data || []);
    }

    function renderBody(logs) {
        const body = document.getElementById('usage-grid-body');
        if (!body) return;
        body.innerHTML = '';

        // Iterate over ALL ROOMS to create rows
        allRooms.forEach(room => {
            const tr = document.createElement('tr');

            // Room Name Column
            const tdRoom = document.createElement('td');
            tdRoom.className = 'period-col'; // Reuse style for simplicity
            tdRoom.textContent = room.room_name;
            tr.appendChild(tdRoom);

            weekDates.forEach(date => {
                const dateStr = date.toISOString().split('T')[0];
                const td = document.createElement('td');

                // Filter logs for this Room AND this Date
                const cellLogs = logs.filter(l => l.usage_date === dateStr && l.lab_room_id === room.id);

                const container = document.createElement('div');
                container.className = 'activity-container';

                cellLogs.forEach(log => {
                    const item = document.createElement('div');

                    // Status mapping
                    let statusClass = 'status-pending';
                    if (log.remarks === '승인') statusClass = 'status-approved';
                    if (log.remarks === '거절') statusClass = 'status-rejected';

                    item.className = `activity-item ${statusClass}`;

                    // No need to show Room Name inside the card anymore since it's the row header
                    // Show Applicant or Activity Type instead?
                    // User request didn't specify, but "Activity" or "Applicant" is useful.
                    // Let's keep it simple: Content or Activity Type.

                    // Update content: Removed Room Name from card header
                    item.innerHTML = `
                        <div class="act-content" title="${log.content || ''}" style="margin-top:0;">
                             ${log.content || (log.activity_type + ' 활동')}
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:4px;">
                            <span class="badge-status" style="background:${getStatusColor(log.remarks)}; color:#fff;">${log.remarks || '신청중'}</span>
                        </div>
                    `;

                    item.onclick = () => alertDetail(log);

                    container.appendChild(item);
                });

                td.appendChild(container);
                tr.appendChild(td);
            });

            body.appendChild(tr);
        });
    }

    function getStatusColor(status) {
        if (status === '승인') return '#4caf50'; // Green
        if (status === '거절') return '#f44336'; // Red
        return '#ff9800'; // Orange (Pending)
    }

    function alertDetail(log) {
        // Simple alert for detail for now, or we can make a modal if requested.
        // User didn't explicitly ask for detail view, just the calendar view.
        // Showing content is enough.
        const roomName = roomMap[log.lab_room_id] || '-';
        alert(`[${roomName}] ${log.usage_date}\n\n상태: ${log.remarks || '신청중'}\n\n내용:\n${log.content}`);
    }

    globalThis.App = globalThis.App || {};
    globalThis.App.LunchLabView = LunchLabView;
})();
