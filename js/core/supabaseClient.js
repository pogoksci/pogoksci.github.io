// js/core/supabaseClient.js
(function () {
  const SUPABASE_URL = "https://muprmzkvrjacqatqxayf.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cHJtemt2cmphY3FhdHF4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjYwNzAsImV4cCI6MjA3NTEwMjA3MH0.K2MO-l6QG5nztCPlT3_zqYOrMt-bqM-O5ZYLQpV1L9Y";

  // ✅ 전역 네임스페이스 보장
  globalThis.App = globalThis.App || {};
  App.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log("✅ Supabase 클라이언트 초기화 완료");
})();