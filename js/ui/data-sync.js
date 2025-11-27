(function () {
    const DataSync = {
        // CSV 헤더와 DB 컬럼 매핑
        columnMapping: {
            "cas_nos": ["CAS No", "CAS번호", "cas_nos", "CAS"],
            "chem_name": ["물질명", "화학물질명", "chem_name", "Name"],
            "school_hazardous_standard": ["학교사용 유해물질 기준", "학교사용유해물질", "school_hazardous_standard"],
            "school_accident_precaution_standard": ["학교사용 사고대비물질 기준", "학교사용사고대비물질", "school_accident_precaution_standard"],
            "special_health_standard": ["특수건강진단 유해인자 기준", "특수건강진단", "special_health_standard"],
            "toxic_standard": ["유독물질 기준", "유독물질", "toxic_standard"],
            "permitted_standard": ["허가물질 기준", "허가물질", "permitted_standard"],
            "restricted_standard": ["제한물질 기준", "제한물질", "restricted_standard"],
            "prohibited_standard": ["금지물질 기준", "금지물질", "prohibited_standard"],
            "accident_precaution_standard": ["사고대비물질 기준", "사고대비물질", "accident_precaution_standard"]
        },

        init: function () {
            console.log("🔄 DataSync init");
            const btn = document.getElementById("btn-start-sync");
            if (btn) {
                btn.addEventListener("click", this.syncData.bind(this));
            }
        },

        log: function (msg, type = "info") {
            const logEl = document.getElementById("sync-log");
            if (!logEl) return;

            const div = document.createElement("div");
            div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            if (type === "error") div.style.color = "#ff4444";
            if (type === "success") div.style.color = "#00ccff";

            logEl.appendChild(div);
            logEl.scrollTop = logEl.scrollHeight;
            console.log(`[Sync] ${msg}`);
        },

        loadPapaParse: function () {
            return new Promise((resolve, reject) => {
                if (window.Papa) return resolve();

                const script = document.createElement("script");
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js";
                script.onload = resolve;
                script.onerror = () => reject("PapaParse 로드 실패");
                document.head.appendChild(script);
            });
        },

        // 헬퍼: 앞뒤 공백 제거 및 맨 앞의 따옴표(') 제거
        clean: function (val) {
            if (!val) return "";
            let s = val.trim();
            if (s.startsWith("'")) {
                s = s.substring(1);
            }
            return s;
        },

        syncData: async function () {
            const btn = document.getElementById("btn-start-sync");
            if (btn) btn.disabled = true;

            try {
                this.log("🚀 동기화 시작...");

                // 1. PapaParse 로드
                await this.loadPapaParse();
                this.log("✅ CSV 파서 로드 완료");

                // 2. CSV 파일 가져오기 (HazardList)
                this.log("📂 data/HazardList.csv 파일 읽는 중...");
                const response = await fetch("data/HazardList.csv");

                if (!response.ok) {
                    throw new Error(`파일을 찾을 수 없습니다. (Status: ${response.status})`);
                }

                const csvText = await response.text();
                this.log(`✅ 파일 읽기 성공 (${csvText.length} bytes)`);

                // 3. 파싱 (Header: false로 설정하여 인덱스로 접근)
                Papa.parse(csvText, {
                    header: false, // 헤더 없이 인덱스로 접근
                    skipEmptyLines: true,
                    complete: async (results) => {
                        if (results.errors.length > 0) {
                            this.log(`⚠️ 파싱 중 경고 발생: ${results.errors[0].message}`, "error");
                        }

                        // 첫 번째 행(헤더) 제거
                        const rows = results.data.slice(1);
                        await this.processData(rows);
                        
                        // HazardList 완료 후 SubstanceRef 동기화 시작
                        await this.syncSubstanceRef();

                        if (btn) btn.disabled = false;
                    },
                    error: (err) => {
                        throw err;
                    }
                });

            } catch (err) {
                this.log(`❌ 오류 발생: ${err.message}`, "error");
                if (btn) btn.disabled = false;
            }
        },

        processData: async function (rows) {
            this.log(`📊 총 ${rows.length}개 규제 데이터 발견. 물질별 병합 준비 중...`);

            // CAS 번호 기준으로 데이터 병합
            const chemicalMap = new Map();

            // 규제 구분 -> DB 컬럼 매핑
            const regulationMap = {
                "특수건강진단대상 유해인자": "special_health_standard",
                "유독물질": "toxic_standard",
                "허가물질": "permitted_standard",
                "제한물질": "restricted_standard",
                "금지물질": "prohibited_standard",
                "사고대비물질": "accident_precaution_standard",
                // CSV에 학교 관련 기준이 명시적으로 없다면 추후 로직 추가 필요
                // 현재 CSV 샘플에는 '특수...', '유독...' 등이 보임
            };

            let processedCount = 0;

            for (const row of rows) {
                // 인덱스 기반 접근
                // 0: 순번, 1: 근거, 2: 구분, 3: 구분2, 4: 구분3, 5: 구분기호, 6: CAS, 7: 기준, 8: 기준농도, 9: 물질명
                if (row.length < 10) continue;

                const cas = this.clean(row[6]);
                if (!cas) continue;

                const regulationType = this.clean(row[2]); // 구분
                const standardValue = this.clean(row[8]); // 기준농도 (예: 1%)
                let name = this.clean(row[9]); // 물질명

                // 물질명 정규화 (앞의 번호 제거: "1) ", "가. " 등)
                if (name) {
                    name = name.replace(/^(\d+\)|[가-하]\.)\s*/, "");
                }

                // CAS 번호 정규화 (||| -> , )
                const normalizedCas = cas.replace(/\|\|\|/g, ", ");

                if (!chemicalMap.has(normalizedCas)) {
                    chemicalMap.set(normalizedCas, {
                        cas_nos: normalizedCas,
                        chem_name: name, // 첫 번째 발견된 이름 사용
                        // 초기값 null
                        hazard_class: null, // 유해화학물질 분류 (구분)
                        school_hazardous_standard: null,
                        school_accident_precaution_standard: null,
                        special_health_standard: null,
                        toxic_standard: null,
                        permitted_standard: null,
                        restricted_standard: null,
                        prohibited_standard: null,
                        accident_precaution_standard: null
                    });
                }

                const chemData = chemicalMap.get(normalizedCas);

                // 이름이 더 긴 것이 있다면 업데이트 (정보가 더 많을 수 있으므로)
                if (name && name.length > chemData.chem_name.length) {
                    chemData.chem_name = name;
                }

                // hazard_class (구분) 병합
                if (regulationType) {
                    if (chemData.hazard_class) {
                        // 중복되지 않게 추가
                        if (!chemData.hazard_class.includes(regulationType)) {
                            chemData.hazard_class += `, ${regulationType}`;
                        }
                    } else {
                        chemData.hazard_class = regulationType;
                    }
                }

                // 규제 정보 매핑 (앞글자 2개 기준)
                let mappedCol = null;
                if (regulationType && regulationType.length >= 2) {
                    const prefix = regulationType.substring(0, 2);
                    if (prefix === "특수") mappedCol = "special_health_standard";
                    else if (prefix === "유독") mappedCol = "toxic_standard";
                    else if (prefix === "제한") mappedCol = "restricted_standard";
                    else if (prefix === "금지") mappedCol = "prohibited_standard";
                    else if (prefix === "허가") mappedCol = "permitted_standard";
                }

                if (mappedCol) {
                    // 이미 값이 있으면 이어붙이기 (혹은 덮어쓰기)
                    if (chemData[mappedCol]) {
                        chemData[mappedCol] += `, ${standardValue}`;
                    } else {
                        chemData[mappedCol] = standardValue || "해당"; // 값이 없으면 '해당' 등으로 표시
                    }
                }

                processedCount++;
            }

            const upsertData = Array.from(chemicalMap.values());
            this.log(`✅ 병합 완료: 총 ${upsertData.length}개 고유 화학물질 (원본 ${processedCount}행)`);

            // 4. 기존 데이터 삭제 (전체 삭제 후 재입력 방식)
            if (!confirm(`총 ${upsertData.length}개의 물질 데이터를 업데이트합니다.\n기존 데이터를 모두 삭제하고 덮어쓰시겠습니까?`)) {
                this.log("🚫 작업이 취소되었습니다.", "error");
                return;
            }

            this.log("🗑️ 기존 HazardList 데이터 삭제 중...");
            const { error: deleteError } = await App.supabase
                .from("HazardList")
                .delete()
                .neq("id", 0); // 모든 데이터 삭제

            if (deleteError) {
                this.log(`❌ 삭제 실패: ${deleteError.message}`, "error");
                return;
            }
            this.log("✅ 기존 HazardList 데이터 삭제 완료");

            // 5. Supabase 업로드 (배치 처리)
            const BATCH_SIZE = 100;
            const totalBatches = Math.ceil(upsertData.length / BATCH_SIZE);

            this.log(`💾 HazardList DB 저장 시작 (총 ${totalBatches} 배치)`);

            for (let i = 0; i < totalBatches; i++) {
                const start = i * BATCH_SIZE;
                const end = start + BATCH_SIZE;
                const batch = upsertData.slice(start, end);

                const { error } = await App.supabase
                    .from("HazardList")
                    .insert(batch);

                if (error) {
                    this.log(`❌ 배치 ${i + 1} 실패: ${error.message}`, "error");
                } else {
                    this.log(`✅ 배치 ${i + 1}/${totalBatches} 완료 (${batch.length}건)`);
                }
            }

            this.log("🎉 HazardList 동기화 작업이 완료되었습니다!", "success");
        },

        syncSubstanceRef: async function () {
            this.log("🚀 SubstanceRef 동기화 시작...");
            
            try {
                this.log("📂 data/casimport-correct.csv 파일 읽는 중...");
                const response = await fetch("data/casimport-correct.csv");
                
                if (!response.ok) {
                    throw new Error(`SubstanceRef 파일을 찾을 수 없습니다. (Status: ${response.status})`);
                }

                const csvText = await response.text();
                this.log(`✅ 파일 읽기 성공 (${csvText.length} bytes)`);

                // 파싱
                const results = Papa.parse(csvText, {
                    header: true, // 헤더 사용
                    skipEmptyLines: true
                });

                if (results.errors.length > 0) {
                    this.log(`⚠️ 파싱 중 경고 발생: ${results.errors[0].message}`, "error");
                }

                const rows = results.data;
                this.log(`📊 총 ${rows.length}개 SubstanceRef 데이터 발견.`);

                const insertData = rows.map(row => {
                    return {
                        cas_ref: this.clean(row.cas_ref),
                        chem_name_kor_ref: this.clean(row.chem_name_kor_ref),
                        substance_name_ref: this.clean(row.substance_name_ref),
                        molecular_formula_ref: this.clean(row.molecular_formula_ref)
                    };
                }).filter(item => item.cas_ref); // CAS 번호 없는 행 제외

                // 기존 데이터 삭제
                this.log("🗑️ 기존 SubstanceRef 데이터 삭제 중...");
                const { error: deleteError } = await App.supabase
                    .from("SubstanceRef")
                    .delete()
                    .neq("id", 0);

                if (deleteError) {
                    this.log(`❌ SubstanceRef 삭제 실패: ${deleteError.message}`, "error");
                    return;
                }
                this.log("✅ 기존 SubstanceRef 데이터 삭제 완료");

                // DB 저장 (배치)
                const BATCH_SIZE = 100;
                const totalBatches = Math.ceil(insertData.length / BATCH_SIZE);

                this.log(`💾 SubstanceRef DB 저장 시작 (총 ${totalBatches} 배치)`);

                for (let i = 0; i < totalBatches; i++) {
                    const start = i * BATCH_SIZE;
                    const end = start + BATCH_SIZE;
                    const batch = insertData.slice(start, end);

                    const { error } = await App.supabase
                        .from("SubstanceRef")
                        .insert(batch);

                    if (error) {
                        this.log(`❌ SubstanceRef 배치 ${i + 1} 실패: ${error.message}`, "error");
                    } else {
                        this.log(`✅ SubstanceRef 배치 ${i + 1}/${totalBatches} 완료`);
                    }
                }

                this.log("🎉 SubstanceRef 동기화 작업이 완료되었습니다!", "success");

            } catch (err) {
                this.log(`❌ SubstanceRef 오류 발생: ${err.message}`, "error");
            }
        }
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.DataSync = DataSync;
})();
