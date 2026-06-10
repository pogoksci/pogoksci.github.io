// ================================================================
// /js/ui/chatbot.js — 하이브리드 과학실 챗봇 엔진 (DB + AI Fallback)
// ================================================================
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  const Chatbot = {
    isOpen: false,
    isTyping: false,
    provider: "gemini",
    apiKey: null,
    apiUrl: "",
    model: "",

    // ------------------------------------------------------------
    // 1️⃣ 초기화 및 UI 생성
    // ------------------------------------------------------------
    init: function () {
      if (document.getElementById("chatbot-float-container")) {
        return; // 이미 생성됨
      }

      // API 설정 로드
      this.provider = localStorage.getItem("chatbot_provider") || "gemini";
      this.apiKey = localStorage.getItem("chatbot_api_key") || globalThis.APP_CONFIG?.GEMINI_API_KEY || null;
      this.apiUrl = localStorage.getItem("chatbot_api_url") || "";
      this.model = localStorage.getItem("chatbot_model") || "";

      // 챗봇 HTML 구조 동적 삽입
      const container = document.createElement("div");
      container.id = "chatbot-float-container";
      container.innerHTML = `
        <button id="chatbot-toggle-btn" title="AI 과학실 비서">
          <span class="material-symbols-outlined chatbot-icon">smart_toy</span>
          <span class="chatbot-badge">AI</span>
        </button>
        <div id="chatbot-panel" class="chatbot-panel-hidden">
          <div class="chatbot-header">
            <div class="chatbot-title-area">
              <span class="material-symbols-outlined header-icon">smart_toy</span>
              <div>
                <div class="chatbot-name">AI 과학실 비서</div>
                <div class="chatbot-status" id="chatbot-status-text">하이브리드 모드</div>
              </div>
            </div>
            <button id="chatbot-close-btn" title="닫기">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="chatbot-messages" id="chatbot-messages-container"></div>
          <div class="chatbot-input-area">
            <input type="text" id="chatbot-input" placeholder="시약 또는 안전 질문을 입력하세요..." autocomplete="off">
            <button id="chatbot-send-btn" title="보내기">
              <span class="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(container);

      // 이벤트 바인딩
      document.getElementById("chatbot-toggle-btn").onclick = () => this.togglePanel();
      document.getElementById("chatbot-close-btn").onclick = () => this.togglePanel(false);
      document.getElementById("chatbot-send-btn").onclick = () => this.handleSend();
      
      const input = document.getElementById("chatbot-input");
      input.onkeydown = (e) => {
        if (e.key === "Enter" && !e.isComposing) {
          this.handleSend();
        }
      };

      // 초기 안내 메시지 렌더링
      this.renderWelcome();
      this.updateStatus();
    },

    // ------------------------------------------------------------
    // 2️⃣ UI 제어
    // ------------------------------------------------------------
    togglePanel: function (forceState) {
      const panel = document.getElementById("chatbot-panel");
      if (!panel) return;

      this.isOpen = (forceState !== undefined) ? forceState : !this.isOpen;
      panel.classList.toggle("chatbot-panel-hidden", !this.isOpen);

      if (this.isOpen) {
        document.getElementById("chatbot-input").focus();
        this.scrollToBottom();
        // API 설정이 변경되었을 수 있으므로 다시 체크
        this.provider = localStorage.getItem("chatbot_provider") || "gemini";
        this.apiKey = localStorage.getItem("chatbot_api_key") || globalThis.APP_CONFIG?.GEMINI_API_KEY || null;
        this.apiUrl = localStorage.getItem("chatbot_api_url") || "";
        this.model = localStorage.getItem("chatbot_model") || "";
        this.updateStatus();
      }
    },

    updateStatus: function () {
      const statusEl = document.getElementById("chatbot-status-text");
      if (!statusEl) return;

      if (this.apiKey) {
        statusEl.textContent = `AI 비서 활성화됨 (${this.provider.toUpperCase()})`;
        statusEl.style.color = "";
      } else {
        statusEl.textContent = "DB 검색 모드 (AI 대기)";
        statusEl.style.color = "#888";
      }
    },

    scrollToBottom: function () {
      const container = document.getElementById("chatbot-messages-container");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },

    // ------------------------------------------------------------
    // 3️⃣ 메시지 렌더링
    // ------------------------------------------------------------
    renderWelcome: function () {
      const container = document.getElementById("chatbot-messages-container");
      if (!container) return;

      const welcomeHtml = `
        <div class="chatbot-msg-row msg-bot">
          <div class="chatbot-bubble">
            안녕하세요! 🧪 <b>AI 과학실 비서</b>입니다.<br>
            과학실에 구비된 화학물질의 정보나 MSDS 안전 등급을 조회해 드립니다.<br><br>
            <span style="color:#777; font-size:12px;">💡 <b>질문 예시:</b></span>
            <ul style="margin: 4px 0 8px 16px; padding: 0; font-size:12.5px; color:#555;">
              <li>"수산화 나트륨의 분자량은?"</li>
              <li>"염산의 위험성(MSDS) 알려줘"</li>
              <li>"질산 물리화학적 특성 보여줘"</li>
            </ul>
            밑의 추천 질문을 클릭하거나 직접 질문해 보세요!
            <div class="chatbot-chips-container" style="margin-top: 10px;">
              <button class="chatbot-chip" onclick="App.Chatbot.askPreset('수산화 나트륨 분자량')">⚖️ 수산화 나트륨 분자량</button>
              <button class="chatbot-chip" onclick="App.Chatbot.askPreset('염산 위험성')">⚠️ 염산 위험성</button>
              <button class="chatbot-chip" onclick="App.Chatbot.askPreset('에탄올 물리적 특성')">🌡️ 에탄올 특성</button>
            </div>
          </div>
        </div>
      `;
      container.innerHTML = welcomeHtml;
    },

    askPreset: function (text) {
      const input = document.getElementById("chatbot-input");
      if (input) {
        input.value = text;
        this.handleSend();
      }
    },

    appendMessage: function (text, sender) {
      const container = document.getElementById("chatbot-messages-container");
      if (!container) return;

      const row = document.createElement("div");
      row.className = `chatbot-msg-row msg-${sender}`;

      const bubble = document.createElement("div");
      bubble.className = "chatbot-bubble";
      bubble.innerHTML = text.replace(/\n/g, "<br>");

      row.appendChild(bubble);
      container.appendChild(row);
      this.scrollToBottom();
    },

    showTyping: function () {
      if (this.isTyping) return;
      this.isTyping = true;

      const container = document.getElementById("chatbot-messages-container");
      if (!container) return;

      const row = document.createElement("div");
      row.className = "chatbot-msg-row msg-bot";
      row.id = "chatbot-typing-row";

      const bubble = document.createElement("div");
      bubble.className = "chatbot-bubble";
      bubble.style.color = "#777";
      bubble.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle; animation: spin 2s linear infinite;">sync</span>
        정보를 찾는 중입니다...
      `;

      row.appendChild(bubble);
      container.appendChild(row);
      this.scrollToBottom();
    },

    hideTyping: function () {
      const typingRow = document.getElementById("chatbot-typing-row");
      if (typingRow) {
        typingRow.remove();
      }
      this.isTyping = false;
    },

    // ------------------------------------------------------------
    // 4️⃣ 메시지 전송 및 하이브리드 엔진 동작
    // ------------------------------------------------------------
    handleSend: async function () {
      const input = document.getElementById("chatbot-input");
      if (!input || !input.value.trim() || this.isTyping) return;

      const text = input.value.trim();
      input.value = "";

      // 1. 사용자 메시지 추가
      this.appendMessage(text, "user");

      // 2. 타이핑 시작
      this.showTyping();

      try {
        // 3. 하이브리드 라우팅 및 답변 생성
        const answer = await this.routeQuery(text);
        this.hideTyping();
        this.appendMessage(answer, "bot");
      } catch (err) {
        console.error("Chatbot Error:", err);
        this.hideTyping();
        this.appendMessage("❌ 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "bot");
      }
    },

    // ------------------------------------------------------------
    // 5️⃣ 하이브리드 검색 및 AI Fallback 라우팅
    // ------------------------------------------------------------
    routeQuery: async function (query) {
      const supabase = getSupabase();
      if (!supabase) {
        return "❌ 데이터베이스가 연결되어 있지 않습니다.";
      }

      // 문장을 토큰화하고 클렌징하여 유의미한 키워드 추출
      const cleanText = query.replace(/[?.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ").trim();
      const tokens = cleanText.split(/\s+/).filter(t => t.length >= 1);

      // 의도 분석 키워드 정의
      const mwKeywords = ["분자량", "무게", "mw", "질량", "mass", "weight", "mw"];
      const msdsKeywords = ["위험", "유해", "위험성", "유해성", "안전", "msds", "경고", "독성", "조치", "주의사항", "대비"];
      const propKeywords = ["특성", "성질", "성격", "녹는점", "끓는점", "밀도", "비중", "외관", "물리", "bp", "mp"];

      const isMwQuery = tokens.some(t => mwKeywords.some(k => t.includes(k)));
      const isMsdsQuery = tokens.some(t => msdsKeywords.some(k => t.includes(k)));
      const isPropQuery = tokens.some(t => propKeywords.some(k => t.includes(k)));

      // 1. DB에서 가장 적합한 화학물질 매칭 찾기
      let substance = null;
      let matchedToken = "";

      for (const token of tokens) {
        if (token.length < 2) continue; // 1글자는 스킵 (오타 최소화)
        
        // Substance 테이블 조회
        const { data } = await supabase
          .from("Substance")
          .select("id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass")
          .or(`chem_name_kor.ilike.%${token}%,chem_name_kor_mod.ilike.%${token}%,substance_name.ilike.%${token}%,substance_name_mod.ilike.%${token}%`)
          .limit(1);

        if (data && data.length > 0) {
          substance = data[0];
          matchedToken = token;
          break;
        }
      }

      // 2. 물질 매칭 실패 시 -> AI Fallback
      if (!substance) {
        if (this.apiKey) {
          return await this.callAI(query);
        } else {
          return `🔍 데이터베이스에서 입력하신 키워드와 관련된 화학물질을 찾지 못했습니다.
          
💡 <b>도움말:</b>
오타가 없는지 확인하거나 정확한 명칭(예: '수산화 나트륨', '에탄올', '염산')으로 질문해 보세요.
일반적인 질문이나 오타 자동 보정 기능을 원하시면 **[설정 > 과학실 설정 > 사용자 기초설정]** 탭에서 API Key를 입력해 주시면 똑똑한 AI 모드를 사용할 수 있습니다!`;
        }
      }

      // 3. 물질 매칭 성공 -> 의도별 분기 처리
      const chemName = substance.chem_name_kor_mod || substance.chem_name_kor || substance.substance_name_mod || substance.substance_name;
      const casRn = substance.cas_rn || "CAS없음";
      const formula = substance.molecular_formula_mod || substance.molecular_formula || "-";
      const molMass = substance.molecular_mass ? `${substance.molecular_mass} g/mol` : "-";

      // 3-1. 분자량(Molecular Weight) 의도
      if (isMwQuery) {
        return `⚖️ <b>${chemName}</b> (CAS: ${casRn})의 분자량 정보입니다.
        
- **분자식**: ${formula}
- **분자량**: <b>${molMass}</b>`;
      }

      // 3-2. 위험성/MSDS 의도
      if (isMsdsQuery) {
        // MSDS 2번 조회
        const { data: msdsData } = await supabase
          .from("MSDS")
          .select("content")
          .eq("substance_id", substance.id)
          .eq("section_number", 2)
          .maybeSingle();

        // 유해화학물질 고시 조회
        const { data: hazardData } = await supabase
          .from("HazardClassifications")
          .select("sbstnClsfTypeNm, contInfo")
          .eq("substance_id", substance.id);

        let msds2Text = msdsData?.content || "등록된 MSDS 2번(유해성·위험성) 정보가 없습니다.";
        // Clean markdown/special separators if any
        msds2Text = msds2Text.replace(/;;;/g, "\n").replace(/\|\|\|/g, " - ");

        let hazardText = "";
        if (hazardData && hazardData.length > 0) {
          hazardText = "\n\n⚠️ <b>법적 규제/고시 정보:</b>\n" + hazardData.map(h => `- **${h.sbstnClsfTypeNm}**: ${h.contInfo}`).join("\n");
        }

        return `⚠️ <b>${chemName}</b> (CAS: ${casRn})의 MSDS 위험성 정보입니다.
        
📢 <b>[MSDS 제2항. 유해성·위험성]</b>
${msds2Text}${hazardText}`;
      }

      // 3-3. 물리화학적 특성 의도
      if (isPropQuery) {
        // Properties 테이블 조회
        const { data: props } = await supabase
          .from("Properties")
          .select("name, property")
          .eq("substance_id", substance.id);

        // MSDS 9번 조회
        const { data: msdsData } = await supabase
          .from("MSDS")
          .select("content")
          .eq("substance_id", substance.id)
          .eq("section_number", 9)
          .maybeSingle();

        let propText = "";
        if (props && props.length > 0) {
          propText = props.map(p => `- **${p.name}**: ${p.property}`).join("\n");
        } else if (msdsData?.content) {
          propText = msdsData.content.replace(/;;;/g, "\n").replace(/\|\|\|/g, " - ");
        } else {
          propText = "등록된 물리화학적 특성 정보가 없습니다.";
        }

        return `🌡️ <b>${chemName}</b> (CAS: ${casRn})의 물리화학적 특성 정보입니다.
        
${propText}`;
      }

      // 3-4. 일반 요약 카드 및 퀵 헬퍼 출력
      // AI 모드가 활성화되어 있다면, 템플릿 정보와 함께 AI가 가공하도록 Fallback 호출도 가능하지만,
      // 여기서는 빠른 로컬 템플릿 카드를 먼저 리턴합니다.
      const summaryCardHtml = `
        🧪 <b>${chemName}</b> 시약 정보 요약입니다.
        <div class="chatbot-chemical-card">
          <div class="chatbot-chem-header">
            <div>
              <div class="chatbot-chem-title">${chemName}</div>
              <div class="chatbot-chem-subtitle">${substance.substance_name || ""}</div>
            </div>
            <span class="chatbot-chem-cas">${casRn}</span>
          </div>
          <div class="chatbot-chem-grid">
            <div class="chatbot-chem-label">분자식</div>
            <div class="chatbot-chem-val">${formula}</div>
            <div class="chatbot-chem-label">분자량</div>
            <div class="chatbot-chem-val">${molMass}</div>
          </div>
          <div class="chatbot-chem-footer-btns">
            <button class="chatbot-chem-btn" onclick="App.Chatbot.askPreset('${chemName} 분자량')">분자량</button>
            <button class="chatbot-chem-btn" onclick="App.Chatbot.askPreset('${chemName} 위험성')">위험성</button>
            <button class="chatbot-chem-btn" onclick="App.Chatbot.askPreset('${chemName} 특성')">물리<br>특성</button>
            <button class="chatbot-chem-btn btn-filled" onclick="App.Chatbot.goToDetail(${substance.id})">상세<br>이동</button>
          </div>
        </div>
      `;
      return summaryCardHtml;
    },

    goToDetail: function (substanceId) {
      // Substance ID를 통해 Inventory 테이블의 레코드 ID를 찾아 이동합니다.
      const supabase = getSupabase();
      if (!supabase) return;

      supabase
        .from("Inventory")
        .select("id")
        .eq("substance_id", substanceId)
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            this.togglePanel(false); // 챗봇 패널 닫기
            if (getApp().Router?.go) {
              getApp().Router.go("inventoryDetail", { id: data[0].id });
            } else {
              localStorage.setItem("selected_inventory_id", data[0].id);
              location.reload();
            }
          } else {
            alert("해당 물질의 등록된 재고(시약병)가 없습니다.");
          }
        });
    },

    // ------------------------------------------------------------
    // 6️⃣ 다중 LLM API 연동 (오타 교정 및 복합 설명)
    // ------------------------------------------------------------
    callAI: async function (prompt) {
      if (!this.apiKey) {
        return "❌ API Key가 설정되어 있지 않습니다.";
      }

      const systemInstruction = `너는 중고등학교 과학실 시약 및 안전 관리 프로그램 'SciManager'의 친절한 인공지능 비서(Chatbot)야. 
다음 원칙에 따라 한국어로 친절하게 대답해줘:
1. 화학물질 분자량, 화학식, MSDS 정보, 보관 방법 등에 대한 과학적 질문에 성실히 답해줘.
2. 사용자가 오타를 내면(예: '수산화 타트륨') 문맥상 적절한 화학물질('수산화 나트륨')로 자동 인지하여 유연하게 대답해주고, 오타가 있었음을 친절하게 짚어줘.
3. 데이터베이스 조회에 실패한 질문에 대해 알고 있는 화학 지식을 기반으로 올바르게 설명해주되, 데이터베이스(DB)에는 없는 물질일 수 있음을 함께 덧붙여줘.
4. 답변은 간결하고 가독성이 좋게 마크다운 문법(굵게, 글머리표)을 적극 활용해줘.`;

      const provider = this.provider || "gemini";

      if (provider === "gemini") {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }]
                }
              ],
              systemInstruction: {
                parts: [{ text: systemInstruction }]
              }
            })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `HTTP ${response.status}`);
          }

          const json = await response.json();
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawText) {
            return "🤖 AI 비서가 답변을 구성하지 못했습니다. 질문을 바르게 입력해 주세요.";
          }

          return rawText.trim();
        } catch (err) {
          console.error("Gemini API Error:", err);
          return `🤖 Gemini API 호출 중 오류가 발생했습니다.
          
⚠️ **원인 예시:**
- 입력된 **Gemini API Key**가 만료되었거나 올바르지 않습니다.
- 네트워크 연결 상태를 확인해 주세요.`;
        }
      } else {
        // OpenAI 및 Custom OpenAI 호환 API (Claude, OpenRouter, Ollama 등)
        let endpoint = "https://api.openai.com/v1/chat/completions";
        let modelName = this.model || "gpt-4o-mini";

        if (provider === "custom") {
          let baseUrl = this.apiUrl ? this.apiUrl.trim() : "";
          if (!baseUrl) {
            return "❌ 커스텀 API Base URL이 설정되어 있지 않습니다. 설정에서 확인해 주세요.";
          }
          if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.slice(0, -1);
          }
          endpoint = `${baseUrl}/chat/completions`;
        }

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
              ]
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status} - ${errText}`);
          }

          const json = await response.json();
          const rawText = json.choices?.[0]?.message?.content;
          if (!rawText) {
            return `🤖 AI (${provider.toUpperCase()}) 비서가 답변을 구성하지 못했습니다.`;
          }

          return rawText.trim();
        } catch (err) {
          console.error("OpenAI Compatible API Error:", err);
          return `🤖 AI (${provider.toUpperCase()}) 호출 중 오류가 발생했습니다.
          
⚠️ **상세 에러:** ${err.message}
- API Key와 설정(Base URL, 모델명 등)을 다시 확인해 주세요.`;
        }
      }
    }
  };

  // 전역 노출
  globalThis.App = globalThis.App || {};
  globalThis.App.Chatbot = Chatbot;

  console.log("🤖 Chatbot 모듈 로드 완료 — App.Chatbot 등록됨");
})();
