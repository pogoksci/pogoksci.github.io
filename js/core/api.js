(function () {
  const SUPABASE_URL = "https://muprmzkvrjacqatqxayf.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cHJtemt2cmphY3FhdHF4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjYwNzAsImV4cCI6MjA3NTEwMjA3MH0.K2MO-l6QG5nztCPlT3_zqYOrMt-bqM-O5ZYLQpV1L9Y";

  // ✅ 전역 네임스페이스
  window.App = window.App || {};

  // ✅ Supabase 클라이언트 생성
  window.App.supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  // ✅ Edge Function 경로들
  const EDGE = {
    CASIMPORT: `${SUPABASE_URL}/functions/v1/casimport`,
    CABINET: `${SUPABASE_URL}/functions/v1/cabinet-register`,
  };

  // ✅ 공통 fetch 헬퍼
  async function callEdge(
    url,
    { method = "GET", token = SUPABASE_ANON_KEY, body } = {}
  ) {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {}

    if (!res.ok) {
      const msg = data?.error ? data.error : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  // ✅ 전역 등록
  window.App.API = { EDGE, callEdge, SUPABASE_URL, SUPABASE_ANON_KEY };
})();
