// /js/pages/lab-usage-view.js
(function () {
    const LabUsageView = {};

    let subjectMap = {};
    let teacherMap = {};
    let roomMap = {};
    let allSubjects = [];
    let allTeachers = [];
    let allRooms = [];
    let lastSearchResult = [];

    // Pagination State
    let currentPage = 1;
    let pageSize = 10; // Default
    let isDescSort = true; // Default: Descending (Latest first)

    function sortData(list) {
        if (!list) return;
        list.sort((a, b) => {
            // Sort by Date -> Period -> Room Name
            if (a.usage_date !== b.usage_date) {
                return isDescSort 
                    ? b.usage_date.localeCompare(a.usage_date) 
                    : a.usage_date.localeCompare(b.usage_date);
            }
            if (a.period !== b.period) {
                // Period can be string '1', '2' or '99', '88'
                // For simple string comparison is okay usually, but numeric is better if mixed.
                // Assuming string comparison is sufficient or convert to int if strictly numerical sort needed.
                return isDescSort 
                    ? String(b.period).localeCompare(String(a.period))
                    : String(a.period).localeCompare(String(b.period));
            }
            // Room Name Map check
            const roomA = roomMap[a.lab_room_id] || '';
            const roomB = roomMap[b.lab_room_id] || '';
            return isDescSort 
                ? roomB.localeCompare(roomA)
                : roomA.localeCompare(roomB);
        });
    }

    LabUsageView.init = async function () {
        console.log("🔍 Lab Usage View Init");
        const supabase = globalThis.App?.supabase;
        if (!supabase) return;

        // 1. Default Dates: School Year (Mar 1st ~ Feb End) - Run this FIRST
        try {
            const now = new Date();
            let schoolYear = now.getFullYear();
            if (now.getMonth() < 2) schoolYear--; // If Jan or Feb, school year is previous year

            const firstDay = new Date(schoolYear, 2, 1); // March 1st
            const lastDay = new Date(schoolYear + 1, 2, 0); // Last day of Feb (handles leap years)

            const startEl = document.getElementById('filter-start-date');
            const endEl = document.getElementById('filter-end-date');
            if (startEl) startEl.value = formatDate(firstDay);
            if (endEl) endEl.value = formatDate(lastDay);
        } catch (e) {
            console.error("❌ Failed to set default dates:", e);
        }

        // 2. Initial Data Loading (Dropdowns, etc)
        await loadInitialData();
        setupFilters();

        // 3. Initial Search (Auto-run) - Done after dates and filters are ready
        await search();

        // 4. Bind Export & Print
        const btnExport = document.getElementById('btn-export-excel');
        if (btnExport) btnExport.onclick = exportToExcel;

        const btnPrint = document.getElementById('btn-print-report');
        if (btnPrint) btnPrint.onclick = printReport;
    };

    async function loadInitialData() {
        const supabase = globalThis.App?.supabase;

        const [rooms, subjects, teachers] = await Promise.all([
            supabase.from('lab_rooms').select('*').order('sort_order'),
            supabase.from('lab_subjects').select('*').order('name'),
            supabase.from('lab_teachers').select('*').order('name')
        ]);

        allRooms = rooms.data || [];
        allSubjects = subjects.data || [];
        allTeachers = teachers.data || [];

        allRooms.forEach(r => roomMap[r.id] = r.room_name);
        allSubjects.forEach(s => subjectMap[s.id] = s.name);
        allTeachers.forEach(t => teacherMap[t.id] = t.name);

        // Update Dropdowns
        const selRoom = document.getElementById('filter-room');
        const selSubj = document.getElementById('filter-subject');
        const selTech = document.getElementById('filter-teacher');

        if (selRoom) {
            selRoom.innerHTML = '<option value="">전체</option>' +
                allRooms.map(r => `<option value="${r.id}">${r.room_name}</option>`).join('');
        }
        if (selSubj) {
            // Deduplicate by name for cleaner filter
            const uniqueSub = [];
            const seenSub = new Set();
            allSubjects.forEach(s => {
                if (!seenSub.has(s.name)) {
                    seenSub.add(s.name);
                    uniqueSub.push(s);
                }
            });
            selSubj.innerHTML = '<option value="">전체</option>' +
                uniqueSub.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }
        if (selTech) {
            // Deduplicate by name for cleaner filter
            const uniqueTech = [];
            const seenTech = new Set();
            allTeachers.forEach(t => {
                if (!seenTech.has(t.name)) {
                    seenTech.add(t.name);
                    uniqueTech.push(t);
                }
            });
            selTech.innerHTML = '<option value="">전체</option>' +
                uniqueTech.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }
    }

    function setupFilters() {
        const btnSearch = document.getElementById('btn-apply-filters');
        if (btnSearch) {
            btnSearch.onclick = async () => {
                btnSearch.disabled = true;
                btnSearch.textContent = "조회 중...";
                await search();
                btnSearch.disabled = false;
                btnSearch.textContent = "조회하기";
            };
        }

        const selPageSize = document.getElementById('filter-page-size');
        if (selPageSize) {
            selPageSize.value = "10"; // Sync with default state
            selPageSize.onchange = () => {
                pageSize = selPageSize.value === 'all' ? 999999 : parseInt(selPageSize.value);
                currentPage = 1;
                renderTable(lastSearchResult);
            };
        }

        const btnSort = document.getElementById('btn-toggle-sort');
        if (btnSort) {
            btnSort.onclick = () => {
                isDescSort = !isDescSort;
                // Update Icon
                const icon = btnSort.querySelector('.material-symbols-outlined');
                if (icon) icon.textContent = isDescSort ? 'sort' : 'sort_by_alpha'; // approximate icons
                
                // Re-sort data
                sortData(lastSearchResult);
                currentPage = 1;
                renderTable(lastSearchResult);
            };
        }

        const btnPrev = document.getElementById('btn-prev-page');
        const btnNext = document.getElementById('btn-next-page');
        if (btnPrev) btnPrev.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable(lastSearchResult);
            }
        };
        if (btnNext) btnNext.onclick = () => {
            const maxPage = Math.ceil(lastSearchResult.length / pageSize);
            if (currentPage < maxPage) {
                currentPage++;
                renderTable(lastSearchResult);
            }
        };
    }

    async function search() {
        const supabase = globalThis.App?.supabase;
        const startDate = document.getElementById('filter-start-date').value;
        const endDate = document.getElementById('filter-end-date').value;
        const roomId = document.getElementById('filter-room').value;
        const grade = document.getElementById('filter-grade').value;
        const subjectId = document.getElementById('filter-subject').value;
        const teacherId = document.getElementById('filter-teacher').value;

        // Explicitly select columns to avoid errors with potential schema cache issues or hidden columns
        // Explicitly select columns. Compacted to avoid any whitespace issues.
        let query = supabase.from('lab_usage_log')
            .select('id, lab_room_id, usage_date, period, grade, class_number, subject_id, teacher_id, activity_type, content, safety_education, remarks, semester_id');

        console.log("Values for search:", { startDate, endDate, roomId, grade, subjectId, teacherId });

        if (startDate) query = query.gte('usage_date', startDate);
        if (endDate) query = query.lte('usage_date', endDate);
        if (roomId) query = query.eq('lab_room_id', roomId);
        if (grade) query = query.eq('grade', grade);
        if (subjectId) query = query.eq('subject_id', subjectId);
        if (teacherId) query = query.eq('teacher_id', teacherId);

        const { data, error } = await query.order('usage_date', { ascending: false }).order('period', { ascending: true });

        if (error) {
            console.error("❌ Search failed:", error);
            return;
        }

        // Post-filter: Only show '승인' or empty (legacy)
        const rawData = data || [];
        const filteredData = rawData.filter(item => !item.remarks || item.remarks === '승인');

        lastSearchResult = filteredData;
        
        // Initial Sort
        sortData(lastSearchResult);

        currentPage = 1; // Reset to first page on search
        renderTable(lastSearchResult);
    }

    function renderTable(data) {
        const body = document.getElementById('usage-view-body');
        const empty = document.getElementById('usage-view-empty');
        const countTxt = document.getElementById('result-count');
        const pageInfo = document.getElementById('page-info');

        if (!body) return;
        body.innerHTML = '';
        countTxt.textContent = `조회 결과: ${data ? data.length : 0}건`;

        if (!data || data.length === 0) {
            empty.style.display = 'flex';
            if (pageInfo) pageInfo.textContent = "0 / 0";
            return;
        }
        empty.style.display = 'none';

        // Pagination Logic
        const total = data.length;
        const maxPage = Math.ceil(total / pageSize);
        if (currentPage > maxPage && maxPage > 0) currentPage = maxPage;

        if (pageInfo) pageInfo.textContent = `${currentPage} / ${maxPage || 1}`;

        const startIdx = (currentPage - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const pagedData = data.slice(startIdx, endIdx);

        const role = globalThis.App?.Auth?.user?.role;
        const canEdit = ['admin', 'teacher'].includes(role);

        pagedData.forEach(item => {
            const tr = document.createElement('tr');

            const periodLabel = item.period === '99' ? '점심' : (item.period === '88' ? '방과후' : `${item.period}교시`);
            const safetyClass = item.safety_education === '실시' ? 'complete' : 'pending';

            tr.innerHTML = `
                <td style="font-weight:500;">${item.usage_date}</td>
                <td>${periodLabel}</td>
                <td style="color:#00A0B2; font-weight:600;">${roomMap[item.lab_room_id] || '-'}</td>
                <td>${item.grade ? `${item.grade}학년-${item.class_number}반` : '-'}</td>
                <td>${subjectMap[item.subject_id] || item.activity_type}</td>
                <td>${teacherMap[item.teacher_id] || '-'}</td>
                <td class="cell-content" 
                    contenteditable="${canEdit}" 
                    style="${canEdit ? 'outline: 1px dashed transparent;' : ''}"
                    title="${canEdit ? '클릭하여 내용 수정 (입력 후 포커스를 옮기면 저장됩니다)' : ''}">${item.content || ''}</td>
                <td style="text-align:center;">
                    <span class="badge-safety ${safetyClass}" 
                          style="${canEdit ? 'cursor:pointer;' : ''}"
                          title="${canEdit ? '클릭하여 상태 변경' : ''}">${item.safety_education}</span>
                </td>
            `;

            if (canEdit) {
                const badge = tr.querySelector('.badge-safety');
                badge.onclick = () => toggleSafetyStatus(item, badge);

                const contentCell = tr.querySelector('.cell-content');
                contentCell.onfocus = () => contentCell.style.outlineColor = '#00A0B2';
                contentCell.onblur = async () => {
                    contentCell.style.outlineColor = 'transparent';
                    const newText = contentCell.textContent.trim();
                    if (newText !== (item.content || '')) {
                        await updateContent(item, newText, contentCell);
                    }
                };
                contentCell.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        contentCell.blur();
                    }
                };
            }

            body.appendChild(tr);
        });
    }

    async function toggleSafetyStatus(item, badgeEl) {
        const supabase = globalThis.App?.supabase;
        if (!supabase) return;

        const newStatus = item.safety_education === '실시' ? '미실시' : '실시';

        // Optimistic UI update
        badgeEl.textContent = "Updating...";
        badgeEl.style.opacity = '0.5';

        try {
            const { error } = await supabase
                .from('lab_usage_log')
                .update({ safety_education: newStatus })
                .eq('id', item.id);
            //     .match({
            //         lab_room_id: item.lab_room_id,
            //         usage_date: item.usage_date,
            //         period: item.period,
            //         subject_id: item.subject_id,
            //         teacher_id: item.teacher_id,
            //         grade: item.grade,
            //         class_number: item.class_number
            //     });

            if (error) throw error;

            // Success
            item.safety_education = newStatus;
            const newClass = newStatus === '실시' ? 'complete' : 'pending';
            badgeEl.className = `badge-safety ${newClass}`;
            badgeEl.textContent = newStatus;
        } catch (err) {
            console.error("❌ Failed to update safety status:", err);
            alert("상태 변경에 실패했습니다: " + err.message);
            // Revert UI
            const oldClass = item.safety_education === '실시' ? 'complete' : 'pending';
            badgeEl.className = `badge-safety ${oldClass}`;
            badgeEl.textContent = item.safety_education;
        } finally {
            badgeEl.style.opacity = '1';
        }
    }

    async function updateContent(item, newText, cellEl) {
        const supabase = globalThis.App?.supabase;
        if (!supabase) return;

        cellEl.style.opacity = '0.5';

        try {
            const { error } = await supabase
                .from('lab_usage_log')
                .update({ content: newText })
                .eq('id', item.id);
            //     .match({
            //         lab_room_id: item.lab_room_id,
            //         usage_date: item.usage_date,
            //         period: item.period,
            //         subject_id: item.subject_id,
            //         teacher_id: item.teacher_id,
            //         grade: item.grade,
            //         class_number: item.class_number
            //     });

            if (error) throw error;

            item.content = newText;
            console.log("✅ Content updated successfully");
        } catch (err) {
            console.error("❌ Failed to update content:", err);
            alert("내용 저장에 실패했습니다: " + err.message);
            cellEl.textContent = item.content || '';
        } finally {
            cellEl.style.opacity = '1';
        }
    }

    async function exportToExcel() {
        if (!lastSearchResult || lastSearchResult.length === 0) {
            alert("내보낼 데이터가 없습니다. 먼저 조회를 해주세요.");
            return;
        }

        if (typeof XLSX === 'undefined') {
            alert("엑셀 내보내기 라이브러리가 로드되지 않았습니다.");
            return;
        }

        // 1. Format Data for Excel
        const excelData = lastSearchResult.map(item => {
            const periodLabel = item.period === '99' ? '점심' : (item.period === '88' ? '방과후' : `${item.period}교시`);
            return {
                "날짜": item.usage_date,
                "교시": periodLabel,
                "과학실": roomMap[item.lab_room_id] || '-',
                "학년": item.grade ? `${item.grade}학년` : '-',
                "반": item.class_number ? `${item.class_number}반` : '-',
                "과목": subjectMap[item.subject_id] || item.activity_type,
                "담당교사": teacherMap[item.teacher_id] || '-',
                "활동내용": item.content || '',
                "안전교육": item.safety_education
            };
        });

        // 2. Create Sheet
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // 3. Set Column Widths
        const wscols = [
            { wch: 12 }, // 날짜
            { wch: 8 },  // 교시
            { wch: 15 }, // 과학실
            { wch: 8 },  // 학년
            { wch: 8 },  // 반
            { wch: 18 }, // 과목
            { wch: 12 }, // 담당교사
            { wch: 40 }, // 활동내용
            { wch: 10 }  // 안전교육
        ];
        worksheet['!cols'] = wscols;

        // 4. Create Workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "사용기록");

        // 5. Save File
        const dateStr = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `과학실_사용기록_${dateStr}.xlsx`);
    }

    function printReport() {
        if (!lastSearchResult || lastSearchResult.length === 0) {
            alert("인쇄할 데이터가 없습니다.");
            return;
        }

        // 1. Determine Title
        const roomId = document.getElementById('filter-room').value;
        let title = "과학실 사용기록";
        if (roomId && roomMap[roomId]) {
            title = `${roomMap[roomId]} 사용기록`;
        }
        const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

        // 2. Build HTML Content
        const rows = lastSearchResult.map((item, index) => {
            const periodLabel = item.period === '99' ? '점심' : (item.period === '88' ? '방과후' : `${item.period}교시`);
            return `
                <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td style="text-align: center;">${item.usage_date}</td>
                    <td style="text-align: center;">${periodLabel}</td>
                    <td style="text-align: center;">${roomMap[item.lab_room_id] || '-'}</td>
                    <td style="text-align: center;">${item.grade ? `${item.grade}-${item.class_number}` : '-'}</td>
                    <td style="text-align: center;">${subjectMap[item.subject_id] || item.activity_type}</td>
                    <td style="text-align: center;">${teacherMap[item.teacher_id] || '-'}</td>
                    <td style="padding: 5px 8px;">${item.content || ''}</td>
                    <td style="text-align: center;">${item.safety_education}</td>
                </tr>
            `;
        }).join('');

        const printWindow = window.open('', '_blank', 'width=1000,height=800');
        if (!printWindow) {
            alert("팝업 차단을 해제해주세요.");
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: "Malgun Gothic", sans-serif; padding: 20px; }
                    h1 { text-align: center; margin-bottom: 5px; font-size: 24px; }
                    .meta { text-align: right; margin-bottom: 15px; font-size: 12px; color: #555; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #333; padding: 6px 4px; }
                    th { background-color: #f0f0f0; text-align: center; font-weight: bold; }
                    @media print {
                        @page { margin: 15mm; }
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <div class="meta">출력일: ${today} | 총 ${lastSearchResult.length}건</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px;">No</th>
                            <th style="width: 90px;">날짜</th>
                            <th style="width: 60px;">교시</th>
                            <th style="width: 100px;">장소</th>
                            <th style="width: 70px;">학급</th>
                            <th style="width: 120px;">과목</th>
                            <th style="width: 80px;">담당교사</th>
                            <th>활동 내용</th>
                            <th style="width: 60px;">안전</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                <script>
                    window.onload = function() {
                        window.print();
                        window.close();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    globalThis.App = globalThis.App || {};
    globalThis.App.LabUsageView = LabUsageView;
})();
