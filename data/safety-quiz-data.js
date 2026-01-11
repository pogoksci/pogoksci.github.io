(function () {
    const FIXED_POOL = [
        { q: "GHS01 그림문자가 의미하는 것은?", options: ["폭발성", "인화성", "산화성", "독성"], correct: 0 },
        { q: "GHS02 그림문자가 의미하는 것은?", options: ["폭발성", "인화성", "산화성", "부식성"], correct: 1 },
        { q: "GHS03 그림문자가 의미하는 것은?", options: ["인화성", "산화성", "고압가스", "부식성"], correct: 1 },
        { q: "GHS04 그림문자가 의미하는 것은?", options: ["산화성", "고압가스", "부식성", "독성"], correct: 1 },
        { q: "GHS05 그림문자가 의미하는 것은?", options: ["부식성", "독성", "감탄사", "건강유해성"], correct: 0 },
        { q: "GHS06 그림문자가 의미하는 것은?", options: ["부식성", "급성 독성", "감탄사", "환경유해성"], correct: 1 },
        { q: "GHS07 그림문자가 의미하는 것은?", options: ["독성", "피부 자극성/감탄사", "건강유해성", "환경유해성"], correct: 1 },
        { q: "GHS08 그림문자가 의미하는 것은?", options: ["독성", "감탄사", "건강유해성(발암성 등)", "환경유해성"], correct: 2 },
        { q: "GHS09 그림문자가 의미하는 것은?", options: ["건강유해성", "환경유해성", "물 보존성", "산소 부족"], correct: 1 },
        { q: "인화성 액체를 보관할 때 가장 적절한 장소는?", options: ["직사광선이 드는 창가", "환기가 잘 되는 서늘한 곳", "가열 기구 바로 옆", "밀폐된 두꺼운 상자"], correct: 1 },
        { q: "강산(Strong Acid)이 피부에 묻었을 때 가장 먼저 해야 할 조치는?", options: ["중화제를 바른다", "흐르는 물에 20분 이상 씻는다", "수건으로 닦아낸다", "비누로 문지른다"], correct: 1 },
        { q: "눈에 화학물질이 들어갔을 때 안구 세척기를 사용하는 올바른 시간은?", options: ["1분 이내", "5분", "15분 이상", "마를 때까지"], correct: 2 },
        { q: "유기 용제(에탄올, 아세톤 등) 사용 시 주의사항으로 틀린 것은?", options: ["환기를 충분히 한다", "화기 엄금", "증기를 직접 흡입하지 않는다", "밀폐된 공간에서 장시간 사용한다"], correct: 3 },
        { q: "소화기 사용법 중 'PASS'의 'P'가 의미하는 것은?", options: ["Push (밀기)", "Pull (안전핀 뽑기)", "Point (조준)", "Press (누르기)"], correct: 1 },
        { q: "실험실에서 반드시 착용해야 하는 기본 복장이 아닌 것은?", options: ["실험복", "보안경", "슬리퍼", "밀폐된 신발"], correct: 2 },
        { q: "화학물질의 유해성 정보를 확인할 수 있는 가장 정확한 문서는?", options: ["교과서", "MSDS (물질안전보건자료)", "신문 기사", "백과사전"], correct: 1 },
        { q: "폐액을 버릴 때 올바른 방법은?", options: ["싱크대에 바로 버린다", "성상별(산, 염기 등)로 구분하여 폐액통에 버린다", "모든 폐액을 한 통에 합친다", "일반 쓰레기통에 버린다"], correct: 1 },
        { q: "실험실 내에서 음식물 섭취가 금지되는 이유는?", options: ["화학물질 오염 및 섭취 위험", "교실이 더러워져서", "음식 냄새가 독해서", "집중력이 떨어져서"], correct: 0 },
        { q: "화학 사고 발생 시 신고 번호로 적절하지 않은 것은?", options: ["119 (소방서)", "112 (경찰서)", "100 (국어사전)", "학교 행정실"], correct: 2 },
        { q: "사용이 끝난 가스버너의 안전 조치로 옳은 것은?", options: ["연료통을 그대로 둔다", "밸브를 잠그고 연료통을 분리한다", "불만 끄고 나간다", "뜨거울 때 바로 가방에 넣는다"], correct: 1 },
        { q: "알칼리 금속(나트륨 등)을 보관하는 올바른 방법은?", options: ["물에 담가둔다", "공기 중에 둔다", "석유나 파라핀 오일에 담가둔다", "알코올에 넣어둔다"], correct: 2 },
        { q: "보안경을 쓰는 주된 이유는 무엇인가?", options: ["시력 보호", "화학물질이 눈에 튀는 것 방지", "패션 아이템", "먼지 차단"], correct: 1 },
        { q: "실험실 안전 수칙 중 '화기 엄금'이 필요한 물질은?", options: ["증류수", "염화나트륨", "에탄올", "이산화탄소"], correct: 2 },
        { q: "MSDS의 구성 항목은 총 몇 개인가?", options: ["10개", "12개", "16개", "20개"], correct: 2 },
        { q: "수은이 엎질러졌을 때 대처법으로 옳은 것은?", options: ["빗자루로 쓴다", "손으로 줍는다", "전용 흡착제나 황가루를 뿌리고 신고한다", "걸레로 닦는다"], correct: 2 },
        { q: "실험 전 가장 먼저 확인해야 할 위치는?", options: ["매점 위치", "화장실 위치", "비상구 및 안전장비(소방시설) 위치", "도서관 위치"], correct: 2 },
        { q: "화학물질 용기에 라벨을 붙이는 이유는?", options: ["예뻐서", "내용물을 식별하고 유의사항을 알기 위해", "선생님이 시켜서", "유통기한을 적기 위해"], correct: 1 },
        { q: "흄 후드(Fume Hood)의 용도는?", options: ["음식 조리", "유독 가스 배출", "보관함", "손 씻기"], correct: 1 },
        { q: "시약장 문을 항상 닫아두어야 하는 이유는?", options: ["전기 절약", "유출 사고 방지 및 냄새 확산 방지", "디자인 때문", "먼지 방지"], correct: 1 },
        { q: "실험실 사고 시 가장 먼저 연락해야 할 사람은?", options: ["친구", "담당 선생님", "교장 선생님", "학부모"], correct: 1 },
        { q: "산성 폐액통에 염기성 액체를 대량으로 섞으면?", options: ["아무 일 없다", "중화 반응에 의한 열과 가스가 발생할 수 있다", "물이 된다", "색만 변한다"], correct: 1 },
        { q: "유리 기구가 깨졌을 때 조치법은?", options: ["손으로 줍는다", "담당 선생님께 보고하고 빗자루와 쓰레받기를 사용한다", "발로 치운다", "그냥 둔다"], correct: 1 },
        { q: "머리카락이 긴 학생의 실험실 복장 수칙은?", options: ["그냥 둔다", "풀어헤친다", "뒤로 묶는다", "앞으로 내린다"], correct: 2 },
        { q: "가열 중인 시험관의 입구 방향은?", options: ["자신을 향하게", "옆 친구를 향하게", "사람이 없는 방향을 향하게", "입구를 막는다"], correct: 2 },
        { q: "전기 기구 사용 시 젖은 손으로 만지면 안 되는 이유는?", options: ["손이 미끄러워서", "감전의 위험이 커서", "기구가 고장 나서", "손자국이 남아서"], correct: 1 },
        { q: "실험 후 남은 시약을 다시 시약병에 넣지 않는 이유는?", options: ["아까워서", "본래 시약의 오염 방지", "병이 작아서", "귀찮아서"], correct: 1 },
        { q: "독성 물질을 취급할 때 착용해야 하는 장갑은?", options: ["면장갑", "니트릴 또는 화학용 고무장갑", "털장갑", "안 껴도 됨"], correct: 1 },
        { q: "실험실 환풍기를 항상 가동해야 하는 이유는?", options: ["시원하게 하려고", "공기 중 유해 가스 농도를 낮추기 위해", "소음을 내기 위해", "전등을 켜기 위해"], correct: 1 },
        { q: "비상 샤워기의 용도는?", options: ["더위 식히기", "몸 전체에 화학물질이 묻었을 때 대량의 물로 씻어내기", "청소용", "화단 물주기"], correct: 1 },
        { q: "화학물질의 냄새를 맡는 올바른 방법은?", options: ["코를 대고 깊게 들이마신다", "손으로 바람을 일으켜 살짝 맡는다", "냄새를 맡지 않는다", "입으로 마신다"], correct: 1 }
    ];

    /**
     * Generates a set of possible question templates for a given inventory item.
     * @param {Object} item - Inventory item with substance, location_area, etc.
     * @returns {Array} Array of question objects
     */
    /**
     * Generates a set of possible question templates for a given inventory item.
     * @param {Object} item - Inventory item
     * @param {Array} allItems - Full list of items for generating distractors
     * @returns {Array} Array of question objects
     */
    /**
     * Helper to create a randomized question object.
     * Shuffles options and finds the new index for the correct answer.
     */
    function createRandomizedQuestion(questionText, correctAnswer, wrongAnswers) {
        // 1. Combine correct answer and distractors (max 3 distractors)
        const pool = [correctAnswer, ...wrongAnswers.slice(0, 3)];
        
        // 2. Shuffle
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        
        // 3. Find new index of correct answer
        const correctIndex = pool.indexOf(correctAnswer);
        
        return {
            q: questionText,
            options: pool,
            correct: correctIndex
        };
    }

    /**
     * Generates a set of possible question templates for a given inventory item.
     * @param {Object} item - Inventory item
     * @param {Array} allItems - Full list of items for generating distractors
     * @returns {Array} Array of question objects
     */
    function getDynamicTemplates(item, allItems = []) {
        const templates = [];
        const s = item.substance || {};
        const c = item.location_cabinet || {};
        const a = item.location_area || {};
        
        // Helper to pick distractors
        const pickDistractors = (sourceList, correctVal, count = 3) => {
            const others = sourceList.filter(v => v && v !== correctVal);
            // Shuffle
            for (let i = others.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [others[i], others[j]] = [others[j], others[i]];
            }
            return others.slice(0, count);
        };

        // 1. Storage Location (Detailed)
        const locName = `${a.name || ''} ${c.name || ''}`.trim();
        if (locName) {
            templates.push(createRandomizedQuestion(
                `'${s.chem_name_kor}'의 보관 위치로 올바른 곳은?`,
                locName,
                ["교무실", "가정과 실습실", "행정실", "음악실", "체육관"] // Pool of wrong answers
            ));
        }

        // 2. Chemical Formula
        if (s.molecular_formula && s.molecular_formula.length > 1) {
             const distractors = pickDistractors(
                 allItems.map(i => i.substance?.molecular_formula).filter(f => f && f.length > 1),
                 s.molecular_formula
             );
             if (distractors.length < 3) distractors.push("H2O", "NaCl", "CO2"); // Fallbacks
             
             templates.push(createRandomizedQuestion(
                `'${s.chem_name_kor}'의 화학식으로 올바른 것은?`,
                s.molecular_formula,
                distractors
            ));
        }

        // 3. CAS Number (Advanced)
        if (s.cas_rn && /^\d+-\d+-\d$/.test(s.cas_rn)) {
             const distractors = pickDistractors(
                 allItems.map(i => i.substance?.cas_rn).filter(c => c && /^\d+-\d+-\d$/.test(c)),
                 s.cas_rn
             );
             if (distractors.length < 3) distractors.push("7732-18-5", "7647-14-5", "64-17-5"); // Water, Salt, Ethanol

             templates.push(createRandomizedQuestion(
                `'${s.chem_name_kor}'의 CAS 등록번호(고유번호)는?`,
                s.cas_rn,
                distractors
            ));
        }

        // 4. Hazard Classification
        const hazards = [];
        if (s.toxic_substance_standard === 'Y') hazards.push("유독물질");
        if (s.restricted_substance_standard === 'Y') hazards.push("제한물질");
        if (s.prohibited_substance_standard === 'Y') hazards.push("금지물질");
        if (s.school_hazardous_chemical_standard === 'Y') hazards.push("학교유해화학물질");
        if (s.school_hazardous_chemical_standard !== 'Y' && s.toxic_substance_standard !== 'Y') hazards.push("일반물질(해당없음)");

        if (hazards.length > 0) {
            const answer = hazards[0];
            const hazardOptions = ["유독물질", "제한물질", "금지물질", "학교유해화학물질", "일반물질(해당없음)"].filter(o => o !== answer);
            
            templates.push(createRandomizedQuestion(
                `'${s.chem_name_kor}'은(는) 학교 안전관리 기준상 어떻게 분류됩니까?`,
                answer,
                hazardOptions
            ));
        }

        // 5. English Name Quiz
        if (s.substance_name) {
             const distractors = pickDistractors(
                 allItems.map(i => i.substance?.substance_name).filter(n => n && n !== s.substance_name),
                 s.substance_name
             );
             if (distractors.length < 3) distractors.push("Water", "Sodium Chloride", "Ethanol");

             templates.push(createRandomizedQuestion(
                `'${s.chem_name_kor}'의 영문명으로 올바른 것은?`,
                s.substance_name,
                distractors
            ));
        }

        // 6. Reverse Formula Quiz
        if (s.molecular_formula && s.molecular_formula.length > 1) {
            // Distractors are other Korean names
             const distractors = pickDistractors(
                 allItems.map(i => i.substance?.chem_name_kor).filter(n => n && n !== s.chem_name_kor),
                 s.chem_name_kor
             );
             if (distractors.length < 3) distractors.push("물", "염화나트륨", "에탄올");

             templates.push(createRandomizedQuestion(
                `다음 화학식을 가진 물질은? [ ${s.molecular_formula} ]`,
                s.chem_name_kor,
                distractors
            ));
        }

        // 7. Reverse CAS Quiz
        if (s.cas_rn && /^\d+-\d+-\d$/.test(s.cas_rn)) {
             const distractors = pickDistractors(
                 allItems.map(i => i.substance?.chem_name_kor).filter(n => n && n !== s.chem_name_kor),
                 s.chem_name_kor
             );
             if (distractors.length < 3) distractors.push("물", "염화나트륨", "에탄올");

             templates.push(createRandomizedQuestion(
                `다음 CAS 번호(고유번호)에 해당하는 물질은? [ ${s.cas_rn} ]`,
                s.chem_name_kor,
                distractors
            ));
        }

        return templates;
    }

    /**
     * Generates a "Which is heaviest?" question from a list of items.
     */
    function getMassComparisonQuestion(items) {
        const validItems = items.filter(i => {
             const m = parseFloat(i.substance?.molecular_mass);
             return m > 0 && i.substance?.chem_name_kor;
        });

        if (validItems.length < 4) return null;

        // Shuffle and pick 4 unique items
        const picked = [];
        const indices = new Set();
        while(picked.length < 4) {
            const idx = Math.floor(Math.random() * validItems.length);
            if (!indices.has(idx)) {
                indices.add(idx);
                picked.push(validItems[idx]);
            }
        }

        // Find max mass
        let maxItem = picked[0];
        let maxMass = parseFloat(picked[0].substance.molecular_mass);
        
        picked.forEach(p => {
            const m = parseFloat(p.substance.molecular_mass);
            if (m > maxMass) {
                maxMass = m;
                maxItem = p;
            }
        });

        const correctName = maxItem.substance.chem_name_kor;
        
        // This time, picked IS the pool (4 items). 
        // We just need to shuffle their names and find the index of the correct name.
        const options = picked.map(p => p.substance.chem_name_kor);
        
        // Shuffle options
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        
        const correctIndex = options.indexOf(correctName);

        return {
            q: "다음 중 분자량이 가장 큰(무거운) 물질은 무엇입니까?",
            options: options,
            correct: correctIndex
        };
    }

    function getFallbackDynamicQuestions() {
        // Return a list of fallback questions if DB fetch fails or returns empty
        const list = [];
        for (let i = 0; i < 10; i++) {
            list.push(createRandomizedQuestion(
                `스마트 과학실 관리 시스템의 이름은?`, 
                "SciManager", 
                ["LabHelper", "SafeSchool", "SmartLab"]
            ));
        }
        return list;
    }

    /**
     * Shuffles the options of a fixed question object.
     * @param {Object} original - { q, options, correct }
     */
    function randomizeFixedQuestion(original) {
        const correctVal = original.options[original.correct];
        const wrongs = original.options.filter((_, i) => i !== original.correct);
        return createRandomizedQuestion(original.q, correctVal, wrongs);
    }

    globalThis.App = globalThis.App || {};
    globalThis.App.SafetyQuizData = {
        FIXED_POOL: FIXED_POOL,
        getDynamicTemplates: getDynamicTemplates,
        getFallbackDynamicQuestions: getFallbackDynamicQuestions,
        getMassComparisonQuestion: getMassComparisonQuestion,
        randomizeFixedQuestion: randomizeFixedQuestion
    };
})();
