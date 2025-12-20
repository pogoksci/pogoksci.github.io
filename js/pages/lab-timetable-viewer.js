
(function () {
    const TimetableViewer = {};
    let currentSemesterId = null;

    // Configuration
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const DAY_LABELS = { 'Mon': '월', 'Tue': '화', 'Wed': '수', 'Thu': '목', 'Fri': '금' };
    const PERIODS = [1, 2, 3, 4, 'LUNCH', 5, 6, 7]; // 7 Periods

    TimetableViewer.init = async function () {
        console.log("📅 Timetable Viewer Init");
        const supabase = App.supabase || window.supabaseClient;

        // 1. Get Semester ID from URL
        const params = new URLSearchParams(window.location.search);
        currentSemesterId = params.get('semesterId');
        
        if (!currentSemesterId) {
            // Try to find the latest semester
             const { data } = await supabase.from('lab_semesters').select('*').order('created_at', { ascending: false }).limit(1);
             if(data && data.length > 0) currentSemesterId = data[0].id;
        }

        // Elements
        const gridContainer = document.getElementById('viewer-grid');
        const semesterLabel = document.getElementById('semester-name');
        const btnBack = document.getElementById('btn-back');

        if(btnBack) {
            btnBack.addEventListener('click', () => {
                window.history.back();
            });
        }

        if(!currentSemesterId) {
            alert('학년도 정보가 없습니다.');
            return;
        }

        // 2. Fetch Data
        await loadData(supabase);

        async function loadData(supabase) {
            // Semester Info
            const { data: sem } = await supabase.from('lab_semesters').select('name').eq('id', currentSemesterId).single();
            if(sem && semesterLabel) semesterLabel.textContent = sem.name;

            // Teachers
            const { data: teachers } = await supabase.from('lab_teachers').select('*').eq('semester_id', currentSemesterId).order('name');
            
            // Subjects (for name mapping)
            const { data: subjects } = await supabase.from('lab_subjects').select('*').eq('semester_id', currentSemesterId);
            const subjectMap = {};
            subjects.forEach(s => subjectMap[s.id] = s.name);

            // Timetables (All)
            const { data: timetables } = await supabase.from('lab_timetables').select('*').eq('semester_id', currentSemesterId);
            
            // Organize Data: { teacherId: { 'Mon': { 1: { ... }, 2: { ... } } } }
            const scheduleMap = {};
            
            timetables.forEach(t => {
                if(!scheduleMap[t.teacher_id]) scheduleMap[t.teacher_id] = {};
                if(!scheduleMap[t.teacher_id][t.day]) scheduleMap[t.teacher_id][t.day] = {};
                
                // Map DB period to Row Key if necessary, or just use period directly
                scheduleMap[t.teacher_id][t.day][t.period] = t;
            });

            // Render
            renderGrid(teachers, scheduleMap, subjectMap);
        }

        function renderGrid(teachers, scheduleMap, subjectMap) {
            gridContainer.innerHTML = '';
            
            teachers.forEach(teacher => {
                const card = createTeacherCard(teacher, scheduleMap[teacher.id] || {}, subjectMap);
                gridContainer.appendChild(card);
            });
        }

        function createTeacherCard(teacher, teacherSchedule, subjectMap) {
            const card = document.createElement('div');
            card.className = 'teacher-card';
            
            // Header
            const header = document.createElement('div');
            header.className = 'teacher-header';
            header.textContent = teacher.name;
            card.appendChild(header);
            
            // Content (Table)
            const table = document.createElement('table');
            table.className = 'mini-table';
            
            // Thead
            const thead = document.createElement('thead');
            const trHead = document.createElement('tr');
            trHead.innerHTML = '<th class="period-cell"></th>'; // Corner
            DAYS.forEach(d => {
                const th = document.createElement('th');
                th.textContent = DAY_LABELS[d];
                trHead.appendChild(th);
            });
            thead.appendChild(trHead);
            table.appendChild(thead);
            
            // Tbody
            const tbody = document.createElement('tbody');
            
            PERIODS.forEach(p => {
                const tr = document.createElement('tr');
                
                // Period Label
                const tdLabel = document.createElement('td');
                tdLabel.className = 'period-cell';
                if (p === 'LUNCH') {
                    tdLabel.textContent = ''; // Empty for Lunch? Or '점심'
                    tr.style.height = '10px'; // Thin divider
                    // Actually, if we want to mimic screenshot, remove lunch row or make it minimal
                    // Screenshot doesn't seem to show Lunch row prominently or at all within the grid periods?
                    // Actually, usually grids ignore lunch or have a break.
                    // Let's Skip Lunch row for cleaner visual? 
                    // Wait, Plan said 1-7. Lunch is usually between 4 and 5.
                    // Let's show a thin divider row.
                } else {
                    tdLabel.textContent = `${p}교시`;
                }
                tr.appendChild(tdLabel);
                
                // Days
                if (p === 'LUNCH') {
                     // Empty divider cells
                     DAYS.forEach(() => {
                         const td = document.createElement('td');
                         td.className = 'cell-lunch';
                         tr.appendChild(td);
                     });
                } else {
                    DAYS.forEach(d => {
                        const td = document.createElement('td');
                        const cellData = teacherSchedule[d] ? teacherSchedule[d][p] : null;
                        
                        if (cellData) {
                            // Format: 108통사1
                            // Grade(1) + Class(08) + SubjectName(통사1)
                            // We need to reconstruct this.
                            
                            // 1. Grade
                            const g = cellData.grade || '';
                            
                            // 2. Class (pad to 2 digits)
                            let c = cellData.class_group || '';
                            if (c.length === 1) c = '0' + c; 
                            
                            // 3. Subject Name (from ID or raw if we stored it? We only stored ID)
                            // We must get name from DB subjects.
                            let sName = subjectMap[cellData.subject_id] || '';
                            
                            // Optimization: User wants '통사1' but DB has '통합사회1'.
                            // User Import data had '통사1'. We mapped it to '통합사회1' ID.
                            // If we display '통합사회1', it's fine.
                            // If we strictly want the SHORT name, we might need an alias map reverse?
                            // User request: "화면에 보여줄 때는 스크린샷과 똑같이 108통사1 형식으로"
                            // If '통합사회1' is too long, it might wrap.
                            // Let's assume standard DB name is fine unless user complains.
                            // Or, we can do simple shrinking: removing spaces.
                            
                            const displayText = `${g}${c}${sName}`;
                            
                            const content = document.createElement('div');
                            content.className = 'class-badge';
                            content.textContent = displayText;
                            
                            // Color coding?
                            // Greenish for physics, etc. Random or hash based?
                            // Let's just use standard blue for now.
                            if (sName.includes('물리')) content.style.backgroundColor = '#e8f5e9'; // Green
                            if (sName.includes('화학')) content.style.backgroundColor = '#fce4ec'; // Pink
                            if (sName.includes('생명')) content.style.backgroundColor = '#e0f7fa'; // Cyan
                            if (sName.includes('지구')) content.style.backgroundColor = '#fff3e0'; // Orange
                            
                            td.appendChild(content);
                        }
                        tr.appendChild(td);
                    });
                }
                tbody.appendChild(tr);
            });
            
            table.appendChild(tbody);
            card.appendChild(table);
            
            return card;
        }
    };
    
    // Expose to App
    globalThis.App = globalThis.App || {};
    globalThis.App.TimetableViewer = TimetableViewer;
})();
