(function () {
    let VIDEO_LIST = [];
    let MANUAL_LIST_GROUPED = [];
    let QUIZ_STATE = {
        currentStep: 0,
        score: 0,
        userName: "",
        questions: []
    };

    const GHS_DATA = [
        { id: "01", name: "폭발성", desc: "불안정한 폭발물, 자기반응성 물질, 유기과산화물 등" },
        { id: "02", name: "인화성", desc: "인화성 가스, 액체, 고체, 에어로졸 등" },
        { id: "03", name: "산화성", desc: "산화성 가스, 액체, 고체" },
        { id: "04", name: "고압가스", desc: "압축가스, 액화가스, 냉동액화가스, 용해가스" },
        { id: "05", name: "부식성", desc: "금속부식성 물질, 피부 부식성, 심한 안구 손상" },
        { id: "06", name: "독성", desc: "급성 독성 (경구, 경피, 흡입)" },
        { id: "07", name: "감탄사", desc: "피부 자극성, 호흡기 자극성, 마취 효과" },
        { id: "08", name: "건강유해성", desc: "발암성, 생식독성, 호흡기 과민성, 흡인 위험" },
        { id: "09", name: "환경유해성", desc: "수생환경 유해성 (급성/만성)" }
    ];

    const SafetyEdu = {};

    SafetyEdu.init = async function () {
        try {
            console.log("🛡️ Safety Education Init - Logic Executing");
            const mainContent = document.getElementById('safety-edu-container');
            if (!mainContent) return;

            // 1. Force UI Transition (Hide Splash)
            document.body.classList.remove("home-active");

            // Show Loading State
            mainContent.innerHTML = '<div style="padding:40px; text-align:center;">데이터를 불러오는 중입니다...</div>';

            if (!App.supabase) throw new Error("Supabase Client is not initialized.");

            // 2. Fetch Data
            await fetchContentFromDB();

            // 3. Render Initial Structure
            renderBaseLayout(mainContent);

            // 4. Bind Events
            bindEvents(mainContent);

            // 5. Initial Tab
            switchTab('video-section');

            // 6. Role Check (Admin only can sync)
            checkAdminRole();

        } catch (err) {
            console.error("SafetyEdu Init Error:", err);
            document.getElementById('safety-edu-container').innerHTML = `<div style="padding:20px; color:red;">오류: ${err.message}</div>`;
        }
    };

    function renderBaseLayout(container) {
        container.innerHTML = `
            <div class="safety-main-container">
                <div class="safety-header-row">
                    <h1 class="safety-section-title">🧯 과학실 안전 교육</h1>
                    <button id="btn-sync-content" class="safety-sync-btn">🔄 최신 콘텐츠 동기화</button>
                </div>
                
                <div class="safety-tabs-container">
                    <button class="nav-tab active" data-target="video-section">영상 교육</button>
                    <button class="nav-tab" data-target="manual-section">매뉴얼/서식</button>
                    <button class="nav-tab" data-target="ghs-section">GHS 기호</button>
                    <button class="nav-tab" data-target="quiz-section">안전 퀴즈 & 인증</button>
                </div>

                <div class="safety-content-scroll-area">
                    <div id="video-section" class="tab-content" style="display:none;">
                        <div class="safety-video-grid">${renderVideos()}</div>
                    </div>

                    <div id="manual-section" class="tab-content" style="display:none;">
                        ${renderManuals()}
                    </div>

                    <div id="ghs-section" class="tab-content" style="display:none;">
                        <div class="ghs-grid">${renderGhsGrid()}</div>
                    </div>

                    <div id="quiz-section" class="tab-content" style="display:none;">
                        <div id="quiz-root"></div>
                        <div id="certificate-area" class="certificate-preview"></div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderVideos() {
        return VIDEO_LIST.map(v => `
            <div class="video-card">
                <div class="safety-video-wrapper">
                    <iframe class="safety-video-iframe" src="https://www.youtube.com/embed/${v.id}" title="${v.title}" frameborder="0" allowfullscreen></iframe>
                </div>
                <div class="safety-video-info">
                    <h3 class="safety-video-title">${v.title}</h3>
                </div>
            </div>
        `).join('');
    }

    function renderGhsGrid() {
        return GHS_DATA.map(item => `
            <div class="ghs-card" onclick="alert('${item.name}: ${item.desc}')">
                <img src="https://hazmat.nfa.go.kr/design/images/contents/ghs-icon${item.id}.gif" alt="${item.name}">
                <div class="ghs-card-title">GHS${item.id} ${item.name}</div>
            </div>
        `).join('');
    }

    function switchTab(targetId) {
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        document.querySelectorAll('.nav-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.target === targetId);
        });
        const target = document.getElementById(targetId);
        if (target) target.style.display = 'block';

        if (targetId === 'quiz-section') initQuiz();
    }

    function bindEvents(container) {
        container.querySelectorAll('.nav-tab').forEach(tab => {
            tab.onclick = () => switchTab(tab.dataset.target);
        });
        bindManualButtons();
    }

    // --- Quiz Logic ---
    function initQuiz() {
        const root = document.getElementById('quiz-root');
        if (QUIZ_STATE.questions.length > 0) return; // Already started

        root.innerHTML = `
            <div class="quiz-container">
                <div class="quiz-header">
                    <h2>스마트 과학실 안전 퀴즈</h2>
                    <p>우리 학교의 데이터를 활용한 퀴즈입니다. 80점 이상 인증서 발급!</p>
                </div>
                <div style="text-align:center; margin-top:20px;">
                    <input type="text" id="quiz-user-name" placeholder="이름을 입력하세요" style="padding:10px; border-radius:8px; border:1px solid #ddd; width:200px; margin-bottom:15px;"><br>
                    <button class="btn-primary" onclick="App.SafetyEdu.startQuiz()">시작하기</button>
                </div>
            </div>
        `;
    }

    SafetyEdu.startQuiz = async function() {
        const name = document.getElementById('quiz-user-name').value;
        if (!name) { alert("이름을 입력해주세요."); return; }
        
        QUIZ_STATE.userName = name;
        QUIZ_STATE.currentStep = 0;
        QUIZ_STATE.score = 0;
        
        // Load Quiz Bank
        QUIZ_STATE.questions = await generateHybridQuestions();
        renderNextQuestion();
    };

    async function generateHybridQuestions() {
        if (!App.SafetyQuizData) {
            console.error("SafetyQuizData not loaded!");
            return [];
        }

        const TOTAL_QUESTIONS = 20;
        const finalQuestions = [];

        // 1. Try to get safe quantity of Dynamic Questions (Max 10)
        try {
            const { data: invData } = await App.supabase
                .from('inventory')
                .select(`
                    id, 
                    location_area(name), 
                    location_cabinet(name),
                    substance (
                        chem_name_kor,
                        substance_name,
                        molecular_formula, 
                        cas_rn, 
                        molecular_mass,
                        school_hazardous_chemical_standard,
                        toxic_substance_standard,
                        permitted_substance_standard,
                        restricted_substance_standard,
                        prohibited_substance_standard
                    )
                `)
                .limit(50); // Fetch enough to pick randomly

            if (invData && invData.length > 0) {
                const invCopy = [...invData];
                // Decide how many dynamic questions to use (max 10, but not more than available items)
                const dynamicCount = Math.min(10, invCopy.length);
                
                // Inject ONE Mass Comparison Question if possible
                let massQuestionAdded = false;
                const massQ = App.SafetyQuizData.getMassComparisonQuestion(invCopy);
                if (massQ) {
                    finalQuestions.push(massQ);
                    massQuestionAdded = true;
                }

                // Fill remaining slots with Item-based questions
                const loopLimit = massQuestionAdded ? dynamicCount - 1 : dynamicCount;

                for (let i = 0; i < loopLimit; i++) {
                    const idx = Math.floor(Math.random() * invCopy.length);
                    // Use standard item
                    const item = invCopy[idx]; 
                    // Note: We don't splice here to keep 'invCopy' full for distractor generation if needed, 
                    // but to avoid duplicate questions about same item, we should splice?
                    // getDynamicTemplates needs 'allItems' for distractors.
                    // Let's splice to pick the main item, but pass original 'invData' as context for distractors.
                    
                    invCopy.splice(idx, 1); 
                    
                    // Get templates
                    const types = App.SafetyQuizData.getDynamicTemplates(item, invData);
                    if (types.length > 0) {
                        // Select one template randomly
                        const qData = types[Math.floor(Math.random() * types.length)];
                        finalQuestions.push(qData);
                    }
                }
            }
        } catch (e) {
            console.error("Dynamic question fetch failed, falling back to fixed pool", e);
        }

        // 2. Fill the rest from FIXED_POOL
        const needed = TOTAL_QUESTIONS - finalQuestions.length;
        const fixedPoolCopy = [...App.SafetyQuizData.FIXED_POOL];

        // Ensure we don't crash if pool is smaller than needed (though unlikely with ~40 items)
        const countToPick = Math.min(needed, fixedPoolCopy.length);

        for (let i = 0; i < countToPick; i++) {
            const idx = Math.floor(Math.random() * fixedPoolCopy.length);
            const rawQ = fixedPoolCopy.splice(idx, 1)[0];
            // Randomize options for fixed questions too
            finalQuestions.push(App.SafetyQuizData.randomizeFixedQuestion(rawQ));
        }

        // 3. Shuffle (Optional, but good for mixing dynamic and fixed)
        // Simple Fisher-Yates shuffle
        for (let i = finalQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [finalQuestions[i], finalQuestions[j]] = [finalQuestions[j], finalQuestions[i]];
        }

        return finalQuestions;
    }

    function renderNextQuestion() {
        const step = QUIZ_STATE.currentStep;
        const total = QUIZ_STATE.questions.length;
        const root = document.getElementById('quiz-root');

        if (step >= total) {
            showResult();
            return;
        }

        const q = QUIZ_STATE.questions[step];
        root.innerHTML = `
            <div class="quiz-container">
                <div class="quiz-progress"><div class="quiz-progress-inner" style="width:${(step / total) * 100}%"></div></div>
                <div class="quiz-question-box">
                    <div class="quiz-question-text">${step + 1}. ${q.q}</div>
                    <div class="quiz-options">
                        ${q.options.map((opt, idx) => `
                            <div class="quiz-option" onclick="App.SafetyEdu.checkAnswer(${idx})">${opt}</div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    SafetyEdu.checkAnswer = function(idx) {
        const step = QUIZ_STATE.currentStep;
        if (idx === QUIZ_STATE.questions[step].correct) {
            QUIZ_STATE.score += 100 / QUIZ_STATE.questions.length;
        }
        QUIZ_STATE.currentStep++;
        renderNextQuestion();
    };

    function showResult() {
        const score = Math.round(QUIZ_STATE.score);
        const root = document.getElementById('quiz-root');
        const pass = score >= 80;

        root.innerHTML = `
            <div class="quiz-container" style="text-align:center;">
                <h2 style="font-size:2rem; margin-bottom:20px;">결과: ${score}점</h2>
                <p>${pass ? "🎉 축하합니다! 과학실 안전교육을 성실히 이수하셨습니다." : "😅 아깝네요. 다시 한 번 도전해 보세요!"}</p>
                <div style="margin-top:30px;">
                    ${pass ? `<button class="btn-primary" onclick="App.SafetyEdu.showCertificate()">인증서 발급하기</button>` : `<button class="btn-cancel" onclick="location.reload()">다시 하기</button>`}
                </div>
            </div>
        `;
    }

    SafetyEdu.showCertificate = function() {
        const area = document.getElementById('certificate-area');
        area.style.display = 'block';
        area.innerHTML = `
            <div id="print-zone">
                <div class="cert-title">과학실 안전교육 이수 인증서</div>
                <div class="cert-content">
                    <p style="font-size:1.8rem; margin-bottom:40px;">성명: <strong>${QUIZ_STATE.userName}</strong></p>
                    <p>위 학생은 SciManager를 통한 과학실험<br>안전교육 과정을 우수한 성적으로 이수하였기에<br>이 인증서를 수여합니다.</p>
                    <p style="margin-top:50px;">${new Date().toLocaleDateString()}</p>
                    <div style="margin-top:40px; font-weight:bold; font-size:1.8rem;">${App.APP_CONFIG?.SCHOOL || 'GOE학교'}</div>
                </div>
                <div style="margin-top:30px; text-align:right;">[SciManager Safety Certificate #SD-${Math.floor(Math.random()*9000)+1000}]</div>
            </div>
            <button class="btn-primary" onclick="window.print()" style="margin-top:20px;">프린트 하기</button>
        `;
        area.scrollIntoView({ behavior: 'smooth' });
    };

    // --- Fetch Logic ---
    async function fetchContentFromDB() {
        const { data, error } = await App.supabase.from('safety_content').select('*').order('display_order', { ascending: true });
        if (error) throw error;
        VIDEO_LIST = data.filter(item => item.content_type === 'video').map(item => ({ category: item.category, title: item.title, id: item.external_id }));
        const manuals = data.filter(item => item.content_type === 'pdf');
        const groups = {};
        manuals.forEach(m => { if (!groups[m.category]) groups[m.category] = []; groups[m.category].push({ title: m.title, fileId: m.external_id }); });
        MANUAL_LIST_GROUPED = Object.keys(groups).map(key => ({ category: key, items: groups[key] }));
    }

    function renderManuals() {
        return MANUAL_LIST_GROUPED.map((cat, idx) => `
            <div class="safety-manual-section">
                <h3 class="safety-manual-category">${cat.category}</h3>
                <div class="manual-pdf-container">
                    ${cat.items.map(item => `<button class="manual-btn" data-file="${item.fileId}"><span class="material-symbols-outlined" style="font-size:18px;">picture_as_pdf</span> ${item.title}</button>`).join('')}
                </div>
                <div class="pdf-viewer-box safety-pdf-viewer"></div>
            </div>
        `).join('');
    }

    function bindManualButtons() {
        document.querySelectorAll('.manual-btn').forEach(btn => {
            btn.onclick = () => {
                const viewerBox = btn.closest('div').nextElementSibling;
                const fileId = btn.dataset.file;
                if (btn.classList.contains('active')) {
                    btn.classList.remove('active');
                    viewerBox.style.height = '0';
                    viewerBox.innerHTML = '';
                    return;
                }
                btn.closest('.safety-manual-section').querySelectorAll('.manual-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                viewerBox.innerHTML = `<iframe src="https://drive.google.com/file/d/${fileId}/preview" width="100%" height="600" style="border:none;"></iframe>`;
                viewerBox.style.height = '600px';
                viewerBox.style.marginTop = '10px';
                viewerBox.style.border = '1px solid #ddd';
            };
        });
    }

    function checkAdminRole() {
        if (App.Auth && App.Auth.isAdmin && App.Auth.isAdmin()) {
            const btn = document.getElementById('btn-sync-content');
            if (btn) {
                btn.style.display = 'block';
                btn.onclick = triggerContentSync;
            }
        }
    }

    async function triggerContentSync() {
        if (!confirm("구글 사이트(원본)의 최신 내용으로 동기화하시겠습니까?")) return;
        const btn = document.getElementById('btn-sync-content');
        btn.disabled = true;
        btn.textContent = "동기화 중...";
        const { data, error } = await App.supabase.functions.invoke('sync-content', { body: { target: 'safety' } });
        if (error) { alert("동기화 실패: " + error.message); btn.textContent = "🔄 최신 콘텐츠 동기화"; btn.disabled = false; }
        else { alert(data.message || "동기화 완료!"); location.reload(); }
    }

    globalThis.App = globalThis.App || {};
    globalThis.App.SafetyEdu = SafetyEdu;
})();
