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
    VERSION: "v0.11.11",     // 버전
  };

  // ------------------------------------------------------------
  // 2️⃣ 전역 네임스페이스 보장
  // ------------------------------------------------------------
  globalThis.App = globalThis.App || {};

  // Supabase SDK가 전역에 존재하는지 검사
  if (typeof supabase === "undefined" || !supabase.createClient) {
    console.error("❌ Supabase SDK가 로드되지 않았습니다. script 순서를 확인하세요.");
    return;
  }

  // ------------------------------------------------------------
  // 3️⃣ 클라이언트 생성 및 전역 등록
  // ------------------------------------------------------------
  try {
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    globalThis.App.supabase = client;

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
})();
