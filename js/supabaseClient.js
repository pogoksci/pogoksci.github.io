// ================================================================
// /js/supabaseClient.js
// Supabase 클라이언트 초기화 (전역 App.supabase 등록)
// ================================================================
(function () {
  // ------------------------------------------------------------
  // 1️⃣ 환경 설정 (필요 시 .env.js 또는 별도 config.js에서 불러올 수 있음)
  // ------------------------------------------------------------
  const SUPABASE_URL = "https://muprmzkvrjacqatqxayf.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cHJtemt2cmphY3FhdHF4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjYwNzAsImV4cCI6MjA3NTEwMjA3MH0.K2MO-l6QG5nztCPlT3_zqYOrMt-bqM-O5ZYLQpV1L9Y";

  // ✅ 전역 앱 환경 설정
  const APP_CONFIG = {
    APPNAME: "SciManager",   // 앱 이름
    SCHOOL: "GOE학교",     // 학교명
    VERSION: "v0.12.24",     // 버전
  };

  // ------------------------------------------------------------
  // 2️⃣ 전역 네임스페이스 보장 및 중복 방지
  // ------------------------------------------------------------
  globalThis.App = globalThis.App || {};

  // 이미 초기화된 경우 중복 생성 방지
  if (globalThis.App.supabase) {
    console.log("ℹ️ Supabase 클라이언트가 이미 초기화되어 있습니다.");
    return;
  }

  // Supabase SDK가 전역에 존재하는지 검사
  if (typeof supabase === "undefined" || !supabase.createClient) {
    console.error("❌ Supabase SDK가 로드되지 않았습니다. script 순서를 확인하세요.");
    return;
  }

  // ------------------------------------------------------------
  // 3️⃣ 클라이언트 생성 및 전역 등록
  // ------------------------------------------------------------
  try {
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: sessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    globalThis.App.supabase = client;
    globalThis.App.supabaseUrl = SUPABASE_URL;
    globalThis.App.supabaseAnonKey = SUPABASE_ANON_KEY;
    globalThis.App.projectFunctionsBaseUrl = `${SUPABASE_URL}/functions/v1`;

    console.log("✅ Supabase 클라이언트 초기화 완료");
  } catch (err) {
    console.error("❌ Supabase 초기화 오류:", err);
  }

  // ------------------------------------------------------------
  // 4️⃣ 선택적으로 전역에서 접근 가능하도록 export (Deno 호환)
  // ------------------------------------------------------------
  if (typeof globalThis !== "undefined") {
    globalThis.supabaseClient = globalThis.App.supabase;
    globalThis.APP_CONFIG = APP_CONFIG;
  }
  // 5️⃣ 동적 설정 로드 (학교 이름 등) - 외부에서 await 할 수 있도록 함수 노출
  // ------------------------------------------------------------
  globalThis.App.loadGlobalSettings = async function() {
    if (!globalThis.App.supabase) return;
    try {
      console.log("🔄 학교 설정 로딩 시작...");
      const { data, error } = await globalThis.App.supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'SCHOOL_NAME')
        .maybeSingle();

      if (data && data.value) {
        APP_CONFIG.SCHOOL = data.value; // Override default
        console.log(`🏫 학교 이름 설정 로드됨: ${APP_CONFIG.SCHOOL}`);
      } else {
        console.log("ℹ️ 저장된 학교 이름이 없어 기본값 사용");
      }
    } catch (e) {
      console.warn("⚠️ 설정 로드 실패 (기본값 사용):", e);
    }
  };

  // 기존에는 즉시 실행했으나, 이제는 index.js에서 initApp() 시점에 호출하도록 변경
  // (async function loadGlobalSettings() { ... })(); 
})();
