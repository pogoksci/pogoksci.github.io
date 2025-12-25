// /js/pages/lab-usage-log.js
(function () {
    const LabUsageLog = {};

    // State
    let currentSemesterId = null;
    let currentRoomId = null;
    let selectedDate = new Date(); // Anchor date for the week
    let weekDates = []; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    let showWeekend = false;
    let allSemesters = [];

    let subjectMap = {};
    let teacherMap = {};
    let clubMap = {};
    let allSubjects = [];
    let allTeachers = [];
    let allClubs = [];
    let allClassCounts = {}; // grade -> count

    const PERIODS = [1, 2, 3, 4, '점심', 5, 6, 7, '방과후'];
    const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

    LabUsageLog.init = async function (options = {}) {
        const readOnly = options.readOnly || false;
        console.log("📅 Lab Usage Log Init", readOnly ? "(Read-Only)" : "(Edit)");

        // Ensure Supabase is available
        const supabase = globalThis.App?.supabase;
        if (!supabase) {
            console.error("❌ Supabase client not initialized.");
            alert("시스템 초기화 오류: 데이터베이스를 불러올 수 없습니다.");
            return;
        }

        // Reset State
        selectedDate = new Date();

        // Elements
        const semSelect = document.getElementById('usage-semester-select');
        const roomSelect = document.getElementById('usage-room-select');
        const monthSelect = document.getElementById('usage-month-select');
        const btnPrev = document.getElementById('btn-prev-week');
        const btnNext = document.getElementById('btn-next-week');
        const btnToday = document.getElementById('btn-today');
        const btnSave = document.getElementById('btn-save-usage-log');
        const weekendToggle = document.getElementById('show-weekend-toggle');

        // UI Adjustments for Read-Only
        if (btnSave) btnSave.style.display = readOnly ? 'none' : 'block';
        const pageTitle = document.querySelector('#lab-usage-log-page h2');
        if (pageTitle) pageTitle.textContent = readOnly ? '과학실 사용기록 조회' : '과학실 사용기록·예약';

        // 1. Initial Load
        try {
            await loadSemesters();
            await loadRooms();
            await loadAllMaps();

            initMonthSelect();
            updateWeekLabel();

            // 2. Listeners
            if (semSelect) {
                semSelect.onchange = async (e) => {
                    currentSemesterId = e.target.value;
                    await loadAllMaps();
                    refresh();
                };
            }
            if (roomSelect) {
                roomSelect.onchange = (e) => {
                    currentRoomId = e.target.value;
                    refresh();
                };
            }
            if (monthSelect) {
                monthSelect.onchange = (e) => {
                    const m = parseInt(e.target.value);
                    const y = selectedDate.getFullYear();
                    selectedDate = new Date(y, m - 1, 1);
                    updateWeekLabel();
                    refresh();
                };
            }

            if (btnPrev) btnPrev.onclick = () => { selectedDate.setDate(selectedDate.getDate() - 7); updateWeekLabel(); refresh(); };
            if (btnNext) btnNext.onclick = () => { selectedDate.setDate(selectedDate.getDate() + 7); updateWeekLabel(); refresh(); };
            if (btnToday) btnToday.onclick = () => { selectedDate = new Date(); updateWeekLabel(); refresh(); };
            if (btnSave) btnSave.onclick = () => saveWeeklyLog();
            if (weekendToggle) {
                weekendToggle.onchange = (e) => {
                    showWeekend = e.target.checked;
                    refresh();
                };
                weekendToggle.checked = showWeekend;
            }

            // Initial Data Fetch
            await refresh();
        } catch (err) {
            console.error("❌ Initialization failed:", err);
        }

        // --- Inner Functions ---
        function getYYYYMMDD(date) {
            if (!date) return '';
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        async function loadSemesters() {
            console.log("📥 Loading all semesters...");
            const { data, error } = await supabase.from('lab_semesters').select('*').order('start_date', { ascending: false });
            if (error) throw error;
            if (data && data.length > 0) {
                allSemesters = data; // Store globally
                const todayStr = getYYYYMMDD(new Date());
                const currentSem = data.find(s => todayStr >= s.start_date && todayStr <= s.end_date) || data[0];
                if (currentSem) {
                    currentSemesterId = currentSem.id;
                    if (semSelect) semSelect.value = currentSemesterId;
                    console.log(`✅ Initial Semester set to: ${currentSem.name} (ID: ${currentSemesterId})`);
                }
            }
        }

        async function loadRooms() {
            const { data, error } = await supabase.from('lab_rooms').select('*').order('sort_order');
            if (error) throw error;
            if (roomSelect && data) {
                roomSelect.innerHTML = data.map(r => `<option value="${r.id}">${r.room_name}</option>`).join('');
                if (data.length > 0) {
                    currentRoomId = data[0].id;
                    roomSelect.value = currentRoomId;
                }
            }
        }

        async function loadAllMaps(semesterIds) {
            if (!semesterIds || semesterIds.length === 0) return;

            const [subjs, techs, clubs, counts] = await Promise.all([
                supabase.from('lab_subjects').select('*').in('semester_id', semesterIds).order('name'),
                supabase.from('lab_teachers').select('*').in('semester_id', semesterIds).order('name'),
                supabase.from('lab_clubs').select('*').in('semester_id', semesterIds).order('name'),
                supabase.from('lab_class_counts').select('*').in('semester_id', semesterIds)
            ]);

            allSubjects = subjs.data || [];
            allTeachers = techs.data || [];
            allClubs = clubs.data || [];

            // Re-initialize maps
            subjectMap = {}; allSubjects.forEach(s => subjectMap[s.id] = s.name);
            teacherMap = {}; allTeachers.forEach(t => teacherMap[t.id] = t.name);
            clubMap = {}; allClubs.forEach(c => clubMap[c.id] = c.name);

            // Class counts (use the latest for the current week context)
            allClassCounts = {};
            if (counts.data) {
                counts.data.forEach(c => {
                    // In case of multiple semesters in a week, the latest count for that grade wins
                    allClassCounts[c.grade] = Math.max(allClassCounts[c.grade] || 0, c.class_count);
                });
            }
        }

        function initMonthSelect() {
            if (!monthSelect) return;
            const months = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
            monthSelect.innerHTML = months.map(m => `<option value="${m}">${m}월</option>`).join('');
            monthSelect.value = selectedDate.getMonth() + 1;
        }

        function updateWeekLabel() {
            const label = document.getElementById('current-week-label');
            const day = selectedDate.getDay();
            const diffToMon = (day === 0 ? -6 : 1 - day);
            const mon = new Date(selectedDate);
            mon.setDate(selectedDate.getDate() + diffToMon);
            weekDates = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(mon);
                d.setDate(mon.getDate() + i);
                weekDates.push(d);
            }
            if (label) {
                const fmt = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${DAY_LABELS[d.getDay()]})`;
                const fmtShort = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일(${DAY_LABELS[d.getDay()]})`;
                label.textContent = `${fmt(mon)} ~ ${fmtShort(weekDates[6])}`;
            }
        }

        function getShortSubjectName(fullName) {
            if (!fullName) return '과목';
            const config = globalThis.App?.SubjectConfig;
            if (!config) return fullName.substring(0, 4);

            let baseNick = '';
            for (const [base, info] of Object.entries(config.BASES)) {
                if (info.aliases.some(alias => fullName.includes(alias))) {
                    baseNick = info.aliases[0]; // First nickname (2 letters)
                    break;
                }
            }

            if (!baseNick) return fullName.substring(0, 4);

            let levelIndicator = '';
            const allLevelAliases = [...config.LEVELS['I'], ...config.LEVELS['II']];
            // Sort by length desc to match II before I
            const sortedAliases = allLevelAliases.sort((a, b) => b.length - a.length);
            for (const alias of sortedAliases) {
                if (fullName.includes(alias)) {
                    levelIndicator = alias;
                    break;
                }
            }
            return baseNick + levelIndicator;
        }

        function findSemesterForDate(date) {
            const dStr = getYYYYMMDD(date);
            let sem = allSemesters.find(s => {
                let sDate = s.start_date;
                let eDate = s.end_date;

                const yearMatch = s.name.match(/\d{4}/);
                if (yearMatch) {
                    const year = parseInt(yearMatch[0]);
                    if (!sDate) sDate = `${year}-03-01`;
                    if (!eDate) eDate = `${year + 1}-02-28`;
                }

                sDate = sDate || '0000-00-00';
                eDate = eDate || '9999-12-31';
                return dStr >= sDate && dStr <= eDate;
            });
            if (!sem) {
                const past = allSemesters.filter(s => {
                    let sd = s.start_date;
                    const ym = s.name.match(/\d{4}/);
                    if (!sd && ym) sd = `${ym[0]}-03-01`;
                    return sd && sd <= dStr;
                }).sort((a, b) => {
                    let sda = a.start_date;
                    let sdb = b.start_date;
                    const yma = a.name.match(/\d{4}/);
                    const ymb = b.name.match(/\d{4}/);
                    if (!sda && yma) sda = `${yma[0]}-03-01`;
                    if (!sdb && ymb) sdb = `${ymb[0]}-03-01`;
                    return (sdb || '').localeCompare(sda || '');
                });
                sem = past[0] || allSemesters[0];
            }
            return sem;
        }

        async function refresh() {
            if (!currentRoomId || !allSemesters || allSemesters.length === 0) return;

            // 1. Identify all semesters involved in this week
            const weekSemesterMap = new Map(); // Date string -> Semester Object
            const weekSemesterIds = new Set();

            weekDates.forEach(d => {
                const sem = findSemesterForDate(d);
                if (sem) {
                    weekSemesterMap.set(getYYYYMMDD(d), sem);
                    weekSemesterIds.add(sem.id);
                }
            });

            const semesterIdList = Array.from(weekSemesterIds);

            // 2. Load maps for all semesters in the week
            await loadAllMaps(semesterIdList);

            // 3. Update Sidebar/Header with current semester (Priority: latest semester in the week)
            let displaySem = null;
            for (let i = weekDates.length - 1; i >= 0; i--) {
                const s = weekSemesterMap.get(getYYYYMMDD(weekDates[i]));
                if (s) {
                    displaySem = s;
                    break;
                }
            }
            if (!displaySem) displaySem = allSemesters[0];

            currentSemesterId = displaySem?.id;

            const semDisplay = document.getElementById('current-semester-display');
            if (semDisplay && displaySem) {
                const yearMatch = displaySem.name.match(/\d{4}/);
                const year = yearMatch ? parseInt(yearMatch[0]) : 2025;
                const sD = displaySem.start_date || `${year}-03-01`;
                const eD = displaySem.end_date || `${year + 1}-02-28`;
                semDisplay.textContent = `현재 학기: ${displaySem.name} (학기 기간: ${sD} ~ ${eD})`;
                semDisplay.style.color = '#888';
            }

            renderHeader();
            const [templates, logs] = await Promise.all([fetchTemplates(semesterIdList), fetchLogs()]);
            renderGrid(templates, logs, weekSemesterMap);
        }

        function renderHeader() {
            const headRow = document.getElementById('usage-grid-header');
            if (!headRow) return;
            headRow.innerHTML = '<th style="width: 80px;">교시</th>';
            weekDates.forEach(d => {
                const day = d.getDay();
                if (!showWeekend && (day === 0 || day === 6)) return; // Skip Sat, Sun

                const isToday = d.toDateString() === new Date().toDateString();
                const th = document.createElement('th');
                th.className = isToday ? 'is-today' : '';
                th.innerHTML = `<span class="date-num">${d.getDate()}</span><span class="day-text">${DAY_LABELS[d.getDay()]}요일</span>`;
                headRow.appendChild(th);
            });
        }

        async function fetchTemplates(semesterIds) {
            if (!semesterIds || semesterIds.length === 0) return [];
            const { data } = await supabase.from('lab_timetables').select('*').in('semester_id', semesterIds);
            return data || [];
        }

        async function fetchLogs() {
            const start = weekDates[0].toISOString().split('T')[0];
            const end = weekDates[6].toISOString().split('T')[0];
            const { data } = await supabase.from('lab_usage_log')
                .select('*')
                .eq('lab_room_id', currentRoomId)
                .gte('usage_date', start)
                .lte('usage_date', end)
                // Filter: Show only Approved (or null for legacy data without status)
                // Using .or() for (remarks.eq.승인, remarks.is.null) is complex in chaining depending on SDK version.
                // Simple approach: Fetch all, then filter in memory (safer for complex OR logic if volume isn't huge),
                // OR use a specific query. Let's start with inclusive filter or memory filter since dataset is small.
                // Actually, let's just fetch and filter in memory to be safe against syntax errors with mixed AND/OR.
                ;

            // Client-side filtering to ensure only Approved/Legacy are shown
            return (data || []).filter(item => !item.remarks || item.remarks === '승인');
        }

        function renderGrid(templates, logs, weekSemesterMap) {
            const body = document.getElementById('usage-grid-body');
            if (!body) return;
            body.innerHTML = '';
            PERIODS.forEach(p => {
                const tr = document.createElement('tr');
                if ([2, 4, 5, 7].includes(p)) {
                    tr.classList.add('period-highlight');
                }
                const tdPeriod = document.createElement('td');
                tdPeriod.className = 'period-col';
                if (p === '점심' || p === '방과후') {
                    tdPeriod.textContent = p;
                } else {
                    tdPeriod.textContent = `${p}교시`;
                }
                tr.appendChild(tdPeriod);

                let dbPeriod = String(p);
                if (p === '점심') dbPeriod = '99';
                if (p === '방과후') dbPeriod = '88';

                weekDates.forEach((date) => {
                    const day = date.getDay();
                    if (!showWeekend && (day === 0 || day === 6)) return; // Skip Sat, Sun

                    const td = document.createElement('td');
                    const dateStr = getYYYYMMDD(date);
                    const dayNameMon = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
                    const daySem = weekSemesterMap.get(dateStr);

                    // Filter logs for this ROOM, DATE, and PERIOD
                    const cellLogs = logs.filter(l => l.usage_date === dateStr && String(l.period) === dbPeriod);

                    // Filter templates for this DAY, PERIOD, and the SPECIFIC SEMESTER of this day
                    const cellTemplates = templates.filter(t =>
                        t.day_of_week === dayNameMon &&
                        String(t.period) === dbPeriod &&
                        daySem && String(t.semester_id) === String(daySem.id)
                    );

                    const container = document.createElement('div');
                    container.className = 'activity-container';
                    td.appendChild(container);

                    const items = [];

                    // 1. First, add items from LOGS (already recorded activities)
                    cellLogs.forEach(l => {
                        items.push({ type: 'LOG', data: l, checked: true });
                    });

                    // 2. Add potential classes from TEMPLATES (Only those not already in logs)
                    cellTemplates.forEach(t => {
                        // Check if this specific class/teacher is already in logs for this room/date/period
                        // Since multiple teachers might have same grade/class, teacher_id + subject_id + grade + class_number is the unique combo.
                        const isAlreadyLogged = cellLogs.some(l =>
                            l.teacher_id === t.teacher_id &&
                            l.subject_id === t.subject_id &&
                            l.grade === t.grade &&
                            l.class_number === t.class_number
                        );

                        if (!isAlreadyLogged) {
                            items.push({
                                type: 'TEMPLATE',
                                data: {
                                    ...t,
                                    activity_type: '교과수업',
                                    safety_education: '실시',
                                    usage_date: dateStr,
                                    period: dbPeriod
                                },
                                checked: false
                            });
                        }
                    });

                    // 3. Sort items: Grade -> Class -> Subject Name (Ascending)
                    items.sort((a, b) => {
                        const da = a.data;
                        const db = b.data;
                        if (da.grade !== db.grade) return (da.grade || 0) - (db.grade || 0);
                        if (da.class_number !== db.class_number) return (da.class_number || 0) - (db.class_number || 0);
                        const sNameA = subjectMap[da.subject_id] || '';
                        const sNameB = subjectMap[db.subject_id] || '';
                        return sNameA.localeCompare(sNameB);
                    });

                    items.forEach(item => {
                        const el = createActivityItem(item, readOnly);
                        container.appendChild(el);
                    });

                    if (!readOnly) {
                        const btnAdd = document.createElement('button');
                        btnAdd.className = 'btn-add-activity';
                        btnAdd.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">add</span>활동 추가';
                        btnAdd.onclick = () => showAddActivityForm(container, btnAdd, dateStr, dbPeriod);
                        td.appendChild(btnAdd);
                    }
                    tr.appendChild(td);
                });
                body.appendChild(tr);
            });
        }

        function createActivityItem(item, isReadOnly) {
            const div = document.createElement('div');
            div.className = `activity-item ${item.checked ? 'checked' : ''}`;
            if (isReadOnly) div.style.cursor = 'default';
            div.dataset.item = JSON.stringify(item.data);

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = item.checked;
            cb.disabled = isReadOnly;
            cb.onclick = (e) => e.stopPropagation();
            cb.onchange = (e) => div.classList.toggle('checked', e.target.checked);
            div.appendChild(cb);

            const info = document.createElement('span');
            info.className = 'activity-info';
            const d = item.data;
            let text = "";
            if (d.activity_type === '교과수업' || d.activity_type === '교과_수업') {
                const sFullName = subjectMap[d.subject_id] || '';
                const sShort = getShortSubjectName(sFullName);
                const grade = d.grade || '';
                const cls = (d.class_number !== undefined && d.class_number !== null) ? String(d.class_number).padStart(2, '0') : '';
                text = `${grade}${cls}${sShort}`;
                info.title = `풀네임: ${sFullName}\n학기ID: ${currentSemesterId}`;
            } else if (d.activity_type === '동아리') {
                text = clubMap[d.club_id] || '동아리';
            } else {
                text = d.content || '활동';
            }
            info.textContent = text;
            info.style.marginLeft = '4px';
            info.style.fontSize = '12px';
            info.style.color = '#333';
            div.appendChild(info);

            div.oncontextmenu = (e) => {
                if (isReadOnly) return;
                e.preventDefault();
                if (confirm('이 항목을 삭제하시겠습니까?')) div.remove();
            };

            if (isReadOnly && !item.checked) {
                div.style.display = 'none';
            }

            return div;
        }

        function showAddActivityForm(container, btnAdd, date, period) {
            btnAdd.style.display = 'none';
            const form = document.createElement('div');
            form.className = 'activity-add-form';
            form.innerHTML = `
                <select class="sel-type"><option value="">유형 선택</option><option value="교과수업">교과수업</option><option value="동아리">동아리</option><option value="행사">행사</option><option value="기타">기타</option></select>
                <div class="form-fields"></div>
                <div style="display:flex; gap:4px;">
                    <button class="btn-confirm btn-primary" style="flex:1; padding:4px; font-size:12px;">확인</button>
                    <button class="btn-cancel btn-secondary" style="flex:1; padding:4px; font-size:12px;">취소</button>
                </div>
            `;
            const selType = form.querySelector('.sel-type');
            const fields = form.querySelector('.form-fields');

            selType.onchange = (e) => {
                const type = e.target.value;
                fields.innerHTML = '';
                if (type === '교과수업') {
                    fields.innerHTML = `
                            <select class="sel-grade"><option value="">학년 선택</option><option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option></select>
                        <select class="sel-class" style="margin-top:4px;"><option value="">반 선택</option></select>
                        <select class="sel-subject" style="margin-top:4px;"><option value="">과목 선택</option></select>
                        <select class="sel-teacher" style="margin-top:4px;"><option value="">교사 선택</option>${allTeachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select>
                    `;
                    const selGrade = fields.querySelector('.sel-grade');
                    const selClass = fields.querySelector('.sel-class');
                    const selSubject = fields.querySelector('.sel-subject');

                    selGrade.onchange = () => {
                        const grade = parseInt(selGrade.value);

                        // 1. Populate Class
                        selClass.innerHTML = '<option value="">반 선택</option>';
                        if (grade) {
                            const maxClass = allClassCounts[grade] || 15;
                            for (let i = 1; i <= maxClass; i++) {
                                selClass.innerHTML += `<option value="${i}">${i}반</option>`;
                            }
                        }

                        // 2. Populate (Filter) Subjects
                        selSubject.innerHTML = '<option value="">과목 선택</option>';
                        if (grade) {
                            const filtered = allSubjects.filter(s => {
                                const expectedGrade = getGradeForSubject(s.name);
                                return !expectedGrade || expectedGrade === grade;
                            });
                            selSubject.innerHTML += filtered.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                        } else {
                            selSubject.innerHTML += allSubjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                        }
                    };

                    // Trigger initial subject load if no grade is selected
                    selSubject.innerHTML = '<option value="">과목 선택</option>' + allSubjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                } else if (type === '동아리') {
                    fields.innerHTML = `<select class="sel-club"><option value="">동아리 선택</option>${allClubs.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>`;
                } else if (type === '행사' || type === '기타') {
                    fields.innerHTML = `<input type="text" class="sel-content" placeholder="활동명 입력">`;
                }
            };

            const btnCancel = form.querySelector('.btn-cancel');
            btnCancel.onclick = () => {
                form.remove();
                btnAdd.style.display = 'flex';
            };

            form.querySelector('.btn-confirm').onclick = () => {
                const type = selType.value;
                if (!type) { alert('유형을 선택해주세요.'); return; }
                const newItem = {
                    activity_type: type,
                    usage_date: date,
                    period: String(period),
                    safety_education: '실시'
                };
                if (type === '교과수업') {
                    const grade = form.querySelector('.sel-grade').value;
                    const classNum = form.querySelector('.sel-class').value;
                    const subjId = form.querySelector('.sel-subject').value;
                    const techId = form.querySelector('.sel-teacher').value;
                    if (!grade || !subjId || !techId) { alert('모든 정보를 입력해주세요.'); return; }
                    newItem.grade = grade;
                    newItem.class_number = classNum;
                    newItem.subject_id = subjId;
                    newItem.teacher_id = techId;
                } else if (type === '동아리') {
                    const clubId = form.querySelector('.sel-club').value;
                    if (!clubId) { alert('동아리를 선택해주세요.'); return; }
                    newItem.club_id = clubId;
                } else {
                    const content = form.querySelector('.sel-content').value;
                    if (!content) { alert('활동명을 입력해주세요.'); return; }
                    newItem.content = content;
                }
                const itemEl = createActivityItem({ type: 'LOG', data: newItem, checked: true }, false);
                container.appendChild(itemEl);
                form.remove();
                btnAdd.style.display = 'flex';
            };
            container.appendChild(form);
        }

        async function saveWeeklyLog() {
            // ... (rest of function)
        }

        function getGradeForSubject(fullName) {
            const config = globalThis.App?.SubjectConfig;
            if (!config) return null;

            // 1. Identify Base Subject
            let baseInfo = null;
            for (const [base, info] of Object.entries(config.BASES)) {
                if (info.aliases.some(alias => fullName.includes(alias))) {
                    baseInfo = info;
                    break;
                }
            }
            if (!baseInfo) return null;

            // 2. Check level-based grades (Priority: suffixes like I, II, 1, 2)
            if (baseInfo.level_grades) {
                let levelFound = '';
                const allLevelAliases = [...config.LEVELS['I'], ...config.LEVELS['II']];
                const sortedAliases = allLevelAliases.sort((a, b) => b.length - a.length);
                for (const alias of sortedAliases) {
                    if (fullName.includes(alias)) {
                        if (config.LEVELS['I'].includes(alias)) levelFound = 'I';
                        else if (config.LEVELS['II'].includes(alias)) levelFound = 'II';
                        break;
                    }
                }
                if (levelFound && baseInfo.level_grades[levelFound]) {
                    return baseInfo.level_grades[levelFound];
                }
            }

            // 3. Check direct default grades
            if (baseInfo.grades) return baseInfo.grades[0];

            return null;
        }
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.LabUsageLog = LabUsageLog;
})();
