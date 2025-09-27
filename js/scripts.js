// =================================================================
// 0. 전역 변수 및 설정
// =================================================================

// 🚨 Supabase 및 Edge Function 설정 (index.html <head>에서 정의되었거나 여기에 포함되어야 합니다)
const SUPABASE_URL = "https://muprmzkvrjacqatqxayf.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cHJtemt2cmphY3FhdHF4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MDM4MjgsImV4cCI6MjA3NDM3OTgyOH0.a4gUjlp9reaO28kxdLrh5dF0IUscXWgtXbB7PY4wWsk";
const FUNCTION_NAME = "casimport"; 
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;

// 🔑 버튼 그룹의 선택 값을 저장할 전역 변수
let selectedClassification = null; // 🔑 새로운 전역 변수 추가
let selectedState = null;
let selectedUnit = null; 
let selectedConcentrationUnit = null;
let selectedManufacturer = null; // ⚠️ manufacture도 전역 변수여야 합니다.

// 전역에서 접근해야 하는 HTML 요소들 (초기값은 null)
let statusMessage = null;
let photoInput = null;
let cameraInput = null;
let photoPreview = null;
let manufacturerButtonsGroup = null;
let otherManufacturerGroup = null;
let manufacturerOtherInput = null;


// =================================================================
// 1. HTML 조각 파일 로더 함수
// =================================================================

/**
 * 지정된 URL에서 HTML 내용을 가져와 특정 요소에 삽입 후 콜백 함수를 실행합니다.
 */
function includeHTML(url, targetElementId, callback) {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
            }
            return response.text();
        })
        .then(htmlContent => {
            const targetElement = document.getElementById(targetElementId);
            if (targetElement) {
                // 불러온 HTML 내용을 대상 요소에 삽입
                targetElement.innerHTML = htmlContent;

                // HTML 삽입 완료 후, 콜백 함수를 실행하여 동적 요소를 초기화
                if (callback) {
                    callback();
                }
            } else {
                console.error(`Target element not found: #${targetElementId}`);
            }
        })
        .catch(error => {
            console.error('Error during HTML include:', error);
            // 오류 메시지 표시 (statusMessage가 로드되어 있다고 가정)
            const msgElement = document.getElementById('statusMessage');
            if (msgElement) {
                msgElement.textContent = `페이지 로드 오류: ${url}`;
            }
        });
}


// =================================================================
// 2. 폼 요소 초기화 로직 (콜백 함수)
// =================================================================

/**
 * form-input.html 내부의 동적으로 삽입된 요소들에 이벤트 리스너를 연결하고 전역 변수를 재설정합니다.
 */
function initializeFormListeners() {
    console.log("폼 요소 초기화 시작...");

    // 📌 전역 변수 재할당: 동적으로 로드된 요소를 찾습니다.
    let selectedManufacturer = null;
    statusMessage = document.getElementById('statusMessage');
    photoInput = document.getElementById('file_select');
    cameraInput = document.getElementById('camera_capture');
    photoPreview = document.getElementById('photo_preview');
    manufacturerButtonsGroup = document.getElementById('manufacturer_buttons');
    otherManufacturerGroup = document.getElementById('other_manufacturer_group');
    manufacturerOtherInput = document.getElementById('manufacturer_other');
    
    // --- 버튼 그룹 설정 실행 ---
    setupButtonGroup('state_buttons');
    setupButtonGroup('unit_buttons', 'g');
    setupButtonGroup('concentration_unit_buttons'); 
    setupButtonGroup('manufacturer_buttons'); 

    // --- 사진 파일 이벤트 리스너 설정 ---
    if (photoInput) photoInput.addEventListener('change', handlePhotoChange);
    if (cameraInput) cameraInput.addEventListener('change', handlePhotoChange);
    
    // --- '기타' 제조사 입력란 표시 이벤트 리스너 설정 ---
    if (manufacturerButtonsGroup) {
        manufacturerButtonsGroup.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON') {
                const value = event.target.getAttribute('data-value');
                if (value === '기타') {
                    otherManufacturerGroup.style.display = 'block'; 
                    manufacturerOtherInput.setAttribute('required', 'required'); 
                } else {
                    otherManufacturerGroup.style.display = 'none'; 
                    manufacturerOtherInput.removeAttribute('required');
                    manufacturerOtherInput.value = '';
                }
            }
        });
    }

    console.log("폼 요소 초기화 완료.");
}


