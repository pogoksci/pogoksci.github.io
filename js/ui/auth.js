// ================================================================
// /js/ui/auth.js — 인증 및 권한 관리 (RBAC)
// ================================================================
(function () {
    console.log("🔐 App.Auth 모듈 로드됨");

    const AUTH_DOMAIN = "@goe.sci"; // 가짜 도메인

    const Auth = {
        user: null, // { id, email, role }

        // 초기화: 세션 확인 및 역할 로드
        init: async function () {
            const { data: { session } } = await App.supabase.auth.getSession();
            if (session?.user) {
                console.log("✅ 세션 발견:", session.user.email);
                await this.fetchProfile(session.user.id, session.user.email);
            } else {
                console.log("⚠️ 세션 없음: 게스트 모드 또는 로그인 필요");
                this.user = null;
            }
            this.updateUI();
        },

        // 로그인 (ID -> Fake Email)
        login: async function (id, password) {
            const email = id + AUTH_DOMAIN;

            // 디버그: 실제 요청되는 이메일 확인
            // alert(`로그인 시도: ${email}`); 

            const { data, error } = await App.supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                console.error("❌ 로그인 실패:", error.message);
                throw error;
            }

            console.log("✅ 로그인 성공:", data.user.email);
            await this.fetchProfile(data.user.id, data.user.email);
            this.updateUI();

            // 로그인 후 페이지 이동 로직
            const savedRoute = sessionStorage.getItem("login_return_route");
            if (savedRoute) {
                // 이전 페이지 복귀
                try {
                    const { pageKey, params } = JSON.parse(savedRoute);
                    sessionStorage.removeItem("login_return_route"); // 사용 후 삭제
                    console.log(`🔙 로그인 후 복귀: ${pageKey}`);
                    App.Router.go(pageKey, params);
                } catch (e) {
                    console.warn("복귀 경로 파싱 실패:", e);
                    App.Router.go("main");
                }
            } else {
                // 기본: 메인으로
                App.Router.go("main");
            }
        },

        // 로그아웃
        logout: async function () {
            await App.supabase.auth.signOut();
            this.user = null;
            console.log("👋 로그아웃 완료");
            this.updateUI(); // Navbar UI 갱신

            // 현재 페이지가 '권한이 필요한 페이지'라면 홈으로, 아니면 현재 페이지 새로고침(권한 반영)
            const current = App.Router.getCurrentState ? App.Router.getCurrentState() : null;
            const restrictedRoutes = [
                'dataSync', 'equipmentCabinets', 'addCabinet', 'addInventory',
                'wasteForm', 'toolsForm', 'kitForm', 'usageRegister'
            ];

            if (current && restrictedRoutes.includes(current.pageKey)) {
                alert("로그아웃되어 메인 화면으로 이동합니다.");
                window.location.reload();
            } else if (current) {
                // 현재 페이지 리로드 (데이터/UI 갱신)
                App.Router.go(current.pageKey, current.params);
            } else {
                App.Router.go("login"); // Fallback
            }
        },

        // 프로필(역할) 가져오기
        fetchProfile: async function (userId, email) {
            try {
                const { data, error } = await App.supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', userId)
                    .single();

                if (error) throw error;

                this.user = {
                    id: userId,
                    email: email,
                    role: data ? data.role : 'guest' // 기본값 guest
                };
                console.log(`👤 사용자 역할 로드: ${this.user.role}`);

            } catch (err) {
                console.error("❌ 프로필 로드 실패, Guest로 전환:", err);
                this.user = { id: userId, email: email, role: 'guest' };
            }
        },

        // UI 갱신 (권한에 따른 Navbar 숨김 처리 등)
        updateUI: function () {
            // Navbar 업데이트는 Navbar 모듈이 로드된 후에 해야 함
            if (App.Navbar && App.Navbar.updateAuthUI) {
                App.Navbar.updateAuthUI(this.user);
            }
        },

        // 현재 권한 체크 헬퍼
        isAdmin: function () { return this.user?.role === 'admin'; },
        isTeacher: function () { return ['admin', 'teacher'].includes(this.user?.role); },
        canWrite: function () { return this.isTeacher(); } // 쓰기 권한은 Teacher 이상
    };

    // 전역 등록
    globalThis.App = globalThis.App || {};
    globalThis.App.Auth = Auth;

    // 로그인 페이지 전용 로직 (Router가 'login' 페이지 로드 시 호출 예정)
    Auth.bindLoginForm = function () {
        const form = document.getElementById("login-form");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = document.getElementById("login-id").value.trim();
            const pw = document.getElementById("login-pw").value.trim();
            const errorEl = document.getElementById("login-error");

            if (!id || !pw) return;

            try {
                errorEl.style.display = "none";
                await Auth.login(id, pw);
            } catch (err) {
                errorEl.textContent = "로그인 실패: 아이디 또는 비밀번호를 확인하세요.";
                errorEl.style.display = "block";
            }
        });
    };

})();
