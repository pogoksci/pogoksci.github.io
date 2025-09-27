// =================================================================
// 전역 변수 (HTML 로드 시점에 null이더라도, 이후 initializeFormListeners에서 재접근 가능)
// =================================================================
let selectedState = null;
let selectedUnit = 'g'; // 단위 기본값 설정

// 전역에서 접근해야 하는 HTML 요소 (DOM이 로드된 후에 이 변수들을 다시 참조해야 함)
let statusMessage = null;
let photoInput = null;
let cameraInput = null;
let photoPreview = null;


// =================================================================
// 1. HTML 조각 파일을 비동기적으로 로드하고 콜백을 실행하는 핵심 함수
// (이전 코드에서 콜백 매개변수만 추가됨)
// =================================================================

/**
 * 지정된 URL에서 HTML 내용을 가져와 특정 요소에 삽입 후 콜백 함수를 실행합니다.
 * @param {string} url - 불러올 HTML 파일 경로
 * @param {string} targetElementId - 내용을 삽입할 대상 요소의 ID
 * @param {function} callback - HTML 삽입 완료 후 실행할 함수 (선택 사항)
 */
function includeHTML(url, targetElementId, callback) {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                // HTTP 상태 코드가 200 (OK)이 아닌 경우 오류 처리
                throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
            }
            return response.text();
        })
        .then(htmlContent => {
            const targetElement = document.getElementById(targetElementId);
            if (targetElement) {
                // 불러온 HTML 내용을 대상 요소에 삽입
                targetElement.innerHTML = htmlContent;

                // 📌 HTML 삽입 완료 후, 콜백 함수를 실행하여 동적 요소를 초기화
                if (callback) {
                    callback();
                }
            } else {
                console.error(`Target element not found: #${targetElementId}`);
            }
        })
        .catch(error => {
            console.error('Error during HTML include:', error);
            // statusMessage는 전역 변수이므로, DOM 로드 시점에 따라 null일 수 있어 안전하게 재탐색
            const msgElement = document.getElementById('statusMessage');
            if (msgElement) {
                 msgElement.textContent = `페이지 로드 오류: ${url}`;
            }
        });
}


// =================================================================
// 2. form-input.html 내용 삽입 완료 후 실행될 초기화 로직 (이전 코드의 분산된 초기화 로직 통합)
// =================================================================

/**
 * form-input.html 내부의 동적으로 삽입된 요소들에 이벤트 리스너를 연결하고 전역 변수를 재설정합니다.
 */
function initializeFormListeners() {
    console.log("폼 요소 초기화 시작...");

    // 📌 전역 변수 재할당: 동적으로 로드된 요소에 대한 참조를 얻습니다.
    statusMessage = document.getElementById('statusMessage');
    photoInput = document.getElementById('file_select');
    cameraInput = document.getElementById('camera_capture');
    photoPreview = document.getElementById('photo_preview');
    
    // --- 2-1. 버튼 그룹 설정 실행 ---
    // 기존에 DOMContentLoaded 외부와 하단에 있던 setupButtonGroup 호출 코드를 여기에 배치합니다.
    setupButtonGroup('state_buttons'); // 상태 버튼 그룹 설정
    setupButtonGroup('unit_buttons', 'g'); // 단위 버튼 그룹 설정 (기본값 'g'로 설정)

    // --- 2-2. 사진 파일 이벤트 리스너 설정 ---
    // 기존에 DOMContentLoaded 밖에 있던 이벤트 리스너 설정 코드를 여기에 배치합니다.
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoChange);
    }
    if (cameraInput) {
        cameraInput.addEventListener('change', handlePhotoChange);
    }

    // 2-3. [중요] 폼 내부에 의존하는 다른 모든 초기화 코드가 있다면 여기에 추가하세요.
    // 예: document.getElementById('cas_rn').addEventListener('input', updateCasInfo); 
    // 현재 코드에서는 버튼 그룹과 사진 입력만 있으므로 이대로 완료됩니다.

    console.log("폼 요소 초기화 완료.");
}


// =================================================================
// 3. 버튼 그룹 핸들러 함수 (이전 코드와 동일)
// =================================================================

function setupButtonGroup(groupId, initialValue = null) {
    const group = document.getElementById(groupId);
    if (!group) return; 

    group.addEventListener('click', (event) => {
        const targetButton = event.target.closest('button');
        if (targetButton) {
            // 스타일 변경
            group.querySelectorAll('.active').forEach(btn => {
                btn.classList.remove('active');
            });
            targetButton.classList.add('active');

            // 전역 변수 값 업데이트
            const value = targetButton.getAttribute('data-value');
            // 💡 주의: 이 코드는 Hidden Input을 사용하지 않고 전역 변수를 사용하도록 설계됨
            if (groupId === 'state_buttons') {
                selectedState = value;
            } else if (groupId === 'unit_buttons') {
                selectedUnit = value;
            }
        }
    });

    // 초기값 설정 (스타일링)
    if (initialValue) {
        const initialButton = group.querySelector(`button[data-value="${initialValue}"]`);
        if (initialButton) {
            initialButton.classList.add('active');
        }
    }
}


// =================================================================
// 4. 사진 파일 미리보기 핸들러 (이전 코드와 동일)
// =================================================================

