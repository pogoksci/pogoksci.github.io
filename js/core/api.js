// js/core/api.js
(function () {
  const SUPABASE_URL = "https://muprmzkvrjacqatqxayf.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cHJtemt2cmphY3FhdHF4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjYwNzAsImV4cCI6MjA3NTEwMjA3MH0.K2MO-l6QG5nztCPlT3_zqYOrMt-bqM-O5ZYLQpV1L9Y";

  const EDGE = {
    CASIMPORT: `${SUPABASE_URL}/functions/v1/casimport`,
    CABINET: `${SUPABASE_URL}/functions/v1/cabinet-register`,
    INVENTORY: `${SUPABASE_URL}/functions/v1/inventory`,
  };

  /**
   * 공통 fetch (Edge Function 호출용)
   * @param {string} url
   * @param {object} options
   */
  async function callEdge(url, { method = "GET", token = SUPABASE_ANON_KEY, body } = {}) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      console.error("❌ callEdge 실패:", err);
      throw err;
    }
  }

  globalThis.App = globalThis.App || {};
  App.API = { EDGE, callEdge, SUPABASE_URL, SUPABASE_ANON_KEY };
})();

