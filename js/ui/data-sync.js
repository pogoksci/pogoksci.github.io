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

            const btnInfoUpdate = document.getElementById("btn-sync-info-update");
            if (btnInfoUpdate) btnInfoUpdate.addEventListener("click", () => this.syncReagentInfo(btnInfoUpdate));

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
            if (val === undefined || val === null) return null;
            let s = String(val).trim();
            if (s === "" || s === "EMPTY") return null;
            if (s.startsWith("'")) {
                s = s.substring(1);
            }
            // Logic to remove " ( ) removed to preserve original formatting
            return s.trim();
        },

        // Helper to parse numbers from strings with commas, or actual numbers
        parseSafeInt: function (val) {
            if (val === undefined || val === null || val === "") return 0;
            if (typeof val === "number") return Math.floor(val);
            const s = String(val).replace(/,/g, "").trim();
            const n = parseInt(s);
            return isNaN(n) ? 0 : n;
        },

        // Helper to fetch System Data (Try XLSX first, then CSV)
        fetchSystemData: async function (baseName) {
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

        // 3-1. Reagent Info Sync (Update existing Inventory from SubstanceRef)
        syncReagentInfo: async function (btn) {
            if (btn) btn.disabled = true;
            try {
                this.log("🚀 약품 정보 동기화(업데이트) 시작 (RPC)...");
                this.log("ℹ️ SubstanceRef의 최신 정보를 바탕으로 등록된 약품의 정보를 수정합니다.");

                const { error } = await App.supabase.rpc('sync_reagent_info_from_ref');

                if (error) throw error;

                this.log("🎉 약품 정보 업데이트 완료!", "success");
                alert("약품 정보가 최신 참조 데이터로 업데이트되었습니다.");

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

            const untilEnd = document.getElementById("migration-until-end")?.checked;
            const endId = untilEnd ? 999999 : (endIdInput.value ? parseInt(endIdInput.value) : startId);

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

            // 1. Clean Data & Robust CAS Lookup
            const casKeys = ["cas_rn", "cas_nos", "CAS No", "CAS번호", "CAS", "cas"]; // data-sync.js columnMapping keys + others
            let casRn = null;
            for (const key of casKeys) {
                casRn = this.clean(row[key]);
                if (casRn) break;
            }

            // Identify Name for Logging
            const nameKeys = ["chem_name", "물질명", "화학물질명", "name", "품명", "product_name"];
            let name = "이름없음";
            for (const key of nameKeys) {
                if (row[key]) {
                    name = row[key];
                    break;
                }
            }

            // if (!casRn) throw new Error(`CAS 번호가 없습니다. (물질명: ${name})`); // Disabled for Fallback logic

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

                        const { error: err320 } = await this.uploadWithRetry("reagent-photos", path320, blob320);
                        if (err320) throw err320;
                        const { data: data320 } = supabase.storage.from("reagent-photos").getPublicUrl(path320);
                        photoUrl320 = data320.publicUrl;

                        // Upload 160
                        const path160 = `inventory/${ts}_${rnd}_160.jpg`;
                        const blob160 = App.Utils.base64ToBlob(base64_160);

                        try {
                            await this.uploadWithRetry("reagent-photos", path160, blob160);
                            const { data: data160 } = supabase.storage.from("reagent-photos").getPublicUrl(path160);
                            photoUrl160 = data160.publicUrl;
                        } catch (e160) {
                            console.warn("160px upload failed, skipping", e160);
                        }
                        this.log(`   📸 사진 마이그레이션 완료`);
                    }
                } catch (e) {
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

                            const { error: pdfErr } = await this.uploadWithRetry("msds-pdf", path, blob);
                            if (pdfErr) throw pdfErr;

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
                    purchase_date: "2024-03-01", // User request: fixed to 2024-03-01
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
            // 5. Invoke Edge Function OR Local Fallback
            // 5. Invoke Edge Function (Handles both Real CAS and Placeholders)
            const resolvedCas = casRn || `NC-${row.id}`;
            payload.cas_rns = [resolvedCas];

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
            this.log(`✅ [ID: ${row.id}] 등록 성공 (New ID: ${result.inventoryId || result.substance?.id || "Unknown"})`);
        },

        // Helper: Fetch Blob with Exponential Backoff Retry
        fetchBlob: async function (url, retries = 3, delay = 1000) {
            for (let i = 0; i < retries; i++) {
                try {
                    const res = await fetch(url);
                    if (res.ok) return await res.blob();

                    // Only retry on typical transient server errors (504, 502, 503) or rate limits (429)
                    if ([504, 502, 503, 429].includes(res.status)) {
                        this.log(`      ⏳ [재시도 ${i + 1}/${retries}] 서버 응답 지연 (${res.status}). ${delay / 1000}초 후 다시 시도...`);
                    } else {
                        // For 404, 403, 400 etc., no point in retrying
                        throw new Error(`Fetch failed: ${res.status}`);
                    }
                } catch (err) {
                    if (i === retries - 1) throw err;
                    this.log(`      ⏳ [재시도 ${i + 1}/${retries}] 네트워크 오류. ${delay / 1000}초 후 다시 시도...`);
                }

                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                }
            }
            throw new Error(`Fetch failed after ${retries} attempts`);
        },

        // Helper: Upload with Retry
        uploadWithRetry: async function (bucket, path, blob, retries = 3, delay = 1000) {
            for (let i = 0; i < retries; i++) {
                try {
                    const { data, error } = await App.supabase.storage.from(bucket).upload(path, blob);
                    if (error) throw error;
                    return data;
                } catch (err) {
                    // Retry on network errors or 5xx/429
                    // Supabase JS often wraps fetch errors.
                    const isRetryable =
                        err.message?.includes("Unexpected token") || // Often HTML 504 response
                        err.message?.includes("fetch") ||
                        err.status === 504 ||
                        err.status === 503 ||
                        err.status === 429;

                    if (i === retries - 1 || !isRetryable) throw err;

                    this.log(`      ⏳ [Upload 재시도 ${i + 1}/${retries}] ${err.message || "Timeout"}. 대기 후...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2;
                }
            }
        },

        // Helper: Resize Image
        resizeImage: function (blob, width) {
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

        // Helper: Parse Excel Date Serial
        parseExcelDate: function (val) {
            if (!val) return null;
            if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;
            const serial = parseFloat(val);
            if (!isNaN(serial) && serial > 20000) {
                const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            return val; // Return original if not serial, let valid strings pass or fail
        },

        // Helper: Bottle Mass Calculation (from forms.js)
        calculateBottleMass: function (volume, type) {
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

            const untilEnd = document.getElementById("tools-until-end")?.checked;
            const endId = untilEnd ? 999999 : (endIdInput.value ? parseInt(endIdInput.value) : startId);

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
            let standardAmount = this.parseSafeInt(row["기준량"]);
            let stock = this.parseSafeInt(row["보유량"]);

            // 보유율 계산
            let proportion = 0;
            if (standardAmount > 0) {
                proportion = stock / standardAmount;
            }

            const payload = {
                tools_no: parseInt(toolsNo),
                stock_period: this.clean(row["과목"]),       // 과목
                tools_category: this.clean(row["과목영역"]),  // 과목영역
                tools_code: this.clean(row["교구코드"]),      // 교구코드
                tools_name: this.clean(row["교구명"]),        // 교구명
                specification: this.clean(row["규격"]),      // 규격
                using_class: this.clean(row["사용학년"]),     // 사용학년
                standard_amount: this.clean(row["소요기준"]),    // 소요기준 (String: "N명당 1")
                requirement: standardAmount,                // 기준량 (Numeric)
                stock: stock,                               // 보유량 (Numeric)
                recommended: this.clean(row["필수구분"]),    // 필수구분 (String: "필수"/"권장")
                out_of_standard: this.clean(row["기준내외"]), // 기준내외 (String: "기준내"/"기준외")

                // Fixed values & Calculated
                tools_section: "교구",
                purchase_date: "2024-03-01",
                proportion: parseFloat(proportion.toFixed(4)) // Increased precision for ratio
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
        initEquipmentMigration: function () {
            const btnEquipment = document.getElementById("btn-equipment-migration-start");
            if (btnEquipment) {
                btnEquipment.addEventListener("click", () => this.handleEquipmentMigration(btnEquipment));
            }
        },

        handleEquipmentMigration: async function (btn) {
            const safetyInput = document.getElementById("equipment-safety-file-input");
            const generalInput = document.getElementById("equipment-general-file-input");

            if (!safetyInput || !generalInput) return;
            if (!safetyInput.files[0] && !generalInput.files[0]) {
                return alert("최소한 하나의 파일(안전설비 또는 일반설비)을 선택해주세요.");
            }

            if (btn) btn.disabled = true;

            try {
                this.log("🚀 설비 마이그레이션 시작 (데이터 분석 중...)");

                // 0. Pre-fetch Data for ID generation/matching
                // Fetch ALL tools to determine absolute Max No and build safe map
                const supabase = App.supabase;
                const { data: existingTools, error } = await supabase
                    .from('tools')
                    .select('tools_no, tools_code, tools_category'); // Removed filter to get true maxNo

                if (error) throw error;

                // Map: `${Code}|${Category}` -> No
                // This prevents "Safety" overwriting "General" if they share codes.
                const codeMap = new Map();
                let maxNo = 0;

                existingTools.forEach(t => {
                    const no = t.tools_no;
                    if (no > maxNo) maxNo = no;

                    if (t.tools_code && t.tools_category) {
                        const key = `${t.tools_code}|${t.tools_category}`;
                        codeMap.set(key, no);
                    }
                });

                this.log(`ℹ️ 기존 데이터 로드 완료 (Max No: ${maxNo}, 매핑: ${codeMap.size}개)`);

                const context = { codeMap, maxNo };

                // 1. Process Safety Equipment
                if (safetyInput.files[0]) {
                    this.log("➡️ 안전설비 처리 시작...");
                    await this.processEquipmentFile(safetyInput.files[0], "안전설비", context);
                }

                // 2. Process General Equipment
                if (generalInput.files[0]) {
                    this.log("➡️ 일반설비 처리 시작...");
                    await this.processEquipmentFile(generalInput.files[0], "일반설비", context);
                }

                this.log("✨ 모든 설비 데이터 처리 완료", "success");

            } catch (err) {
                this.log(`❌ 설비 마이그레이션 중 오류: ${err.message}`, "error");
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        processEquipmentFile: async function (file, categoryName, context) {
            this.log(`📂 ${categoryName} 파일 파싱 중... (${file.name})`);
            try {
                await this.loadSheetJS();
                const reader = new FileReader();
                const rows = await new Promise((resolve, reject) => {
                    reader.onload = (e) => {
                        try {
                            const data = new Uint8Array(e.target.result);
                            const workbook = XLSX.read(data, { type: 'array' });
                            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                            const arrayRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                            resolve(arrayRows);
                        } catch (err) { reject(err); }
                    };
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(file);
                });

                this.log(`✅ ${categoryName} 파싱 완료 (${rows.length}개 행). 순차 처리 시작...`);

                let successCount = 0;
                let failCount = 0;

                // Start from 3rd row (index 2)
                for (let i = 2; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row[2]) continue; // Check tools_code

                    try {
                        await this.processEquipmentMigrationItem(row, categoryName, context);
                        successCount++;
                    } catch (itemErr) {
                        console.error(itemErr);
                        this.log(`❌ [${categoryName} - Row ${i + 1}] 실패: ${itemErr.message}`, "error");
                        failCount++;
                    }
                }
                this.log(`📊 ${categoryName} 처리 결과 - 성공: ${successCount}, 실패: ${failCount}`);

            } catch (e) {
                throw new Error(`${categoryName} 처리 중 오류: ${e.message}`);
            }
        },

        processEquipmentMigrationItem: async function (row, categoryName, context) {
            const toolsCode = this.clean(row[2]); // C
            if (!toolsCode) throw new Error("종목코드(C열)가 없습니다.");

            // Determine tools_no using Composite Key
            const key = `${toolsCode}|${categoryName}`;
            let toolsNo = context.codeMap.get(key);

            if (!toolsNo) {
                // New Item (Combination of Code + Category is new)
                context.maxNo++;
                toolsNo = context.maxNo;
                context.codeMap.set(key, toolsNo); // Update map
            }

            // Using Class (F, G, H, I -> 5, 6, 7, 8)
            const g1 = this.clean(row[5]);
            const g2 = this.clean(row[6]);
            const g3 = this.clean(row[7]);
            const sp = this.clean(row[8]);

            let usingClassStr = null;
            if (g1 === "Y" && g2 === "Y" && g3 === "Y" && sp === "N") {
                usingClassStr = "전학년";
            } else {
                const classes = [];
                if (g1 === "Y") classes.push("1학년");
                if (g2 === "Y") classes.push("2학년");
                if (g3 === "Y") classes.push("3학년");
                if (sp === "Y") classes.push("특수");

                if (classes.length === 0) usingClassStr = null;
                else usingClassStr = classes.join(", ");
            }

            // Standard Amount (J, K, L -> 9, 10, 11)
            const r1 = this.clean(row[9]);
            const r2 = this.clean(row[10]);
            const r3 = this.clean(row[11]);
            let standardAmountStr = [r1, r2, r3].filter(Boolean).join(" ");

            // Numbers
            const requirement = this.parseSafeInt(row[13]); // N
            const stock = this.parseSafeInt(row[14]);       // O

            // Proportion
            let proportion = 0;
            if (requirement > 0) {
                proportion = stock / requirement;
            }

            const payload = {
                tools_no: toolsNo,
                tools_code: toolsCode,
                tools_name: this.clean(row[3]),      // D
                specification: this.clean(row[4]),   // E
                using_class: usingClassStr,
                standard_amount: standardAmountStr,
                recommended: this.clean(row[12]),    // M
                requirement: requirement,
                stock: stock,
                out_of_standard: this.clean(row[15]), // P

                tools_section: "설비",
                tools_category: categoryName, // '안전설비' or '일반설비'
                stock_period: "과학(2025)",
                purchase_date: "2024-03-01",
                proportion: parseFloat(proportion.toFixed(4)),
                updated_at: new Date()
            };

            const supabase = App.supabase;
            const { error } = await supabase
                .from("tools")
                .upsert(payload, { onConflict: "tools_no" });

            if (error) throw error;
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

            const untilEnd = document.getElementById("user-kit-until-end")?.checked;
            const endId = untilEnd ? 999999 : (endIdInput.value ? parseInt(endIdInput.value) : startId);

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

                // 3. Process each item sequentially
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
            const keys = Object.keys(row);
            // User specified order: no(A), kit_id(B), photo(C), kit_person(D), quantity(E), purchase_date(F)

            let no = parseInt(row["no"]);
            if (isNaN(no)) no = parseInt(row[keys[0]]); // Fallback to Col A

            let kitId = parseInt(row["kit_id"]);
            if (isNaN(kitId)) kitId = parseInt(row[keys[1]]); // Fallback to Col B

            this.log(`🔄 [No: ${no}] Kit ID: ${kitId} 처리 중...`);
            const supabase = App.supabase;

            // 1. Fetch Experiment Kit Info
            // Only need catalog info, not used for direct insert anymore, 
            // but needed to pass 'kit_cas' to sync properly if EF expects it.
            // Actually EF uses 'kit_name'/'kit_class'/'kit_cas' from payload.
            const { data: expKit, error: expErr } = await supabase
                .from('experiment_kit')
                .select('*')
                .eq('id', kitId)
                .single();

            if (expErr || !expKit) {
                // If ID lookup fails, maybe it's because kitId is still wrong?
                // But we log it above.
                throw new Error(`실험 키트(ID: ${kitId}) 정보를 찾을 수 없습니다.`);
            }

            // 2. Prepare Photo (Base64 only, let EF handle upload)
            let photoBase64 = null;
            const photoName = this.clean(row["photo"] || row[keys[2]]); // Col C
            if (photoName) {
                try {
                    // User confirmed folder is 'old-kit', not 'old_kit'
                    const oldPhotoUrl = `https://muprmzkvrjacqatqxayf.supabase.co/storage/v1/object/public/kit-photos/old-kit/${encodeURIComponent(photoName)}`;
                    const blob = await this.fetchBlob(oldPhotoUrl);
                    if (blob) {
                        // kit-register typically expects a Data URL (data:image/jpeg;base64,...)
                        // resizeImage returns exactly that.
                        photoBase64 = await this.resizeImage(blob, 320);
                        this.log(`   📸 사진 데이터 준비 완료`);
                    }
                } catch (e) {
                    this.log(`   ⚠️ 사진 다운로드 실패 (${photoName}): ${e.message}`);
                }
            }

            // Extract kit_person from CSV (User request: 4th column / Col D)
            const kitPerson = this.clean(row["kit_person"] || row["인원"] || row["person"] || row[keys[3]] || "");

            // Extract Quantity (Col E)
            const qtyVal = row["quantity"] || row[keys[4]];
            const finalQty = this.parseSafeInt(qtyVal);

            // Extract Purchase Date (Col F)
            const pDateVal = row["purchase_date"] || row[keys[5]];
            const finalPDate = this.parseExcelDate(pDateVal);

            // 3. Invoke Edge Function (kit-register)
            // Payload must match what kit-form.js sends.
            // mode: 'create'
            const payload = {
                mode: 'create',
                kit_id: kitId, // Explicitly pass Catalog ID from Col B
                kit_name: expKit.kit_name,
                kit_class: expKit.kit_class,
                kit_cas: expKit.kit_cas, // Pass CAS to ensure chemicals are linked
                kit_person: kitPerson, // Pass CSV value from Col D
                quantity: finalQty, // From Col E
                purchase_date: finalPDate, // From Col F
                photo_base64: photoBase64, // From Col C (URL fetch)
                status: '보유중'
            };

            // DEBUG: Log EF Response
            const { data, error } = await supabase.functions.invoke('kit-register', {
                body: payload
            });

            if (error) {
                // Parse error message if possible
                let msg = error.message;
                if (error instanceof Error && error.context && error.context.json) {
                    const body = await error.context.json();
                    msg = body.error || msg;
                }
                throw new Error(`Edge Function Error: ${msg}`);
            }

            console.log("✅ EF Response:", data);

            // 4. PATCH: Find the ID and update kit_id
            let newId = null;

            // Strategy A: Check EF Response
            if (data) {
                if (data.id) newId = data.id;
                else if (data.data?.id) newId = data.data.id;
                else if (data.kit?.id) newId = data.kit.id; // Common pattern
                else if (data.data?.kit?.id) newId = data.data.kit.id;
            }

            // Strategy B: Fallback Search (Latest record with same name)
            if (!newId) {
                console.warn("⚠️ ID not found in EF response. Trying fallback search...");
                const { data: latest, error: searchErr } = await supabase
                    .from('user_kits')
                    .select('id, kit_id') // Check kit_id existence here too
                    .eq('kit_name', expKit.kit_name)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (latest) {
                    newId = latest.id;
                    console.log(`🔎 Found created kit via search: ID ${newId}`);
                }
            }

            // Execute Patch
            if (newId) {
                const { error: patchErr } = await supabase
                    .from('user_kits')
                    .update({ kit_id: kitId })
                    .eq('id', newId);

                if (patchErr) {
                    console.warn(`⚠️ Failed to patch kit_id for User Kit ${newId}:`, patchErr);
                } else {
                    console.log(`🔧 Patched kit_id (${kitId}) for User Kit ${newId}`);
                }
            } else {
                console.error("❌ Could not determine User Kit ID to patch.");
            }

            // 5. Chemical Sync (kit-casimport)
            if (expKit.kit_cas) {
                this.log(`   🧪 화학물질 동기화 진행 (CAS: ${expKit.kit_cas})`);
                const casList = expKit.kit_cas.split(/[\n,;]+/).map(s => s.trim()).filter(s => s);

                for (const cas of casList) {
                    try {
                        // Invoke kit-casimport
                        const { data: casData, error: casError } = await supabase.functions.invoke('kit-casimport', {
                            body: { cas_rn: cas }
                        });
                        if (casError) {
                            console.warn(`   ⚠️ CAS Sync Fail (${cas}):`, casError);
                        } else {
                            // console.log(`   ✅ CAS Synced: ${cas}`);
                        }
                    } catch (ce) {
                        console.error(ce);
                    }
                }
                if (casList.length > 0) {
                    this.log(`   ⚗️ ${casList.length}개 물질 MSDS 정보 동기화 완료`);
                }
            }


            this.log(`✅ [No: ${no}] 등록 완료 (${expKit.kit_name})`);
        },
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.DataSync = DataSync;
})();

