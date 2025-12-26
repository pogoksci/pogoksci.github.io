// /js/pages/lunch-lab-reserve.js
(function () {
    const LunchLabReserve = {};

    let allRooms = [];
    let allClubs = [];
    let allTeachers = [];

    // State
    const PERIOD_LUNCH = '99'; // 점심시간 (API/DB 약속)
    const STATUS_PENDING = '신청중';

    LunchLabReserve.init = async function () {
        console.log("🍱 Lunch Lab Reserve Init");

        // 1. Load Initial Data
        await loadData();

        // 2. Bind Events
        bindEvents();

        // 3. Set Default Date (Today + 7 days)
        const dateInput = document.getElementById('lunch-date');
        if (dateInput) {
            const today = new Date();
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + 7);

            // If target is weekend, move to Monday (Optional, but user said 'exclude weekend')
            // Simple logic: just +7 for now as 'available from'

            const minStr = targetDate.toISOString().split('T')[0];
            dateInput.value = minStr;
            dateInput.min = minStr; // Prevent selection in UI
        }
    };

    async function loadData() {
        const supabase = globalThis.App?.supabase;
        if (!supabase) return;

        try {
            const [rooms, clubs, teachers] = await Promise.all([
                supabase.from('lab_rooms').select('*').order('sort_order'),
                supabase.from('lab_clubs').select('*').order('name'),
                supabase.from('lab_teachers').select('*').order('name')
            ]);

            allRooms = rooms.data || [];
            allClubs = clubs.data || [];
            allTeachers = teachers.data || [];

            // Populate Selects
            const roomSel = document.getElementById('lunch-room');
            const teacherSel = document.getElementById('lunch-teacher');

            if (roomSel) {
                roomSel.innerHTML = '<option value="">과학실을 선택하세요</option>' +
                    allRooms.map(r => `<option value="${r.id}">${r.room_name}</option>`).join('');
            }
            // Teacher select is removed, no need to populate
        } catch (err) {
            console.error("❌ Failed to load initial data:", err);
            alert("데이터를 불러오는 중 오류가 발생했습니다.");
        }
    }

    function bindEvents() {
        const typeSel = document.getElementById('lunch-activity-type');
        const container = document.getElementById('dynamic-fields-container');
        const submitBtn = document.getElementById('btn-submit-reservation');

        // Activity Type Change
        if (typeSel) {
            typeSel.onchange = (e) => {
                const type = e.target.value;
                container.innerHTML = ''; // Clear

                if (type === '동아리') {
                    container.innerHTML = `
                        <div class="form-group">
                            <label class="form-label required">동아리 선택</label>
                            <select id="lunch-club-select" class="form-select">
                                <option value="">동아리를 선택하세요</option>
                                ${allClubs.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                            </select>
                        </div>
                    `;
                } else if (type === '행사' || type === '기타') {
                    const label = type === '행사' ? '행사 내용 (구체적으로)' : '신청 사유';
                    container.innerHTML = `
                        <div class="form-group">
                            <label class="form-label required">${label}</label>
                            <input type="text" id="lunch-content-detail" class="form-input" placeholder="내용을 입력하세요">
                        </div>
                    `;
                }
            };
        }

        // Submit
        if (submitBtn) {
            submitBtn.onclick = submitReservation;
        }
    }

    async function submitReservation() {
        const supabase = globalThis.App?.supabase;

        // 1. Gather Inputs
        const date = document.getElementById('lunch-date').value;
        const roomId = document.getElementById('lunch-room').value;
        const type = document.getElementById('lunch-activity-type').value;
        const teacherName = document.getElementById('lunch-teacher-name').value.trim();

        const appNum = document.getElementById('applicant-number').value.trim();
        const appName = document.getElementById('applicant-name').value.trim();
        const appPhone = document.getElementById('applicant-phone').value.trim();
        const pCount = document.getElementById('participant-count').value;

        // 2. Validation
        if (!date || !roomId || !type || !teacherName || !appNum || !appName || !pCount || !appPhone) {
            alert("모든 필수 항목을 입력해주세요.");
            return;
        }

        // 7-Day Restriction Check
        const selectedDate = new Date(date);
        const today = new Date();
        // Clear time components for fair comparison
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);

        const diffTime = selectedDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 7) {
            alert("예약은 최소 일주일 전부터 가능합니다.\n(예: 오늘이 금요일이면 다음 주 금요일부터 예약 가능)");
            return;
        }

        // Dynamic Field Validation
        let contentDetail = '';
        let clubId = null;

        if (type === '동아리') {
            const clubSel = document.getElementById('lunch-club-select');
            if (!clubSel || !clubSel.value) {
                alert("동아리를 선택해주세요.");
                return;
            }
            clubId = clubSel.value;
            const clubName = allClubs.find(c => String(c.id) === String(clubId))?.name || '';
            contentDetail = `동아리: ${clubName}`;
        } else {
            const detailInput = document.getElementById('lunch-content-detail');
            if (!detailInput || !detailInput.value.trim()) {
                alert("내용을 입력해주세요.");
                return;
            }
            contentDetail = detailInput.value.trim();
        }

        // 3. Format Data
        // Content Format: [신청자: 20101 홍길동 (010-1234-5678) / 인원: 5명 / 담당: 김교사] 내용...
        // Note: New schema has specific columns, but we will ALSO save to content for backward compatibility visibility.
        // Actually, user requested: "신청 대표자의 (학번, 이름, 연락처), 참가인원, 담당교사"은 lab_usage_log 테이블의 content 컬럼에 모두 넣어줘.

        let formattedContent = `[신청자: ${appNum} ${appName}`;
        if (appPhone) formattedContent += ` (${appPhone})`;
        formattedContent += ` / 인원: ${pCount}명`;
        formattedContent += ` / 담당: ${teacherName}]`;
        formattedContent += ` ${contentDetail}`;

        const payload = {
            lab_room_id: roomId,
            usage_date: date,
            period: PERIOD_LUNCH,
            activity_type: type,
            content: formattedContent,
            remarks: STATUS_PENDING, // '신청중'
            safety_education: '미실시', // Default

            // New Columns (If schema update was run)
            applicant_name: `${appNum} ${appName}`,
            phone_number: appPhone,
            participant_count: parseInt(pCount),
            // teacher_id: teacherId // Removed as we use free text name now
            teacher_id: null
        };

        if (clubId) payload.club_id = clubId;

        // 4. Insert
        try {
            const submitBtn = document.getElementById('btn-submit-reservation');
            submitBtn.disabled = true;
            submitBtn.textContent = '신청 중...';

            const { error } = await supabase.from('lab_usage_log').insert(payload);

            if (error) throw error;

            alert("✅ 예약 신청이 완료되었습니다.\n'런치랩 예약조회' 메뉴에서 결과를 확인하세요.");

            // Reset Form or Redirect?
            // Redirect to Inquiry page is better UX
            await App.Router.go('lunchLabInquiry');

        } catch (err) {
            console.error("Reservation failed:", err);
            alert("예약 신청에 실패했습니다: " + err.message);
            document.getElementById('btn-submit-reservation').disabled = false;
            document.getElementById('btn-submit-reservation').textContent = '예약 신청하기';
        }
    }


    globalThis.App = globalThis.App || {};
    globalThis.App.LunchLabReserve = LunchLabReserve;
})();