// =================================================================
// 3. 버튼 그룹 핸들러 함수
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
            if (groupId === 'state_buttons') {
                selectedState = value;
            } else if (groupId === 'unit_buttons') {
                selectedUnit = value;
            } else if (groupId === 'concentration_unit_buttons') {
                selectedConcentrationUnit = value;
            } else if (groupId === 'manufacturer_buttons') {
                selectedManufacturer = value;
            }
        }
    });

    // 초기값 설정
    if (initialValue) {
        const initialButton = group.querySelector(`button[data-value="${initialValue}"]`);
        if (initialButton) {
            initialButton.classList.add('active');
        }
    }
}


// =================================================================
// 4. 사진 파일 미리보기 핸들러
// =================================================================

function handlePhotoChange(event) {
    // photoPreview가 재할당되었는지 확인
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
// 5. 폼 제출 처리 함수
// =================================================================

async function importData() {
    if (!statusMessage) return; 
    
    statusMessage.textContent = '데이터를 처리 중입니다... 잠시만 기다려 주세요.';
    statusMessage.style.color = 'blue';

    // 1. 폼 데이터 수집 및 유효성 검사
    const casRn = document.getElementById('cas_rn').value.trim();
    const purchaseVolumeStr = document.getElementById('purchase_volume').value;
    const concentrationValueStr = document.getElementById('concentration_value').value;
    const concentrationUnit = selectedConcentrationUnit; 
    const manufacturerSelect = selectedManufacturer; 
    const manufacturerOther = manufacturerOtherInput ? manufacturerOtherInput.value.trim() : ''; 
    const purchaseDate = document.getElementById('purchase_date').value;
    const classification = document.getElementById('classification').value;
    
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

    // 제조원 최종 결정
    let finalManufacturer = null;
    if (manufacturerSelect === '기타') {
        finalManufacturer = manufacturerOther || '기타 (미입력)';
    } else {
        finalManufacturer = manufacturerSelect;
    }

    // 3. 사진 파일 처리 (Base64 인코딩)
    let photoBase64 = null;
    const file = photoInput.files[0] || cameraInput.files[0];
    
    if (file) {
        photoBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                if (typeof base64String === 'string') {
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
            concentration_value: isNaN(concentrationValue) ? null : concentrationValue,
            concentration_unit: concentrationUnit || null,
            purchase_volume: isNaN(purchaseVolume) ? 0 : purchaseVolume,
            current_amount: isNaN(purchaseVolume) ? 0 : purchaseVolume,
            unit: unit,                      
            state: state,                    
            manufacturer: finalManufacturer,
            purchase_date: purchaseDate || null,
            classification: classification || null,
            photo_base64: photoBase64,
            location: 'Initial Check-in',
        }
    };
    
    try {
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

    } catch (error) {
        console.error("데이터 전송 중 오류 발생:", error);
        statusMessage.textContent = `❌ 오류: 데이터 처리 실패. 콘솔을 확인하세요. (${error.message})`;
        statusMessage.style.color = 'red';
    }
}


// =================================================================
// 6. 페이지 진입점 (최종 실행 시작)
// =================================================================

window.addEventListener('DOMContentLoaded', () => {
    // 1. form-input.html 로드: 완료 후 フォーム初期化 함수(initializeFormListeners)를 콜백으로 실행
    // ⚠️ index.html에 <div id="form-container"></div> 가 있어야 합니다.
    includeHTML('pages/form-input.html', 'form-container', initializeFormListeners); 
    
    // 2. navbar.html 로드
    includeHTML('pages/navbar.html', 'navbar-container'); 
    
    // ❌ 경고: 여기에 있는 initializeFormListeners() 호출은 삭제되어야 합니다.
    // initializeFormListeners(); 
});