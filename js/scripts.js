// =================================================================
// 1. HTML 조각 파일을 비동기적으로 로드하고 콜백을 실행하는 핵심 함수
// =================================================================

/**
 * 지정된 URL에서 HTML 내용을 가져와 특정 요소에 삽입 후 콜백 함수를 실행합니다.
 * @param {string} url - 불러올 HTML 파일 경로 ('pages/form-input.html' 등)
 * @param {string} targetElementId - 내용을 삽입할 대상 요소의 ID ('form-container' 등)
 * @param {function} callback - HTML 삽입 완료 후 실행할 함수 (선택 사항)
 */
function includeHTML(url, targetElementId, callback) {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                // 404 Not Found 등의 오류 처리
                throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
            }
            return response.text();
        })
        .then(htmlContent => {
            const targetElement = document.getElementById(targetElementId);
            if (targetElement) {
                // 불러온 HTML 내용을 대상 요소에 삽입
                targetElement.innerHTML = htmlContent;
                
                // 삽입 완료 후, 콜백 함수를 실행하여 동적 요소를 초기화
                if (callback) {
                    callback();
                }
            } else {
                console.error(`Target element not found: #${targetElementId}`);
            }
        })
        .catch(error => {
            console.error('Error during HTML include:', error);
            // 사용자에게 오류 메시지 표시
            const statusMessage = document.getElementById('statusMessage');
            if (statusMessage) {
                 statusMessage.textContent = `페이지 로드 중 오류 발생: ${url}`;
            }
        });
}


// =================================================================
// 2. form-input.html 내용 삽입 완료 후 실행될 초기화 로직
// =================================================================

/**
 * form-input.html 내부의 동적으로 삽입된 요소들에 이벤트 리스너를 연결합니다.
 * (이 함수는 'Cannot read properties of null' 오류를 방지하기 위해 콜백으로 실행됩니다.)
 */
function initializeFormListeners() {
    console.log("폼 요소 초기화 시작...");

    // 2-1. 상태 버튼 그룹 이벤트 리스너 연결 및 Hidden Input 처리
    const stateButtons = document.getElementById('state_buttons');
    const stateValueInput = document.getElementById('state_value');

    if (stateButtons && stateValueInput) {
        stateButtons.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (button && button.hasAttribute('data-value')) {
                // 모든 버튼의 'active' 클래스 제거
                stateButtons.querySelectorAll('button').forEach(btn => {
                    btn.classList.remove('active');
                });
                // 클릭된 버튼에 'active' 클래스 추가
                button.classList.add('active');
                
                // Hidden Input에 값 저장 (폼 제출 시 서버로 전송됨)
                stateValueInput.value = button.getAttribute('data-value');
            }
        });
    }

    // 2-2. 단위 버튼 그룹 이벤트 리스너 연결 및 Hidden Input 처리 (state와 동일 구조)
    const unitButtons = document.getElementById('unit_buttons');
    const unitValueInput = document.getElementById('unit_value');

    if (unitButtons && unitValueInput) {
        unitButtons.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (button && button.hasAttribute('data-value')) {
                // 모든 버튼의 'active' 클래스 제거
                unitButtons.querySelectorAll('button').forEach(btn => {
                    btn.classList.remove('active');
                });
                // 클릭된 버튼에 'active' 클래스 추가
                button.classList.add('active');
                
                // Hidden Input에 값 저장
                unitValueInput.value = button.getAttribute('data-value');
            }
        });
    }
    
    // 2-3. [중요] 58번째 줄 오류를 일으킨 다른 초기화 코드가 있다면 여기에 추가하세요.
    // 예: document.getElementById('cas_rn').addEventListener('input', updateCasInfo);
    
    // ... 기타 폼 요소 초기화 로직 ...
    
    console.log("폼 요소 초기화 완료.");
}


// =================================================================
// 3. 폼 제출 처리 함수 (버튼의 onclick="importData()"와 연결)
// =================================================================

/**
 * 폼 데이터를 DB에 저장하는 함수입니다. (form-input.html의 버튼과 연결)
 * @param {Event} event - 폼 제출 이벤트
 */
function importData(event) {
    if (event) {
        event.preventDefault(); // 폼의 기본 제출 동작(페이지 새로고침) 방지
    }
    
    const statusMessage = document.getElementById('statusMessage');
    
    // 폼 데이터 수집 (예시)
    const formData = {
        cas_rn: document.getElementById('cas_rn').value,
        classification: document.getElementById('classification').value,
        state: document.getElementById('state_value').value, // Hidden Input 값 사용
        unit: document.getElementById('unit_value').value,   // Hidden Input 값 사용
        // ... 나머지 필드 값 수집
    };

    // 간단한 유효성 검사 (필수 필드 확인)
    if (!formData.cas_rn || !formData.classification || !formData.state || !formData.unit) {
        if (statusMessage) {
            statusMessage.textContent = '모든 필수 항목을 입력해주세요.';
            statusMessage.style.color = 'red';
        }
        return;
    }

    // 실제 DB 저장 로직 (Fetch API를 이용한 서버 전송)
    /*
    fetch('/api/save-inventory', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            statusMessage.textContent = '재고 정보가 성공적으로 저장되었습니다.';
            statusMessage.style.color = 'green';
            // 폼 초기화 등 후속 작업
        } else {
            statusMessage.textContent = `저장 실패: ${data.message}`;
            statusMessage.style.color = 'red';
        }
    })
    .catch(error => {
        statusMessage.textContent = `통신 오류 발생: ${error.message}`;
        statusMessage.style.color = 'red';
    });
    */
    
    // 임시 성공 메시지
    if (statusMessage) {
        statusMessage.textContent = '데이터 전송 로직이 실행되었습니다. (실제 전송은 주석 처리됨)';
        statusMessage.style.color = 'blue';
    }
}

// =================================================================
// 4. 페이지 진입점 (DOMContentLoaded 이벤트)
// =================================================================

/**
 * DOM 트리가 완전히 구성된 후 (그러나 이미지 등은 로드되지 않았을 수 있음) 실행됩니다.
 * 이 시점에서 HTML 조각 로드를 시작합니다.
 */
window.addEventListener('DOMContentLoaded', () => {
    // 1. form-input.html 로드: 완료 후 폼 초기화 함수(initializeFormListeners)를 실행하도록 콜백 전달
    includeHTML('pages/form-input.html', 'form-container', initializeFormListeners); 
    
    // 2. navbar.html 로드: 특별한 JS 초기화가 필요 없으면 콜백 생략
    includeHTML('pages/navbar.html', 'navbar-container');
    
    // 3. 추가적인 전역 이벤트 리스너 또는 설정 (예: 사진 미리보기 이벤트 설정)
    
    // 파일 선택 이벤트 리스너 (DOM에 추가되었는지 확인 후)
    document.addEventListener('change', (event) => {
        if (event.target.id === 'file_select' || event.target.id === 'camera_capture') {
            handlePhotoPreview(event.target);
        }
    });

});

// 사진 미리보기 핸들러 (예시)
function handlePhotoPreview(input) {
    const preview = document.getElementById('photo_preview');
    if (input.files && input.files[0] && preview) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }
        reader.readAsDataURL(input.files[0]);
    }
}