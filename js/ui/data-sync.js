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

            this.initMigration();
            this.initToolsMigration();
            this.initEquipmentMigration();
            this.initUserKitMigration();
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

        loadSheetJS: function () {
            return new Promise((resolve, reject) => {
                if (window.XLSX) return resolve();
                const script = document.createElement("script");
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
                script.onload = resolve;
                script.onerror = () => reject("SheetJS 로드 실패");
                document.head.appendChild(script);
            });
        },

        // Unified Parse Helper
        parseFile: async function (file) {
            const ext = file.name.split('.').pop().toLowerCase();
            
            if (ext === 'csv') {
                await this.loadPapaParse();
                return new Promise((resolve, reject) => {
                    this.log("📂 CSV 파일 파싱 중...");
                    Papa.parse(file, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            this.log(`✅ CSV 파싱 완료 (총 ${results.data.length}개 행)`);
                            resolve(results.data);
                        },
                        error: (err) => reject(new Error(`CSV 파싱 오류: ${err.message}`))
                    });
                });
            } else if (ext === 'xlsx' || ext === 'xls') {
                await this.loadSheetJS();
                return new Promise((resolve, reject) => {
                    this.log("📂 엑셀(XLSX) 파일 파싱 중...");
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = new Uint8Array(e.target.result);
                            const workbook = XLSX.read(data, { type: 'array' });
                            const firstSheetName = workbook.SheetNames[0];
                            const worksheet = workbook.Sheets[firstSheetName];
                            
                            // defval: "" ensures empty cells are empty strings, preventing offset issues if sparse
                            // raw: false ensures types are converted to strings if needed (dates might be tricky though)
                            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                            this.log(`✅ 엑셀 파싱 완료 (총 ${rows.length}개 행)`);
                            resolve(rows);
                        } catch (err) {
                            reject(new Error(`엑셀 파싱 오류: ${err.message}`));
                        }
                    };
                    reader.onerror = (err) => reject(new Error("파일 읽기 실패"));
                    reader.readAsArrayBuffer(file);
                });
            } else {
                throw new Error("지원하지 않는 파일 형식입니다. (CSV, XLSX, XLS만 가능)");
            }
        },

        clean: function (val) {
            if (val === undefined || val === null) return null; // undefined check added
            let s = String(val).trim();
            if (s === "" || s === "EMPTY") return null;
            if (s.startsWith("'")) {
                s = s.substring(1);
            }
            // Remove " ( ) characters (Excel formatting prevention)
            s = s.replace(/["()]/g, "");
            return s.trim();
        },

        // Helper to fetch System Data (Try XLSX first, then CSV)
        fetchSystemData: async function(baseName) {
            // 1. Try XLSX
            try {
                const xlsxUrl = `data/${baseName}.xlsx`;
                this.log(`📂 ${xlsxUrl} 확인 중...`);
                
                const response = await fetch(xlsxUrl);
                if (response.ok) {
                    await this.loadSheetJS();
                    const arrayBuffer = await response.arrayBuffer();
                    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
                    if (workbook.SheetNames.length === 0) throw new Error("엑셀 파일에 시트가 없습니다.");
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    this.log(`✅ XLSX 발견 및 변환 성공.`);
                    return XLSX.utils.sheet_to_csv(firstSheet);
                }
            } catch (ignore) {
                // Ignore XLSX error and try CSV
                console.warn("XLSX fetch failed, trying CSV", ignore);
            }

            // 2. Fallback to CSV
            try {
                const csvUrl = `data/${baseName}.csv`;
                this.log(`⚠️ XLSX 없음. ${csvUrl} 시도 중...`);
                
                const response = await fetch(csvUrl);
                if (response.ok) {
                    this.log(`✅ CSV 발견.`);
                    return await response.text();
                } else {
                    throw new Error(`파일을 찾을 수 없습니다: ${baseName}.xlsx 또는 .csv`);
                }
            } catch (err) {
                throw new Error(`데이터 로드 실패: ${err.message}`);
            }
        },

        // 1. HazardList Sync
        syncHazardList: async function (btn) {
            if (btn) btn.disabled = true;
            try {
                this.log("🚀 유해화학물질 동기화 시작 (Server-side)...");

                const csvText = await this.fetchSystemData("HazardList");
                this.log(`✅ 데이터 준비 완료 (${csvText.length} bytes). 서버로 전송합니다...`);

                const { data, error } = await App.supabase.functions.invoke('system-admin', {
                    body: {
                        action: 'sync_hazard_data',
                        csv_content: csvText
                    }
                });

                if (error) throw error;
                if (data?.error) throw new Error(data.error);

                this.log(`🎉 동기화 완료! (처리: ${data.data.processed}, 저장: ${data.data.upserted})`, "success");

            } catch (err) {
                this.log(`❌ 오류 발생: ${err.message}`, "error");
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        // Helper not needed anymore on client but keeping empty or removing if strict
        processHazardData: async function (rows) { },

        // 2. SubstanceRef Sync
        syncSubstanceRef: async function (btn) {
            if (btn) btn.disabled = true;
            try {
                this.log("🚀 물질 참조 데이터 동기화 시작 (Server-side)...");

                const csvText = await this.fetchSystemData("casimport-correct");
                this.log(`✅ 데이터 준비 완료 (${csvText.length} bytes). 서버로 전송합니다...`);

                const { data, error } = await App.supabase.functions.invoke('system-admin', {
                    body: {
                        action: 'sync_substance_ref',
                        csv_content: csvText
                    }
                });

                if (error) throw error;
                if (data?.error) throw new Error(data.error);

                this.log(`🎉 동기화 완료! (데이터: ${data.data.count}개)`, "success");

            } catch (err) {
                this.log(`❌ 오류 발생: ${err.message}`, "error");
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        // 3. Kit Sync
        syncExperimentKits: async function (btn) {
            if (btn) btn.disabled = true;
            try {
                this.log("🚀 실험 키트 데이터 동기화 시작 (Server-side)...");

                const csvText = await this.fetchSystemData("experiment_kit");
                this.log(`✅ 데이터 준비 완료 (${csvText.length} bytes). 서버로 전송합니다...`);

                const { data, error } = await App.supabase.functions.invoke('system-admin', {
                    body: {
                        action: 'sync_experiment_kit',
                        csv_content: csvText
                    }
                });

                if (error) throw error;
                if (data?.error) throw new Error(data.error);

                this.log(`🎉 동기화 완료! (데이터: ${data.data.count}개)`, "success");

            } catch (err) {
                this.log(`❌ 오류 발생: ${err.message}`, "error");
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        // 4. Migration Tool (Client-Side Logic)
        initMigration: function () {
            const btnMigrate = document.getElementById("btn-migration-start");
            if (btnMigrate) btnMigrate.addEventListener("click", () => this.handleMigration(btnMigrate));
        },

        handleMigration: async function (btn) {
            const fileInput = document.getElementById("migration-file-input");
            const startIdInput = document.getElementById("migration-start-id");
            const endIdInput = document.getElementById("migration-end-id");

            if (!fileInput || !fileInput.files[0]) return alert("파일을 선택해주세요.");
            const startId = parseInt(startIdInput.value);
            if (isNaN(startId)) return alert("시작 ID를 입력해주세요.");
            const endId = endIdInput.value ? parseInt(endIdInput.value) : startId;

            if (startId > endId) return alert("시작 ID가 끝 ID보다 클 수 없습니다.");

            const file = fileInput.files[0];
            if (btn) btn.disabled = true;

            try {
                this.log(`🚀 마이그레이션 시작 (ID: ${startId} ~ ${endId})`);
                
                // 1. Unified Parse
                const rows = await this.parseFile(file);

                // 2. Filter by ID Range
                const targets = rows.filter(r => {
                    // CSV has id column. XLSX might convert keys differently, ensure 'id' key exists.
                    // Case-insensitive key match might be needed if Excel headers are 'ID' vs 'id'
                    // For now assuming headers match CSV spec exactly.
                    const idVal = r.id || r.ID; 
                    const id = parseInt(idVal);
                    return !isNaN(id) && id >= startId && id <= endId;
                });

                if (targets.length === 0) {
                    throw new Error(`해당 범위(ID ${startId}~${endId})의 데이터가 없습니다.`);
                }

                this.log(`🎯 대상 데이터: ${targets.length}개. 순차 처리 시작...`);

                // 3. Process each item sequentially
                let successCount = 0;
                let failCount = 0;

                for (const row of targets) {
                    try {
                        await this.processMigrationItem(row);
                        successCount++;
                    } catch (itemErr) {
                        console.error(itemErr);
                        this.log(`❌ [ID: ${row.id || row.ID}] 실패: ${itemErr.message}`, "error");
                        failCount++;
                    }
                }

                this.log(`✨ 마이그레이션 종료. 성공: ${successCount}, 실패: ${failCount}`, "success");

            } catch (err) {
                this.log(`❌ 처리 중 오류: ${err.message}`, "error");
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        processMigrationItem: async function (row) {
            this.log(`🔄 [ID: ${row.id}] 처리 중...`);
            const supabase = App.supabase;

            // 1. Clean Data
            let casRn = this.clean(row.cas_rn); 
            // Note: Already handled by clean(), but ensure strict check logic if needed.
            // row.cas_rn might be "'7647-01-0". clean() removes leading quote.
            
            if (!casRn) throw new Error("CAS 번호가 없습니다.");

            // 2. Photo Processing
            let photoUrl320 = null;
            let photoUrl160 = null;
            const photoName = this.clean(row.photo);

            if (photoName) {
                const oldPhotoUrl = `https://muprmzkvrjacqatqxayf.supabase.co/storage/v1/object/public/reagent-photos/inventory/old_photos/${photoName}`;
                try {
                    // Fetch Blob
                    const blob = await this.fetchBlob(oldPhotoUrl);
                    if (blob) {
                         // Resize
                        const base64_320 = await this.resizeImage(blob, 320);
                        const base64_160 = await this.resizeImage(blob, 160);

                        // Upload 320
                        const ts = Date.now();
                        const rnd = Math.random().toString(36).substr(2, 5);
                        const path320 = `inventory/${ts}_${rnd}_320.jpg`;
                        const blob320 = App.Utils.base64ToBlob(base64_320);
                        
                        const { error: err320 } = await supabase.storage.from("reagent-photos").upload(path320, blob320);
                        if(err320) throw err320;
                        const { data: data320 } = supabase.storage.from("reagent-photos").getPublicUrl(path320);
                        photoUrl320 = data320.publicUrl;

                        // Upload 160
                        const path160 = `inventory/${ts}_${rnd}_160.jpg`;
                        const blob160 = App.Utils.base64ToBlob(base64_160);
                        const { error: err160 } = await supabase.storage.from("reagent-photos").upload(path160, blob160);
                        if (!err160) {
                             const { data: data160 } = supabase.storage.from("reagent-photos").getPublicUrl(path160);
                             photoUrl160 = data160.publicUrl;
                        }
                        this.log(`   📸 사진 마이그레이션 완료`);
                    }
                } catch(e) {
                    this.log(`   ⚠️ 사진 처리 실패 (${photoName}): ${e.message}`);
                }
            }

            // 3. PDF Processing
            let msdsUrl = null;
            let msdsHash = null;
            const pdfName = this.clean(row.pdf);

            if (pdfName) {
                const oldPdfUrl = `https://muprmzkvrjacqatqxayf.supabase.co/storage/v1/object/public/msds-pdf/old_msds-pdf/${pdfName}`;
                try {
                     const blob = await this.fetchBlob(oldPdfUrl);
                     if (blob) {
                         // Hash
                         msdsHash = await App.Utils.computeFileHash(blob);
                         
                         // Check Duplicate
                         // Check Duplicate
                         const { data: dupData } = await supabase.from("Inventory").select("msds_pdf_url").eq("msds_pdf_hash", msdsHash).limit(1);

                         if (dupData && dupData.length > 0 && dupData[0].msds_pdf_url) {
                            msdsUrl = dupData[0].msds_pdf_url;
                            this.log("   ♻️ 기존 PDF 재사용");
                         } else {
                            // Upload
                            const ts = Date.now();
                            const cleanName = pdfName.replace(/[^a-zA-Z0-9.-]/g, "_");
                            const path = `msds/${ts}_${cleanName}`;
                            
                            const { error: pdfErr } = await supabase.storage.from("msds-pdf").upload(path, blob);
                            if(pdfErr) throw pdfErr;
                            
                            const { data: pdfData } = supabase.storage.from("msds-pdf").getPublicUrl(path);
                            msdsUrl = pdfData.publicUrl;
                            this.log("   📄 PDF 업로드 완료");
                         }
                     }
                } catch (e) {
                     this.log(`   ⚠️ PDF 처리 실패 (${pdfName}): ${e.message}`);
                }
            }

            // 4. Construct Payload
            const payload = {
                cas_rns: [casRn],
                inventoryDetails: {
                    purchase_volume: row.initial_amount ? Number(row.initial_amount) : null,
                    current_amount: row.initial_amount ? Number(row.initial_amount) : 0, // 초기값과 동일하게 설정
                    unit: this.clean(row.unit),
                    cabinet_id: row.cabinet_id ? Number(row.cabinet_id) : null,
                    door_vertical: this.clean(row.door_vertical),
                    door_horizontal: this.clean(row.door_horizontal),
                    internal_shelf_level: this.clean(row.internal_shelf_level),
                    storage_column: this.clean(row.storage_column),
                    state: this.clean(row.state),
                    bottle_type: this.clean(row.bottle_type),
                    classification: this.clean(row.classification),
                    manufacturer: this.clean(row.manufacturer),
                    status: this.clean(row.status) || "사용중",
                    purchase_date: this.clean(row.purchase_date), // YYYY-MM-DD
                    bottle_mass: this.calculateBottleMass(row.initial_amount, row.bottle_type),  // Auto-calculated logic
                    
                    // Concentrations
                    concentration_value: row.concentration_value ? Number(row.concentration_value) : null,
                    concentration_unit: this.clean(row.concentration_unit),
                    valence: row.valence ? Number(row.valence) : null,

                    // Migrated Files
                    photo_url_320: photoUrl320,
                    photo_url_160: photoUrl160,
                    msds_pdf_url: msdsUrl,
                    msds_pdf_hash: msdsHash
                }
            };

            // 5. Invoke Edge Function
            // 5. Invoke Edge Function
            const result = await fetch("https://muprmzkvrjacqatqxayf.supabase.co/functions/v1/casimport", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${App.API?.SUPABASE_ANON_KEY || supabase.supabaseKey}`
                },
                body: JSON.stringify({
                    type: "inventory",
                    ...payload
                })
            }).then(r => r.json());

            if (result.error) throw new Error(result.error);

            this.log(`✅ [ID: ${row.id}] 등록 성공 (New ID: ${result.inventoryId})`);
        },

        // Helper: Fetch Blob
        fetchBlob: async function(url) {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            return await res.blob();
        },

        // Helper: Resize Image
        resizeImage: function(blob, width) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const scale = width / img.width;
                    canvas.width = width;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/jpeg", 0.8));
                };
                img.onerror = () => reject(new Error("Image load failed"));
                img.src = URL.createObjectURL(blob);
            });
        },

        // Helper: Bottle Mass Calculation (from forms.js)
        calculateBottleMass: function(volume, type) {
            if (!volume || !type) return null;
            const v = Number(volume);
            const t = String(type).trim().replace(/\s+/g, ""); // 공백 제거

            if (t === "기타") return 0;
            if (t.includes("유리")) {
                if (v === 25) return 65;
                if (v === 100) return 120;
                if (v === 500) return 400;
                if (v === 1000) return 510;
            }
            if (t.includes("플라스틱")) {
                if (v === 500) {
                    if (t.includes("반투명")) return 40;
                    if (t.includes("갈색")) return 80;
                    if (t.includes("흰색")) return 75;
                }
            }
            return null;
        },

        // 5. Tools Migration Tool (Client-Side Logic)
        initToolsMigration: function () {
            const btnToolsMigrate = document.getElementById("btn-tools-migration-start");
            if (btnToolsMigrate) btnToolsMigrate.addEventListener("click", () => this.handleToolsMigration(btnToolsMigrate));
        },

        handleToolsMigration: async function (btn) {
            const fileInput = document.getElementById("tools-migration-file-input");
            const startIdInput = document.getElementById("tools-migration-start-id");
            const endIdInput = document.getElementById("tools-migration-end-id");

            if (!fileInput || !fileInput.files[0]) return alert("파일을 선택해주세요.");
            const startId = parseInt(startIdInput.value);
            if (isNaN(startId)) return alert("시작 tools_no를 입력해주세요.");
            const endId = endIdInput.value ? parseInt(endIdInput.value) : startId;

            if (startId > endId) return alert("시작 tools_no가 끝 tools_no보다 클 수 없습니다.");

            const file = fileInput.files[0];
            if (btn) btn.disabled = true;

            try {
                this.log(`🚀 교구 마이그레이션 시작 (tools_no: ${startId} ~ ${endId})`);
                
                // 1. Unified Parse
                const rows = await this.parseFile(file);

                // 2. Filter by ID Range
                // 순번 -> tools_no 매핑
                const targets = rows.filter(r => {
                    const id = parseInt(r["순번"]);
                    return !isNaN(id) && id >= startId && id <= endId;
                });

                if (targets.length === 0) {
                    throw new Error(`해당 범위(tools_no ${startId}~${endId})의 데이터가 없습니다.`);
                }

                this.log(`🎯 대상 데이터: ${targets.length}개. 순차 처리 시작...`);

                // 3. Process each item sequentially
                let successCount = 0;
                let failCount = 0;

                for (const row of targets) {
                    try {
                        await this.processToolsMigrationItem(row);
                        successCount++;
                    } catch (itemErr) {
                        console.error(itemErr);
                        this.log(`❌ [tools_no: ${row["순번"]}] 실패: ${itemErr.message}`, "error");
                        failCount++;
                    }
                }

                this.log(`✨ 교구 마이그레이션 종료. 성공: ${successCount}, 실패: ${failCount}`, "success");

            } catch (err) {
                this.log(`❌ 처리 중 오류: ${err.message}`, "error");
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        processToolsMigrationItem: async function (row) {
            const toolsNo = this.clean(row["순번"]);
            this.log(`🔄 [tools_no: ${toolsNo}] 처리 중...`);
            const supabase = App.supabase;

            // 1. Mapping & Data Preparation
            // 기준량, 보유량 숫자 변환
            let standardAmount = row["기준량"] ? parseInt(row["기준량"].replace(/,/g, "")) : 0;
            if (isNaN(standardAmount)) standardAmount = 0;

            let stock = row["보유량"] ? parseInt(row["보유량"].replace(/,/g, "")) : 0;
            if (isNaN(stock)) stock = 0;

            // 보유율 계산
            let proportion = 0;
            if (standardAmount > 0) {
                proportion = (stock / standardAmount) * 100;
            }

            const payload = {
                tools_no: parseInt(toolsNo),
                stock_period: this.clean(row["과목"]),       // 과목
                tools_category: this.clean(row["과목영역"]),  // 과목영역
                tools_code: this.clean(row["교구코드"]),      // 교구코드
                tools_name: this.clean(row["교구명"]),        // 교구명
                specification: this.clean(row["규격"]),      // 규격
                using_class: this.clean(row["사용학년"]),     // 사용학년
                recommended: this.clean(row["소요기준"]),     // 소요기준
                standard_amount: standardAmount,           // 기준량
                stock: stock,                              // 보유량
                requirement: this.clean(row["필수구분"]),     // 필수구분
                out_of_standard: this.clean(row["기준내외"]), // 기준내외
                
                // Fixed values & Calculated
                tools_section: "교구",
                purchase_date: "2024-03-01",
                proportion: parseFloat(proportion.toFixed(2)) // 소수점 2자리
            };

            // 2. Insert/Upsert into tools table
            // tools_no가 PK일 것으로 예상됨 (또는 Unique Constraint)
            // tools_code도 Unique일 수 있으나 User는 tools_no 기준 작업 요청함
            const { data, error } = await supabase
                .from("tools")
                .upsert(payload, { onConflict: "tools_no" });

            if (error) throw error;

            this.log(`✅ [tools_no: ${toolsNo}] 저장 성공`);
        },

        // --- Equipment Migration ---
        initEquipmentMigration: function() {
            const btnEquipment = document.getElementById("btn-equipment-migration-start");
            if (btnEquipment) {
                btnEquipment.addEventListener("click", () => this.handleEquipmentMigration(btnEquipment));
            }
        },

        handleEquipmentMigration: async function(btn) {
            const safetyInput = document.getElementById("equipment-safety-file-input");
            const generalInput = document.getElementById("equipment-general-file-input");

            if (!safetyInput || !generalInput) return;
            // 둘 중 하나라도 있으면 진행
            if (!safetyInput.files[0] && !generalInput.files[0]) {
                return alert("최소한 하나의 파일(안전설비 또는 일반설비)을 선택해주세요.");
            }

            if (btn) btn.disabled = true;

            try {
                this.log("🚀 설비 마이그레이션 시작 (전체 범위)");
                
                // 1. Process Safety Equipment
                if (safetyInput.files[0]) {
                    await this.processEquipmentFile(safetyInput.files[0], "안전설비");
                }

                // 2. Process General Equipment
                if (generalInput.files[0]) {
                    await this.processEquipmentFile(generalInput.files[0], "일반설비");
                }

                this.log("✨ 모든 설비 데이터 처리 완료", "success");

            } catch (err) {
                this.log(`❌ 설비 마이그레이션 중 오류: ${err.message}`, "error");
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        processEquipmentFile: async function(file, type) {
            this.log(`📂 ${type} 파일 파싱 중... (${file.name})`);
            try {
                // Unified Parse
                const rows = await this.parseFile(file);
                
                this.log(`✅ ${type} 파싱 완료 (${rows.length}개 행). 순차 처리 시작...`);

                let successCount = 0;
                let failCount = 0;

                for (const row of rows) {
                    try {
                        // 순번(tools_no)가 없는 행은 건너뜀
                        if (!row["순번"] && !row["순번"] !== 0) continue; // Check validity more carefully

                        await this.processEquipmentMigrationItem(row, type);
                        successCount++;
                    } catch (itemErr) {
                        console.error(itemErr);
                        this.log(`❌ [${type} - 순번: ${row["순번"]}] 실패: ${itemErr.message}`, "error");
                        failCount++;
                    }
                }
                this.log(`📊 ${type} 처리 결과 - 성공: ${successCount}, 실패: ${failCount}`);

            } catch (e) {
                throw new Error(`${type} 처리 중 오류: ${e.message}`);
            }
        },

        processEquipmentMigrationItem: async function(row, equipmentType) {
            // equipmentType: "안전설비" or "일반설비"
            // Note: tools_section을 "설비"로 통일하고, 비고나 other fields에 세부타입을 넣을지, 
            // 아니면 tools_section 자체를 구분할지? 
            // 교구 로직에서는 tools_section="교구". 
            // 여기선 tools_section="설비"로 하고 tools_category(과목영역)에 equipmentType을 넣거나 하는 게 좋을듯 하나,
            // CSV에 "영역" 같은 컬럼이 있는지 확인 필요. 
            // 데이터가 없으므로 일반적인 매핑을 따름.
            // "안전설비" -> tools_section="안전설비"? 
            // 일단 User 요청은 '설비 정보 마이그레이션' 임.
            // Teaching Tools logic uses "교구".
            // Let's use "설비" as section, and mapping columns as best effort.

            const toolsNo = this.clean(row["순번"]);
            
            // 기준량, 보유량 숫자 변환
            let standardAmount = row["기준"] ? parseInt(row["기준"].replace(/,/g, "")) : 0;
            if (isNaN(standardAmount)) standardAmount = 0;

            let stock = row["보유"] ? parseInt(row["보유"].replace(/,/g, "")) : 0;
            if (isNaN(stock)) stock = 0;

             // 보유율 계산
             let proportion = 0;
             if (standardAmount > 0) {
                 proportion = (stock / standardAmount) * 100;
             }
             
             // CSV Header Checking (based on generic expectations or previous files)
             // 순번, 설비명, 규격, 단위, 기준, 보유, 상태, 비고 ... (Example)
             // But relying on user provided naming or similar to Teaching Tools.
             // Let's assume headers: 순번, 설비명, 규격, ...
             // Update: Teaching Tools had: 과목, 과목영역, 교구코드, 교구명, 규격, 사용학년, 소요기준, 기준량, 보유량, 필수구분, 기준내외
             // Equipment might be simpler: 순번, 설비명, 규격, 단위, 기준, 보유, 상태, ... (Guessing)
             // Safety Equipment often has: 순번, 품명, 규격, 단위, 기준...
             
            const payload = {
                tools_no: parseInt(toolsNo),
                // tools_category: equipmentType, // '안전설비' or '일반설비'
                // Or maybe map "구분" column if exists?
                tools_category: this.clean(row["구분"]) || equipmentType, 
                
                tools_name: this.clean(row["품명"] || row["설비명"] || row["교구명"]), // Try typical names
                specification: this.clean(row["규격"]),
                
                standard_amount: standardAmount,
                stock: stock,
                
                // Fields that might not exist in Equipment CSV, fill safely
                tools_code: this.clean(row["코드"] || ""),
                stock_period: this.clean(row["과목"] || ""), // 설비는 과목이 없을 수 있음
                using_class: this.clean(row["사용학년"] || ""),
                recommended: this.clean(row["소요기준"] || ""),
                requirement: this.clean(row["필수구분"] || ""),
                out_of_standard: this.clean(row["기준내외"] || ""),

                tools_section: "설비", // Fixed section
                purchase_date: "2024-03-01",
                proportion: parseFloat(proportion.toFixed(2))
            };

            // Name check
            if (!payload.tools_name) {
                // If name missing, try one more generic like 'Name'
                payload.tools_name = this.clean(row["Name"]);
                if (!payload.tools_name) {
                    throw new Error("설비명(품명/교구명)을 찾을 수 없습니다.");
                }
            }

            const supabase = App.supabase;
            const { data, error } = await supabase
                .from("tools")
                .upsert(payload, { onConflict: "tools_no" });

            if (error) throw error;
            
            // this.log(`   ✅ 저장 성공: ${payload.tools_name}`); // Too verbose?
        },

        // 7. User Kit Migration
        initUserKitMigration: function () {
            const btnUserKitMigrate = document.getElementById("btn-user-kit-migration-start");
            if (btnUserKitMigrate) btnUserKitMigrate.addEventListener("click", () => this.handleUserKitMigration(btnUserKitMigrate));
        },

        handleUserKitMigration: async function (btn) {
            const fileInput = document.getElementById("user-kit-migration-file-input");
            const startIdInput = document.getElementById("user-kit-migration-start-id");
            const endIdInput = document.getElementById("user-kit-migration-end-id");

            if (!fileInput || !fileInput.files[0]) return alert("파일을 선택해주세요.");
            const startId = parseInt(startIdInput.value);
            if (isNaN(startId)) return alert("시작 No를 입력해주세요.");
            const endId = endIdInput.value ? parseInt(endIdInput.value) : startId;

            if (startId > endId) return alert("시작 No가 끝 No보다 클 수 없습니다.");

            const file = fileInput.files[0];
            if (btn) btn.disabled = true;

            try {
                this.log(`🚀 키트 마이그레이션 시작 (No: ${startId} ~ ${endId})`);

                // 1. Unified Parse
                const rows = await this.parseFile(file);

                // 2. Filter by 'no'
                const targets = rows.filter(r => {
                    const id = parseInt(r["no"]);
                    return !isNaN(id) && id >= startId && id <= endId;
                });

                if (targets.length === 0) {
                    throw new Error(`해당 범위(No ${startId}~${endId})의 데이터가 없습니다.`);
                }

                this.log(`🎯 대상 데이터: ${targets.length}개. 순차 처리 시작...`);

                let successCount = 0;
                let failCount = 0;

                for (const row of targets) {
                    try {
                        await this.processUserKitMigrationItem(row);
                        successCount++;
                    } catch (itemErr) {
                        console.error(itemErr);
                        this.log(`❌ [No: ${row["no"]}] 실패: ${itemErr.message}`, "error");
                        failCount++;
                    }
                }

                this.log(`✨ 키트 마이그레이션 종료. 성공: ${successCount}, 실패: ${failCount}`, "success");

            } catch (err) {
                this.log(`❌ 처리 중 오류: ${err.message}`, "error");
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        processUserKitMigrationItem: async function (row) {
            const no = parseInt(row["no"]);
            const kitId = parseInt(row["kit_id"]);
            
            this.log(`🔄 [No: ${no}] Kit ID: ${kitId} 처리 중...`);
            const supabase = App.supabase;

            // 1. Fetch Experiment Kit Info
            // kit_person is fetched from DB, NOT CSV.
            const { data: expKit, error: expErr } = await supabase
                .from('experiment_kit')
                .select('*')
                .eq('id', kitId)
                .single();

            if (expErr || !expKit) {
                 throw new Error(`실험 키트(ID: ${kitId}) 정보를 찾을 수 없습니다.`);
            }

            // 2. Process Photo
            let imageUrl = null;
            const photoName = this.clean(row["photo"]);
            if (photoName) {
                try {
                    const oldPhotoUrl = `https://muprmzkvrjacqatqxayf.supabase.co/storage/v1/object/public/kit-photos/old_kit/${photoName}`;
                    const blob = await this.fetchBlob(oldPhotoUrl);
                    
                    if (blob) {
                         const base64_320 = await this.resizeImage(blob, 320);
                         
                         // Upload
                         const ts = Date.now();
                         const rnd = Math.random().toString(36).substr(2, 5);
                         
                         const path320 = `user_kits/${ts}_${rnd}_320.jpg`;
                         const blob320 = App.Utils.base64ToBlob(base64_320);
                         const { error: err320 } = await supabase.storage.from("kit-photos").upload(path320, blob320);
                         if (err320) throw err320;
                         const { data: data320 } = supabase.storage.from("kit-photos").getPublicUrl(path320);
                         imageUrl = data320.publicUrl;
                         
                         // 160 size (optional, but requested in Plan)
                         const base64_160 = await this.resizeImage(blob, 160);
                         const path160 = `user_kits/${ts}_${rnd}_160.jpg`;
                         const blob160 = App.Utils.base64ToBlob(base64_160);
                         await supabase.storage.from("kit-photos").upload(path160, blob160);
                         
                         this.log(`   📸 사진 업로드 완료`);
                    }
                } catch (e) {
                    this.log(`   ⚠️ 사진 처리 실패 (${photoName}): ${e.message}`);
                }
            }

            // 3. Insert into user_kits
            // Columns: kit_name, kit_class, kit_person (from experiment_kit)
            //          quantity, purchase_date (from CSV)
            //          image_url, status
            
            const payload = {
                kit_name: expKit.kit_name,
                kit_class: expKit.kit_class,
                kit_person: expKit.kit_person, // Fetching from DB as requested
                quantity: row["quantity"] ? parseInt(row["quantity"]) : 0,
                purchase_date: this.clean(row["purchase_date"]),
                image_url: imageUrl,
                status: '보유중' // Default status
            };

            const { error: insErr } = await supabase.from('user_kits').insert(payload);
            if (insErr) throw insErr;
            
            this.log(`✅ [No: ${no}] 등록 완료 (${expKit.kit_name})`);
        },
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.DataSync = DataSync;
})();

