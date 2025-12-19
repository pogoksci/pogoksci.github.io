
(function () {
    const LabSettings = {};

    let currentSemesterId = null;

    LabSettings.init = async function () {
        console.log("🛠️ LabSettings.init()");

        // Check Supabase Connection
        const supabase = App.supabase || window.supabaseClient;
        if (!supabase) {
            console.error('Supabase client not initialized.');
            alert('데이터베이스 연결에 실패했습니다.');
            return;
        }

        // --- DOM Elements ---
        const tabs = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        const semesterSelect = document.getElementById('semester-select');
        const semesterDetailsContainer = document.getElementById('semester-details-container');

        // --- Initialization calls moved to bottom ---


        // --- Tab Logic ---
        function initTabs() {
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetId = tab.dataset.tab;

                    // Update Tab Buttons
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');

                    // Update Content
                    tabContents.forEach(content => {
                        content.id === targetId ? content.classList.add('active') : content.classList.remove('active');
                    });
                });
            });
            updateTabStatus();
        }

        async function updateTabStatus() {
            // Check Lab Rooms
            const { data: rooms } = await supabase.from('lab_rooms').select('count');
            const labTab = document.getElementById('tab-btn-lab');
            if (labTab) {
                if (!rooms || rooms.length === 0) {
                    labTab.classList.add('unconfigured');
                } else {
                    labTab.classList.remove('unconfigured');
                }
            }

            // Check Semesters (User Settings)
            const { data: config } = await supabase.from('lab_semesters').select('id');
            const userTab = document.getElementById('tab-btn-user');
            if (userTab) {
                if (!config || config.length === 0) {
                    userTab.classList.add('unconfigured');
                } else {
                    userTab.classList.remove('unconfigured');
                }
            }
        }


        // ==========================================
        // Tab 1: Lab Management Logic
        // ==========================================

        const labCountInput = document.getElementById('lab-count');
        const btnSetLabCount = document.getElementById('btn-set-lab-count');
        const labRoomsContainer = document.getElementById('lab-rooms-container');
        const labRoomsList = document.getElementById('lab-rooms-list');
        const btnSaveLabs = document.getElementById('btn-save-labs');

        // Load existing rooms
        async function loadLabRooms() {
            const { data: rooms, error } = await supabase
                .from('lab_rooms')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Error loading rooms:', error);
                return;
            }

            if (rooms && rooms.length > 0 && labCountInput) {
                labCountInput.value = rooms.length;
                renderRoomInputs(rooms.length, rooms);
                if (labRoomsContainer) labRoomsContainer.style.display = 'block';
            }
        }

        // Set Count Button
        if (btnSetLabCount) {
            btnSetLabCount.addEventListener('click', () => {
                const count = parseInt(labCountInput.value);
                if (count < 1 || count > 20) {
                    alert('1~20 사이의 숫자를 입력해주세요.');
                    return;
                }
                renderRoomInputs(count);
                labRoomsContainer.style.display = 'block';
            });
        }

        // Render Room Inputs
        function renderRoomInputs(count, existingData = []) {
            if (!labRoomsList) return;
            labRoomsList.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const div = document.createElement('div');
                div.className = 'dynamic-item';

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'room-name-input';
                input.placeholder = `과학실 ${i + 1} 이름`;
                // Set value: existing data or default
                if (existingData[i]) {
                    input.value = existingData[i].room_name;
                    input.dataset.id = existingData[i].id; // Store ID for updates
                } else {
                    input.value = `과학교과실${i + 1}`;
                }

                div.appendChild(input);
                labRoomsList.appendChild(div);
            }
        }

        // Save Labs
        if (btnSaveLabs) {
            btnSaveLabs.addEventListener('click', async () => {
                const inputs = document.querySelectorAll('.room-name-input');
                const upsertData = [];
                const inputNames = [];
                const duplicateInInput = new Set();

                // 1. Collect data and check for internal duplicates
                inputs.forEach((input, index) => {
                    const roomName = input.value.trim();
                    if (!roomName) return;

                    if (inputNames.includes(roomName)) {
                        duplicateInInput.add(roomName);
                    }
                    inputNames.push(roomName);

                    const room = {
                        room_name: roomName,
                        sort_order: index + 1
                    };
                    if (input.dataset.id) {
                        room.id = parseInt(input.dataset.id);
                    }
                    upsertData.push(room);
                });

                if (duplicateInInput.size > 0) {
                    alert(`입력란에 중복된 이름이 있습니다: ${Array.from(duplicateInInput).join(', ')}`);
                    return;
                }

                if (upsertData.length === 0) {
                    alert('저장할 과학실 정보가 없습니다.');
                    return;
                }

                try {
                    // 2. Check for duplicates in DB
                    const { data: existingRooms, error: fetchError } = await supabase
                        .from('lab_rooms')
                        .select('id, room_name');

                    if (fetchError) throw fetchError;

                    const itemsToInsert = [];
                    const itemsToUpdate = [];
                    const skippedNames = [];

                    upsertData.forEach(newItem => {
                        const normalizedNewName = newItem.room_name.normalize('NFC').trim();

                        // Check for duplicates in DB (Name exists but ID is different)
                        const match = existingRooms.find(existing => {
                            const normalizedExistingName = existing.room_name.normalize('NFC').trim();
                            // ID mismatch means it's a conflict with ANOTHER record
                            // If newItem has no ID (insert), any match is a conflict
                            // If newItem has ID (update), match with different ID is conflict
                            return normalizedExistingName === normalizedNewName && existing.id !== newItem.id;
                        });

                        if (match) {
                            skippedNames.push(newItem.room_name);
                        } else {
                            if (newItem.id) {
                                // Check if content actually changed
                                const original = existingRooms.find(r => r.id === newItem.id);
                                if (original && original.room_name !== newItem.room_name) {
                                    itemsToUpdate.push(newItem);
                                }
                            } else {
                                itemsToInsert.push(newItem);
                            }
                        }
                    });

                    // Execute Inserts
                    if (itemsToInsert.length > 0) {
                        const { error: insertError } = await supabase
                            .from('lab_rooms')
                            .insert(itemsToInsert);
                        if (insertError) throw insertError;
                    }

                    // Execute Updates
                    if (itemsToUpdate.length > 0) {
                        const updatePromises = itemsToUpdate.map(item => {
                            const { id, ...updateFields } = item;
                            return supabase
                                .from('lab_rooms')
                                .update(updateFields)
                                .eq('id', id);
                        });
                        await Promise.all(updatePromises);
                    }

                    // Construct Message
                    let message = '';
                    const savedCount = itemsToInsert.length + itemsToUpdate.length;

                    if (savedCount > 0) {
                        message += '과학실 정보가 저장되었습니다.';
                    }

                    if (skippedNames.length > 0) {
                        const skippedMsg = `\n\n[이미 등록된 이름 제외]\n${skippedNames.join(', ')}은(는) 이미 존재하여 저장되지 않았습니다.`;
                        message += skippedMsg;
                    }

                    if (savedCount === 0 && skippedNames.length === 0) {
                        message = '변경사항이 없습니다.';
                    } else if (savedCount === 0 && skippedNames.length > 0) {
                        if (!message) message = '저장된 내용이 없습니다.';
                    }

                    alert(message);
                    await loadLabRooms();
                    updateTabStatus();

                } catch (err) {
                    console.error('Error saving labs:', err);
                    alert('과학실 저장 중 오류가 발생했습니다: ' + err.message);
                }
            });
        }


        // ==========================================
        // Tab 2: User Settings Logic
        // ==========================================

        const btnAddSemester = document.getElementById('btn-add-semester');
        const newSemesterForm = document.getElementById('new-semester-form');
        const btnSaveSemester = document.getElementById('btn-save-semester');
        const btnCancelSemester = document.getElementById('btn-cancel-semester');
        const btnSaveUserSettings = document.getElementById('btn-save-user-settings');

        // Helper: Calculate Academic Year
        function getAcademicYear() {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth() + 1; // 0-indexed
            // If Month is 1 or 2, it's the previous year's academic year
            if (month < 3) {
                return year - 1;
            }
            return year;
        }

        // Helper: Populate Dropdown
        function populateSemesterDropdown() {
            const select = document.getElementById('new-semester-name');
            if (!select) return;

            // Should prompt only once or every time? Every time is safer to ensure default is set.
            select.innerHTML = '';
            const startYear = 2015;
            const endYear = 2050;
            const currentAcademicYear = getAcademicYear();

            for (let y = startYear; y <= endYear; y++) {
                const option = document.createElement('option');
                option.value = `${y}학년도`; // Format: "2025학년도"
                option.textContent = `${y}학년도`;
                if (y === currentAcademicYear) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        }

        // UI Toggles
        if (btnAddSemester) {
            btnAddSemester.addEventListener('click', () => {
                newSemesterForm.style.display = 'block';
                populateSemesterDropdown();
            });
        }
        if (btnCancelSemester) {
            btnCancelSemester.addEventListener('click', () => {
                newSemesterForm.style.display = 'none';
            });
        }

        // Save New Semester
        if (btnSaveSemester) {
            btnSaveSemester.addEventListener('click', async () => {
                // Use value from select
                const name = document.getElementById('new-semester-name').value;
                if (!name) { alert('학년도를 선택하세요.'); return; }

                // Check for duplicates (Exact match OR Base match)
                // e.g., if user selects "2025학년도", check if "2025학년도" or "2025학년도_..." exists.
                const { data: existing, error: checkError } = await supabase
                    .from('lab_semesters')
                    .select('name')
                    .ilike('name', `${name}%`);

                if (checkError) {
                    alert('중복 확인 중 오류가 발생했습니다: ' + checkError.message);
                    return;
                }

                const isDuplicate = existing.some(item =>
                    item.name === name || item.name.startsWith(name + '_')
                );

                if (isDuplicate) {
                    alert('동일 학년도가 이미 등록되어 있어 추가할 수 없습니다.\n해당 학년도를 선택하여 수정하세요.');
                    return;
                }

                const { data, error } = await supabase
                    .from('lab_semesters')
                    .insert([{ name: name }])
                    .select();

                if (error) {
                    alert('학년도 추가 실패: ' + error.message);
                } else {
                    alert('추가되었습니다.');
                    document.getElementById('new-semester-name').value = '';
                    newSemesterForm.style.display = 'none';
                    await loadSemesters(data[0].id); // Reload and select new
                }
            });
        }

        // Load Semesters to Dropdown
        async function loadSemesters(selectId = null) {
            const { data, error } = await supabase
                .from('lab_semesters')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) { console.error(error); return; }

            if (semesterSelect) semesterSelect.innerHTML = '<option value="">학년도를 선택하세요</option>';
            data.forEach(sem => {
                const option = document.createElement('option');
                option.value = sem.id;
                option.textContent = sem.name;
                if (semesterSelect) semesterSelect.appendChild(option);
            });

            if (selectId && semesterSelect) {
                semesterSelect.value = selectId;
                handleSemesterChange(selectId);
            }
        }

        if (semesterSelect) {
            semesterSelect.addEventListener('change', (e) => {
                handleSemesterChange(e.target.value);
            });
        }

        async function handleSemesterChange(id) {
            if (!id) {
                if (semesterDetailsContainer) semesterDetailsContainer.style.display = 'none';
                currentSemesterId = null;
                return;
            }
            currentSemesterId = id;
            if (semesterDetailsContainer) semesterDetailsContainer.style.display = 'block';

            await loadClassCounts(id);
            await loadDynamicList('lab_teachers', 'teachers-list');
            await loadDynamicList('lab_subjects', 'subjects-list');
            await loadDynamicList('lab_clubs', 'clubs-list');
        }

        // Class Counts
        async function loadClassCounts(semesterId) {
            const { data, error } = await supabase
                .from('lab_class_counts')
                .select('*')
                .eq('semester_id', semesterId);

            // Reset inputs
            const g1 = document.getElementById('count-grade-1'); if (g1) g1.value = '';
            const g2 = document.getElementById('count-grade-2'); if (g2) g2.value = '';
            const g3 = document.getElementById('count-grade-3'); if (g3) g3.value = '';

            if (data) {
                data.forEach(item => {
                    const input = document.getElementById(`count-grade-${item.grade}`);
                    if (input) {
                        // Display value only if > 0, otherwise empty (placeholder '0' handles the hint)
                        input.value = item.class_count > 0 ? item.class_count : '';
                    }
                });
            }
        }

        // Generic Load List Helper
        async function loadDynamicList(tableName, containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = ''; // Clear

            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('semester_id', currentSemesterId)
                .order('id', { ascending: true });

            let initialCount = 12;
            let existingCount = data ? data.length : 0;
            let totalCount = Math.max(initialCount, existingCount);

            for (let i = 0; i < totalCount; i++) {
                const item = data && data[i] ? data[i] : null;
                createDynamicInput(container, item ? item.name : '', item ? item.id : null);
            }
        }

        // Helper to create input row
        function createDynamicInput(container, value = '', id = null) {
            const div = document.createElement('div');
            div.className = 'dynamic-item';

            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            if (id) input.dataset.id = id;

            // Option to remove if needed (for now just clearing value)
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove';
            removeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">remove</span>';
            removeBtn.tabIndex = -1;
            removeBtn.addEventListener('click', async () => {
                div.remove();
            });

            div.appendChild(input);
            // container.appendChild(div); // Add remove button if desired, but user wants simple lists
            container.appendChild(div);
        }

        // Add Button Handlers
        ['teachers', 'subjects', 'clubs'].forEach(type => {
            const btn = document.getElementById(`btn-add-${type.slice(0, -1)}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    const list = document.getElementById(`${type}-list`);
                    if (list) createDynamicInput(list);
                });
            }
        });

        // Save User Settings
        if (btnSaveUserSettings) {
            btnSaveUserSettings.addEventListener('click', async () => {
                if (!currentSemesterId) { alert('학년도를 선택하세요.'); return; }

                // --- 1. Collect Valid Data from UI ---
                const uiTeachers = Array.from(document.querySelectorAll('#teachers-list input')).map(i => i.value.trim()).filter(v => v);
                const uiSubjects = Array.from(document.querySelectorAll('#subjects-list input')).map(i => i.value.trim()).filter(v => v);
                const uiClubs = Array.from(document.querySelectorAll('#clubs-list input')).map(i => i.value.trim()).filter(v => v);

                const c1 = document.getElementById('count-grade-1');
                const c2 = document.getElementById('count-grade-2');
                const c3 = document.getElementById('count-grade-3');

                // Parsing with fallback to 0
                const numC1 = parseInt(c1 ? c1.value : 0) || 0;
                const numC2 = parseInt(c2 ? c2.value : 0) || 0;
                const numC3 = parseInt(c3 ? c3.value : 0) || 0;

                const uiCounts = [
                    { grade: 1, count: numC1 },
                    { grade: 2, count: numC2 },
                    { grade: 3, count: numC3 }
                ];

                // --- 2. Check Strict Validation Rules (All Mmust have at least one entry) ---
                const hasValidCounts = (numC1 > 0) || (numC2 > 0) || (numC3 > 0); // At least one grade > 0
                const hasTeachers = uiTeachers.length > 0;
                const hasSubjects = uiSubjects.length > 0;
                const hasClubs = uiClubs.length > 0;

                const validationErrors = [];
                if (!hasValidCounts) validationErrors.push('- 학급 수 (적어도 한 학년은 입력해야 합니다)');
                if (!hasTeachers) validationErrors.push('- 과학과 교사 (최소 1명 이상)');
                if (!hasSubjects) validationErrors.push('- 운영 과목 (최소 1개 이상)');
                if (!hasClubs) validationErrors.push('- 동아리 (최소 1개 이상)');

                if (validationErrors.length > 0) {
                    alert('다음 항목을 모두 입력해야 저장할 수 있습니다:\n\n' + validationErrors.join('\n'));
                    return;
                }

                // --- 3. Check for Changes (UI vs DB) & Determine Initial State ---
                async function fetchCurrentData() {
                    const [t, s, cl, co, sem] = await Promise.all([
                        supabase.from('lab_teachers').select('name').eq('semester_id', currentSemesterId).order('id'),
                        supabase.from('lab_subjects').select('name').eq('semester_id', currentSemesterId).order('id'),
                        supabase.from('lab_clubs').select('name').eq('semester_id', currentSemesterId).order('id'),
                        supabase.from('lab_class_counts').select('*').eq('semester_id', currentSemesterId),
                        supabase.from('lab_semesters').select('*').eq('id', currentSemesterId).single()
                    ]);

                    // Determine if DB is empty
                    const isEmpty = (t.data.length === 0) && (s.data.length === 0) && (cl.data.length === 0) &&
                        (co.data.length === 0 || co.data.every(x => x.class_count === 0));

                    return {
                        teachers: t.data.map(i => i.name),
                        subjects: s.data.map(i => i.name),
                        clubs: cl.data.map(i => i.name),
                        counts: co.data || [],
                        semester: sem.data,
                        isInitialState: isEmpty
                    };
                }

                const dbData = await fetchCurrentData();

                // Comparators
                const isListDifferent = (arr1, arr2) => {
                    if (arr1.length !== arr2.length) return true;
                    // Strict index comparison as inputs are list based.
                    return arr1.some((val, idx) => val !== arr2[idx]);
                }
                const isCountDifferent = (ui, db) => {
                    return ui.some(u => {
                        const d = db.find(x => x.grade === u.grade);
                        return u.count !== (d ? d.class_count : 0);
                    });
                }

                const criticalChanged = isListDifferent(uiTeachers, dbData.teachers) ||
                    isListDifferent(uiSubjects, dbData.subjects) ||
                    isCountDifferent(uiCounts, dbData.counts);

                const clubChanged = isListDifferent(uiClubs, dbData.clubs);
                const hasChanged = criticalChanged || clubChanged;


                if (!hasChanged) {
                    alert('변경사항이 없습니다.');
                    return;
                }

                // --- 4. Logic Branch: Direct Save vs Version Update ---

                // Helper: Direct Save Transaction (Reusable)
                async function executeDirectSave(successMessage) {
                    try {
                        // Counts (Delete & Re-insert strategy to avoid constraint 400 errors)
                        const countUpserts = uiCounts.map(c => ({
                            semester_id: currentSemesterId,
                            grade: c.grade,
                            class_count: c.count
                        }));
                        await supabase.from('lab_class_counts').delete().eq('semester_id', currentSemesterId);
                        const { error: cntErr } = await supabase.from('lab_class_counts').insert(countUpserts);
                        if (cntErr) throw cntErr;

                        // Lists (Sync)
                        await saveDynamicList('lab_teachers', 'teachers-list');
                        await saveDynamicList('lab_subjects', 'subjects-list');
                        await saveDynamicList('lab_clubs', 'clubs-list');

                        alert(successMessage);
                        await loadSemesters(currentSemesterId);
                    } catch (err) {
                        console.error('Direct save error:', err);
                        alert('저장 중 오류가 발생했습니다: ' + err.message);
                    }
                }

                // A. Initial Save (Database Empty)
                // B. Club-Only Change (Minor) - REMOVED BY REQUEST (All changes trigger prompt)
                /* 
                const isDirectSave = !criticalChanged && clubChanged;
                if (isDirectSave) {
                     await executeDirectSave('동아리/부서 설정이 업데이트되었습니다.');
                     return;
                }
                */

                // C. Check if this is a "New Creation" Scenario - REVERTED (Handled by isInitialState)

                // D. Critical Changes -> Prompt User (New Version vs Overwrite)
                // Default: New Version (flow continues downward). 
                // Option: Overwrite (call executeDirectSave and return).

                // --- Helper: Custom Modal Logic ---
                function showVersionChoiceModal() {
                    return new Promise((resolve) => {
                        const modal = document.getElementById('version-choice-modal');
                        const btnNew = document.getElementById('btn-choice-new');
                        const btnOverwrite = document.getElementById('btn-choice-overwrite');
                        const btnCancel = document.getElementById('btn-choice-cancel');

                        if (!modal || !btnNew || !btnOverwrite) {
                            // Fallback if modal elements missing
                            const fallback = confirm('중요 설정이 변경되었습니다.\n[확인] 새 기간 생성\n[취소] 현재 기간 덮어쓰기');
                            resolve(fallback);
                            return;
                        }

                        modal.style.display = 'flex';

                        // Cleanup helper
                        const cleanup = () => {
                            modal.style.display = 'none';
                            btnNew.replaceWith(btnNew.cloneNode(true));
                            btnOverwrite.replaceWith(btnOverwrite.cloneNode(true));
                            btnCancel.replaceWith(btnCancel.cloneNode(true));
                        };

                        // Handlers
                        btnNew.onclick = () => { cleanup(); resolve(true); }; // True = New Version
                        btnOverwrite.onclick = () => { cleanup(); resolve(false); }; // False = Overwrite
                        btnCancel.onclick = () => { cleanup(); resolve(null); }; // Null = Cancel action
                    });
                }

                // C. Critical Changes -> Prompt User (New Version vs Overwrite)
                // Use Custom Modal instead of confirm()

                const choice = await showVersionChoiceModal();

                if (choice === null) {
                    return; // User cancelled the action entirely
                }

                if (choice === false) {
                    // User chose "Overwrite" (Keep Current Period)
                    await executeDirectSave('현재 기간 설정이 수정되었습니다.');
                    return;
                }

                // choice === true -> Proceed to Versioning (below)

                // CASE D: Versioning Required (User chose OK)
                const modificationContainer = document.getElementById('modification-date-container');
                const modificationInput = document.getElementById('modification-date');

                // If not visible yet, show it and stop
                if (modificationContainer.style.display === 'none') {
                    modificationContainer.style.display = 'block';
                    alert('수정 기준 날짜를 입력해주세요.\n(입력란은 저장 버튼 위에 있습니다)');
                    modificationInput.focus();
                    return;
                }

                const modDate = modificationInput.value;
                if (!modDate) {
                    alert('수정 기준 날짜를 선택해주세요.');
                    return;
                }

                if (!confirm(`기준 날짜 [${modDate}]로 새로운 설정 버전을 생성하시겠습니까?\n\n- 기존 설정은 [${modDate}] 전날까지로 보존됩니다.`)) {
                    return;
                }

                // --- 5. TRANSACTION: Versioning ---
                try {
                    // Start of Logic
                    const oldSemester = dbData.semester;
                    const oldEnd = new Date(modDate);
                    oldEnd.setDate(oldEnd.getDate() - 1);
                    const oldEndDateStr = oldEnd.toISOString().split('T')[0];

                    // --- Naming Logic Modification ---
                    // Goal: Old -> "Base_N기간", New -> "Base_현재"

                    // 1. Determine "Base Name" (e.g., "2025학년도")
                    let baseName = oldSemester.name;
                    // Remove existing suffix if present
                    baseName = baseName.replace(/_현재$/, '');
                    baseName = baseName.replace(/_\d+기간$/, '');

                    // 2. Find next sequence number (N)
                    // Query for all names starting with BaseName + "_"
                    const { data: existingSimilar, error: searchError } = await supabase
                        .from('lab_semesters')
                        .select('name')
                        .ilike('name', `${baseName}_%`);

                    if (searchError) throw searchError;

                    let maxSeq = 0;
                    existingSimilar.forEach(item => {
                        const match = item.name.match(/_(\d+)기간$/);
                        if (match) {
                            const seq = parseInt(match[1]);
                            if (seq > maxSeq) maxSeq = seq;
                        }
                    });

                    const nextSeq = maxSeq + 1;

                    // 3. Define Names
                    const oldNameFinal = `${baseName}_${nextSeq}기간`;
                    const newNameFinal = `${baseName}_현재`;


                    // A. Update Old Semester (Rename to _N기간 & EndDate)
                    const { error: updateError } = await supabase
                        .from('lab_semesters')
                        .update({
                            name: oldNameFinal,
                            end_date: oldEndDateStr
                        })
                        .eq('id', currentSemesterId);

                    if (updateError) throw updateError;


                    // B. Create New Semester (Name as _현재 & StartDate)
                    const { data: newSemData, error: insertError } = await supabase
                        .from('lab_semesters')
                        .insert([{
                            name: newNameFinal,
                            start_date: modDate
                        }])
                        .select()
                        .single();

                    if (insertError) throw insertError;
                    const newSemesterId = newSemData.id;


                    // C. Duplicate/Save Data to NEW Semester ID

                    // Counts
                    const countInserts = uiCounts.map(c => ({
                        semester_id: newSemesterId,
                        grade: c.grade,
                        class_count: c.count
                    }));
                    if (countInserts.length) await supabase.from('lab_class_counts').insert(countInserts);

                    // Dynamic Lists (Teachers, Subjects, Clubs) -> Insert UI values as NEW items
                    const insertList = async (list, table) => {
                        if (!list.length) return;
                        const rows = list.map(name => ({
                            semester_id: newSemesterId,
                            name: name
                        }));
                        await supabase.from(table).insert(rows);
                    };

                    await insertList(uiTeachers, 'lab_teachers');
                    await insertList(uiSubjects, 'lab_subjects');
                    await insertList(uiClubs, 'lab_clubs');


                    // Finalize
                    alert(`저장되었습니다.\n\n이전 기록 보존: ${oldNameFinal} (종료: ${oldEndDateStr})\n현재 설정 적용: ${newNameFinal} (시작: ${modDate})`);

                    // Reset UI
                    modificationInput.value = '';
                    modificationContainer.style.display = 'none';

                    // Reload Global State
                    await loadSemesters(newSemesterId);

                } catch (err) {
                    console.error('Error in versioning transaction:', err);
                    alert('저장 중 오류가 발생했습니다: ' + err.message);
                }
            });
        }

        async function saveDynamicList(tableName, containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            const inputs = container.querySelectorAll('input');

            const { data: dbItems } = await supabase
                .from(tableName)
                .select('id')
                .eq('semester_id', currentSemesterId);
            const dbIds = new Set((dbItems || []).map(i => i.id));
            const uiIds = new Set();

            const itemsToInsert = [];
            const itemsToUpdate = [];

            inputs.forEach(input => {
                const val = input.value.trim();
                const id = input.dataset.id ? parseInt(input.dataset.id) : null;

                if (val) {
                    const row = { name: val, semester_id: currentSemesterId };
                    if (id) {
                        row.id = id;
                        uiIds.add(id);
                        itemsToUpdate.push(row);
                    } else {
                        itemsToInsert.push(row);
                    }
                }
            });

            // Execute Insert
            if (itemsToInsert.length > 0) {
                const { error } = await supabase.from(tableName).insert(itemsToInsert);
                if (error) throw error;
            }

            // Execute Update
            if (itemsToUpdate.length > 0) {
                const updatePromises = itemsToUpdate.map(item => {
                    const { id, ...fields } = item;
                    return supabase.from(tableName).update(fields).eq('id', id);
                });
                await Promise.all(updatePromises);
            }

            const toDelete = [...dbIds].filter(x => !uiIds.has(x));
            if (toDelete.length > 0) {
                await supabase.from(tableName).delete().in('id', toDelete);
            }

            await loadDynamicList(tableName, containerId);
        }
        // Initialize after all declarations
        initTabs();
        await loadLabRooms();
        await loadSemesters();
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.LabSettings = LabSettings;
})();