function handlePhotoChange(event) {
    // photoPreview는 initializeFormListeners에서 재할당되었으므로 사용 가능
    if (!photoPreview) return; 
    
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            photoPreview.src = e.target.result;
            photoPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        photoPreview.style.display = 'none';
    }
}


// =================================================================
// 5. 폼 제출 처리 함수 (이전 코드와 동일)
// =================================================================

/**
 * 폼 데이터를 수집하여 Edge Function으로 전송합니다.
 */
async function importData() {
    // statusMessage는 initializeFormListeners에서 재할당되었으므로 사용 가능
    if (!statusMessage) return; 
    
    statusMessage.textContent = '데이터를 처리 중입니다... 잠시만 기다려 주세요.';
    statusMessage.style.color = 'blue';

    // 1. 폼 데이터 수집 및 유효성 검사
    const casRn = document.getElementById('cas_rn').value.trim();
    
    // 🔑 DOM 요소에서 직접 가져오는 값들
    const purchaseVolumeStr = document.getElementById('purchase_volume').value;
    const concentrationValueStr = document.getElementById('concentration_value').value;
    const concentrationUnit = document.getElementById('concentration_unit').value;   
    const manufacturer = document.getElementById('manufacturer').value.trim();
    const purchaseDate = document.getElementById('purchase_date').value;
    const classification = document.getElementById('classification').value;
    
    // 🔑 버튼 그룹 값 가져오기 (전역 변수 사용)
    const state = selectedState; 
    const unit = selectedUnit; 

    if (!casRn) {
        statusMessage.textContent = 'CAS 번호를 입력해 주세요.';
        statusMessage.style.color = 'red';
        return;
    }

    // 2. 숫자 변환 및 NaN 처리
    const purchaseVolume = parseFloat(purchaseVolumeStr);
    const concentrationValue = parseFloat(concentrationValueStr);

    // 3. 사진 파일 처리 (Base64 인코딩)
    let photoBase64 = null;
    const file = photoInput ? photoInput.files[0] : (cameraInput ? cameraInput.files[0] : null);
    
    if (file) {
        photoBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                if (typeof base64String === 'string') {
                    // Data URL에서 Base64 부분만 추출
                    resolve(base64String.split(',')[1]); 
                } else {
                    resolve(null);
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // 4. 서버로 전송할 최종 Inventory 데이터 구성
    const inventoryData = {
        casRns: [casRn], 
        inventoryDetails: {
            // 숫자 값이 NaN일 경우 DB에 NULL을 삽입하도록 처리
            concentration_value: isNaN(concentrationValue) ? null : concentrationValue,
            concentration_unit: concentrationUnit || null,
            purchase_volume: isNaN(purchaseVolume) ? 0 : purchaseVolume,
            current_amount: isNaN(purchaseVolume) ? 0 : purchaseVolume, // 재고량은 구입량과 동일하게 시작
            
            unit: unit,
            state: state,
            
            manufacturer: manufacturer || null,
            purchase_date: purchaseDate || null,
            classification: classification || null,
            photo_base64: photoBase64, // Storage 업로드용
            
            location: 'Initial Check-in',
        }
    };
    
    try {
        // config.js에 정의된 전역 변수 (EDGE_FUNCTION_URL, SUPABASE_ANON_KEY)를 사용해야 함
        // 5. Supabase Edge Function 호출 (Anon Key를 사용하여 인증)
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 
            },
            body: JSON.stringify(inventoryData)
        });

        const data = await response.json();

        if (!response.ok) {
            // 서버에서 보낸 오류 메시지 또는 HTTP 상태 오류를 처리
            throw new Error(data.error || `HTTP Error! Status: ${response.status}`);
        }
        
        // 6. 성공 응답 처리
        const result = data[0];
        let msg = '';
        
        if (result.isNewSubstance) {
            msg = `✅ 신규 물질(${casRn}) 정보 및 시약병(${result.inventoryId}) 등록 완료!`;
        } else {
            msg = `✅ 기존 물질(${casRn})에 새 시약병(${result.inventoryId}) 등록 완료!`;
        }

        statusMessage.textContent = msg;
        statusMessage.style.color = 'green';
        // 성공 후 폼 초기화 로직 추가 가능
        // document.getElementById('form_id').reset(); 

    } catch (error) {
        console.error("데이터 전송 중 오류 발생:", error);
        statusMessage.textContent = `❌ 오류: 데이터 처리 실패. 콘솔을 확인하세요. (${error.message})`;
        statusMessage.style.color = 'red';
    }
}


// =================================================================
// 6. 페이지 진입점 (DOMContentLoaded 이벤트)
// =================================================================

/**
 * DOM 트리가 완전히 구성된 후 (index.html 뼈대만 로드됨) 실행됩니다.
 * 이 시점에서 HTML 조각 로드를 시작합니다.
 */
window.addEventListener('DOMContentLoaded', () => {
    // 1. form-input.html 로드: 완료 후 폼 초기화 함수(initializeFormListeners)를 실행하도록 콜백 전달
    includeHTML('pages/form-input.html', 'form-container', initializeFormListeners); 
    
    // 2. navbar.html 로드: 특별한 JS 초기화가 필요 없으면 콜백 생략
    includeHTML('pages/navbar.html', 'navbar-container'); 
});