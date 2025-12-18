
(function () {
    const LabTimetable = {};

    let currentSemesterId = null;
    let currentTeacherId = null;

    // We removed Lab Context from UI, so we treat it as null in logic.
    // However, DB might require it. We will try to insert NULL.
    // If DB has constraints, this will fail, but user insisted it's not needed.

    let classCounts = {}; // { 1: 5, 2: 6, 3: 5 } (Grade -> Count)
    let subjects = [];    // List of available subjects

    // Grid Configuration
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const DAY_LABELS = { 'Mon': '월', 'Tue': '화', 'Wed': '수', 'Thu': '목', 'Fri': '금', 'Sat': '토', 'Sun': '일' };

    // Rows
    const ROWS = [
        { id: 1, label: '1교시' },
        { id: 2, label: '2교시' },
        { id: 3, label: '3교시' },
        { id: 4, label: '4교시' },
        { id: 'LUNCH', label: '점심' },
        { id: 5, label: '5교시' },
        { id: 6, label: '6교시' },
        { id: 7, label: '7교시' },
        { id: 'AFTER', label: '방과후' }
    ];

    LabTimetable.init = async function () {
        console.log("📅 Teacher Timetable Mode Init");
        const supabase = App.supabase || window.supabaseClient;

        // Elements
        const semSelect = document.getElementById('timetable-semester-select');
        const teacherSelect = document.getElementById('timetable-teacher-select');

        const btnSave = document.getElementById('btn-save-timetable');
        const btnCancel = document.getElementById('btn-cancel-timetable');
        const gridBody = document.getElementById('timetable-body');

        // Init
        await loadSemesters();
        renderEmptyGrid();

        // Listeners
        if (semSelect) {
            semSelect.addEventListener('change', async (e) => {
                currentSemesterId = e.target.value;
                if (!currentSemesterId) {
                    resetContext();
                    return;
                }
                await loadSemesterData(currentSemesterId); // Teachers, Subjects, Class Counts
                if (currentTeacherId) await loadTeacherSchedule();
            });
        }

        if (teacherSelect) {
            teacherSelect.addEventListener('change', async (e) => {
                currentTeacherId = e.target.value;
                if (currentSemesterId && currentTeacherId) {
                    await loadTeacherSchedule();
                } else {
                    renderEmptyGrid(); // clear data
                }
            });
        }

        if (btnSave) {
            btnSave.addEventListener('click', saveSchedule);
        }

        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                // Navigate back
                window.history.back();
            });
        }

        // --- Functions ---

        async function loadSemesters() {
            const { data } = await supabase.from('lab_semesters').select('*').order('created_at', { ascending: false });
            if (semSelect && data) {
                semSelect.innerHTML = '<option value="">학년도 선택</option>';
                data.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.name;
                    semSelect.appendChild(opt);
                });
            }
        }

        async function loadSemesterData(semId) {
            // 1. Teachers
            const { data: tData } = await supabase.from('lab_teachers').select('*').eq('semester_id', semId);
            if (teacherSelect) {
                teacherSelect.innerHTML = '<option value="">교사 선택</option>';
                (tData || []).forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = t.name;
                    teacherSelect.appendChild(opt);
                });
            }

            // 2. Subjects
            const { data: sData } = await supabase.from('lab_subjects').select('*').eq('semester_id', semId);
            subjects = sData || [];

            // 3. Class Counts
            const { data: cData } = await supabase.from('lab_class_counts').select('*').eq('semester_id', semId);
            classCounts = { 1: 0, 2: 0, 3: 0 };
            if (cData) {
                cData.forEach(c => {
                    classCounts[c.grade] = c.class_count;
                });
            }
        }

        function resetContext() {
            currentTeacherId = null;
            if (teacherSelect) teacherSelect.innerHTML = '<option value="">교사 선택</option>';
            renderEmptyGrid();
        }

        function renderEmptyGrid() {
            if (!gridBody) return;
            gridBody.innerHTML = '';

            ROWS.forEach(rowInfo => {
                const tr = document.createElement('tr');
                if (rowInfo.id === 'LUNCH') tr.className = 'row-divider';
                if (rowInfo.id === 'AFTER') tr.className = 'row-afterschool';

                // Label Col
                const th = document.createElement('td');
                th.textContent = rowInfo.label;
                th.style.fontWeight = 'bold';
                th.style.backgroundColor = '#f9f9f9';
                th.style.verticalAlign = 'middle';
                tr.appendChild(th);

                // Day Cols
                DAYS.forEach(day => {
                    const td = document.createElement('td');
                    td.className = 'grid-cell';
                    td.dataset.day = day;
                    td.dataset.rowId = rowInfo.id;

                    // Render Cell Content
                    td.appendChild(createCellContent(day, rowInfo.id));
                    tr.appendChild(td);
                });
                gridBody.appendChild(tr);
            });
        }

        function createCellContent(day, rowId) {
            const container = document.createElement('div');
            container.className = 'cell-content';

            // Checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'cell-checkbox';
            checkbox.addEventListener('change', (e) => toggleInputs(container, e.target.checked));
            container.appendChild(checkbox);

            // Inputs Wrapper
            const inputsDiv = document.createElement('div');
            inputsDiv.className = 'cell-inputs'; // hidden by css

            // Grade
            const selGrade = document.createElement('select');
            selGrade.className = 'cell-select sel-grade';
            selGrade.innerHTML = '<option value="">학년</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>';
            selGrade.addEventListener('change', () => updateClassOptions(selGrade, selClass));

            // Class
            const selClass = document.createElement('select');
            selClass.className = 'cell-select sel-class';
            selClass.innerHTML = '<option value="">반</option>';

            // Subject
            const selSubject = document.createElement('select');
            selSubject.className = 'cell-select sel-subject';
            selSubject.innerHTML = '<option value="">과목</option>';
            subjects.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub.id;
                opt.textContent = sub.name;
                selSubject.appendChild(opt);
            });

            inputsDiv.appendChild(selGrade);
            inputsDiv.appendChild(selClass);
            inputsDiv.appendChild(selSubject);
            container.appendChild(inputsDiv);

            return container;
        }

        function toggleInputs(container, isChecked) {
            const inputsDiv = container.querySelector('.cell-inputs');
            if (isChecked) {
                inputsDiv.classList.add('active');
            } else {
                inputsDiv.classList.remove('active');
            }
        }

        function updateClassOptions(gradeSelect, classSelect) {
            const grade = gradeSelect.value;
            classSelect.innerHTML = '<option value="">반</option>';
            if (!grade) return;

            const count = classCounts[grade] || 0;
            for (let i = 1; i <= count; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = `${i}반`;
                classSelect.appendChild(opt);
            }
        }

        async function loadTeacherSchedule() {
            renderEmptyGrid(); // Reset UI (but keep structure)

            if (!currentSemesterId || !currentTeacherId) return;

            const { data, error } = await supabase
                .from('lab_timetables')
                .select('*')
                .eq('semester_id', currentSemesterId)
                .eq('teacher_id', currentTeacherId);

            if (error) { console.error(error); return; }
            if (!data || data.length === 0) return;

            data.forEach(item => {
                // Determine Row ID from Period
                let rId = item.period;
                if (rId === 99) rId = 'LUNCH';
                if (rId === 100) rId = 'AFTER';

                const cell = gridBody.querySelector(`td[data-day="${item.day}"][data-row-id="${rId}"]`);
                if (cell) {
                    const cb = cell.querySelector('.cell-checkbox');
                    const inputsDiv = cell.querySelector('.cell-inputs');
                    const selGrade = cell.querySelector('.sel-grade');
                    const selClass = cell.querySelector('.sel-class');
                    const selSubject = cell.querySelector('.sel-subject');

                    cb.checked = true;
                    inputsDiv.classList.add('active');

                    if (item.grade) {
                        selGrade.value = item.grade;
                        updateClassOptions(selGrade, selClass);
                    }
                    if (item.class_group) selClass.value = item.class_group;
                    if (item.subject_id) selSubject.value = item.subject_id;
                }
            });
        }

        async function saveSchedule() {
            if (!currentSemesterId || !currentTeacherId) {
                alert('학년도와 교사를 선택해주세요.');
                return;
            }

            const cells = gridBody.querySelectorAll('.grid-cell');
            const newPayloads = [];

            for (const cell of cells) {
                const cb = cell.querySelector('.cell-checkbox');
                if (cb.checked) {
                    const day = cell.dataset.day;
                    const rowId = cell.dataset.rowId;

                    const selGrade = cell.querySelector('.sel-grade');
                    const selClass = cell.querySelector('.sel-class');
                    const selSubject = cell.querySelector('.sel-subject');

                    const g = selGrade.value;
                    const c = selClass.value;
                    const s = selSubject.value;

                    // Validation
                    if (!g || !c || !s) {
                        alert(`[${DAY_LABELS[day]} ${getLabel(rowId)}] 정보가 누락되었습니다.\n학년, 반, 과목을 모두 선택해주세요.`);
                        return; // Stop save
                    }

                    // Map Row ID to DB Period
                    let dbPeriod = parseInt(rowId);
                    if (rowId === 'LUNCH') dbPeriod = 99;
                    if (rowId === 'AFTER') dbPeriod = 100;

                    newPayloads.push({
                        semester_id: currentSemesterId,
                        teacher_id: parseInt(currentTeacherId),
                        lab_room_id: null, // User requested removal
                        day: day,
                        period: dbPeriod,
                        grade: parseInt(g),
                        class_group: c, // '1', '2' ...
                        subject_id: parseInt(s)
                    });
                }
            }

            try {
                // Delete existing for this teacher
                const { error: delError } = await supabase
                    .from('lab_timetables')
                    .delete()
                    .eq('semester_id', currentSemesterId)
                    .eq('teacher_id', currentTeacherId);

                if (delError) throw delError;

                if (newPayloads.length > 0) {
                    const { error: insError } = await supabase
                        .from('lab_timetables')
                        .insert(newPayloads);
                    if (insError) throw insError;
                }

                alert('저장되었습니다.');

            } catch (err) {
                console.error(err);
                alert('저장 중 오류가 발생했습니다: ' + err.message);
            }
        }

        function getLabel(rid) {
            const r = ROWS.find(x => x.id == rid); // loose eq for number/string mix
            return r ? r.label : rid;
        }
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.LabTimetable = LabTimetable;
})();
