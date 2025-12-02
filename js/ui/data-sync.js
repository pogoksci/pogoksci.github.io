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
            "prohibited_standard": ["금지물질 기준", "금지물질", "prohibited_standard"]
        },

        init: function () {
            console.log("🔄 DataSync init");

            const btnHazard = document.getElementById("btn-sync-hazard");
            if (btnHazard) btnHazard.addEventListener("click", () => this.syncHazardList(btnHazard));

            const btnCas = document.getElementById("btn-sync-cas");
            if (btnCas) btnCas.addEventListener("click", () => this.syncSubstanceRef(btnCas));

            const btnKit = document.getElementById("btn-sync-kit");
            if (btnKit) btnKit.addEventListener("click", () => this.syncExperimentKits(btnKit));
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

        clean: function (val) {
            if (!val) return null;
            let s = String(val).trim();
            if (s === "" || s === "EMPTY") return null;
            if (s.startsWith("'")) {
                s = s.substring(1);
            }
            return s;
        },

        // 1. HazardList Sync
        syncHazardList: async function (btn) {
            if (btn) btn.disabled = true;
            try {
                this.log("🚀 유해화학물질 동기화 시작...");
                await this.loadPapaParse();

                this.log("📂 data/HazardList.csv 파일 읽는 중...");
                const response = await fetch("data/HazardList.csv");
                if (!response.ok) throw new Error(`파일을 찾을 수 없습니다. (Status: ${response.status})`);

                const csvText = await response.text();
                this.log(`✅ 파일 읽기 성공 (${csvText.length} bytes)`);

                Papa.parse(csvText, {
                    header: false,
                    skipEmptyLines: true,
                    complete: async (results) => {
                        if (results.errors.length > 0) {
                            this.log(`⚠️ 파싱 중 경고 발생: ${results.errors[0].message}`, "error");
                        }
                        const rows = results.data.slice(1); // Remove header
                        await this.processHazardData(rows);
                        if (btn) btn.disabled = false;
                    },
                    error: (err) => { throw err; }
                });
            } catch (err) {
                this.log(`❌ 오류 발생: ${err.message}`, "error");
                if (btn) btn.disabled = false;
            }
        },

        processHazardData: async function (rows) {
            this.log(`📊 총 ${rows.length}개 규제 데이터 처리 중...`);
            const chemicalMap = new Map();

            let processedCount = 0;
            for (const row of rows) {
                if (row.length < 10) continue;
                const cas = this.clean(row[6]);
                if (!cas) continue;

                const regulationType = this.clean(row[2]);
                const standardValue = this.clean(row[8]);
                let name = this.clean(row[9]);

                if (name) name = name.replace(/^(\d+\)|[가-하]\.)\s*/, "");
                const normalizedCas = cas.replace(/\|\|\|/g, ", ");

                if (!chemicalMap.has(normalizedCas)) {
                    chemicalMap.set(normalizedCas, {
                        cas_nos: normalizedCas,
                        chem_name: name,
                        hazard_class: null,
                        school_hazardous_standard: null,
                        school_accident_precaution_standard: null,
                        special_health_standard: null,
                        toxic_standard: null,
                        permitted_standard: null,
                        restricted_standard: null,
                        prohibited_standard: null
                    });
                }

                const chemData = chemicalMap.get(normalizedCas);
                if (name && name.length > chemData.chem_name.length) chemData.chem_name = name;

                if (regulationType) {
                    if (chemData.hazard_class) {
                        if (!chemData.hazard_class.includes(regulationType)) {
                            chemData.hazard_class += `, ${regulationType}`;
                        }
                    } else {
                        chemData.hazard_class = regulationType;
                    }
                }

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
                    if (chemData[mappedCol]) chemData[mappedCol] += `, ${standardValue}`;
                    else chemData[mappedCol] = standardValue || "해당";
                }
                processedCount++;
            }

            const upsertData = Array.from(chemicalMap.values());

            if (!confirm(`총 ${upsertData.length}개의 물질 데이터를 업데이트합니다.\n기존 데이터를 모두 삭제하고 덮어쓰시겠습니까?`)) {
                this.log("🚫 작업이 취소되었습니다.", "error");
                return;
            }

            this.log("🗑️ 기존 HazardList 데이터 삭제 중...");
            const { error: deleteError } = await App.supabase.from("HazardList").delete().neq("id", 0);
            if (deleteError) {
                this.log(`❌ 삭제 실패: ${deleteError.message}`, "error");
                return;
            }

            const BATCH_SIZE = 100;
            const totalBatches = Math.ceil(upsertData.length / BATCH_SIZE);
            this.log(`💾 DB 저장 시작 (총 ${totalBatches} 배치)`);

            for (let i = 0; i < totalBatches; i++) {
                const batch = upsertData.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
                const { error } = await App.supabase.from("HazardList").insert(batch);
                if (error) this.log(`❌ 배치 ${i + 1} 실패: ${error.message}`, "error");
                else this.log(`✅ 배치 ${i + 1}/${totalBatches} 완료`);
            }
            this.log("🎉 HazardList 동기화 완료!", "success");
        },

        // 2. SubstanceRef Sync
        syncSubstanceRef: async function (btn) {
            if (btn) btn.disabled = true;
            try {
                this.log("🚀 물질 참조 데이터 동기화 시작...");
                await this.loadPapaParse();

                this.log("📂 data/casimport-correct.csv 파일 읽는 중...");
                const response = await fetch("data/casimport-correct.csv");
                if (!response.ok) throw new Error(`파일을 찾을 수 없습니다. (Status: ${response.status})`);

                const csvText = await response.text();
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: async (results) => {
                        const rows = results.data;
                        const insertData = rows.map(row => ({
                            cas_ref: this.clean(row.cas_ref),
                            chem_name_kor_ref: this.clean(row.chem_name_kor_ref),
                            substance_name_ref: this.clean(row.substance_name_ref),
                            molecular_formula_ref: this.clean(row.molecular_formula_ref)
                        })).filter(item => item.cas_ref);

                        if (!confirm(`총 ${insertData.length}개의 참조 데이터를 업데이트합니다.\n기존 데이터를 모두 삭제하고 덮어쓰시겠습니까?`)) {
                            this.log("🚫 작업이 취소되었습니다.", "error");
                            if (btn) btn.disabled = false;
                            return;
                        }

                        this.log("🗑️ 기존 SubstanceRef 데이터 삭제 중...");
                        await App.supabase.from("SubstanceRef").delete().neq("id", 0);

                        const BATCH_SIZE = 100;
                        const totalBatches = Math.ceil(insertData.length / BATCH_SIZE);

                        for (let i = 0; i < totalBatches; i++) {
                            const batch = insertData.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
                            const { error } = await App.supabase.from("SubstanceRef").insert(batch);
                            if (error) this.log(`❌ 배치 ${i + 1} 실패: ${error.message}`, "error");
                            else this.log(`✅ 배치 ${i + 1}/${totalBatches} 완료`);
                        }
                        this.log("🎉 SubstanceRef 동기화 완료!", "success");
                        if (btn) btn.disabled = false;
                    },
                    error: (err) => { throw err; }
                });
            } catch (err) {
                this.log(`❌ 오류 발생: ${err.message}`, "error");
                if (btn) btn.disabled = false;
            }
        },

        // 3. Kit Sync
        syncExperimentKits: async function (btn) {
            if (btn) btn.disabled = true;
            this.log("🚀 실험 키트 데이터 동기화 시작...");

            if (App.Utils?.syncExperimentKits) {
                // Override alert/log of kit-sync.js if possible, or just let it run
                // kit-sync.js uses alert() and document.getElementById('sync-status')
                // We can try to hook into it or just call it.
                // Since kit-sync.js is simple, we can just call it.
                // But we want logs here.

                // Let's manually invoke it and catch errors
                try {
                    await App.Utils.syncExperimentKits();
                    this.log("🎉 실험 키트 동기화 완료!", "success");
                } catch (e) {
                    this.log(`❌ 키트 동기화 실패: ${e.message}`, "error");
                }
            } else {
                this.log("❌ 키트 동기화 모듈(kit-sync.js)이 로드되지 않았습니다.", "error");
            }

            if (btn) btn.disabled = false;
        }
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.DataSync = DataSync;
})();
