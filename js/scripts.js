// =================================================================
// 0. 전역 변수 및 설정
// =================================================================

// 🚨 Supabase 및 Edge Function 설정
const SUPABASE_URL = "https://muprmzkvrjacqatqxayf.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cHJtemt2cmphY3FhdHF4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MDM4MjgsImV4cCI6MjA3NDM3OTgyOH0.a4gUjlp9reaO28kxdLrh5dF0IUscXWgtXbB7PY4wWsk";
const FUNCTION_NAME = "casimport"; 
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;

// 🔑 버튼 그룹의 선택 값을 저장할 전역 변수
let selectedClassification = null; 
let selectedState = null;
let selectedUnit = null; 
let selectedConcentrationUnit = null;
let selectedManufacturer = null; 

// 전역에서 접근해야 하는 HTML 요소들 (Storage 관련 요소는 제거)
let statusMessage = null;
// let photoInput = null; // ❌ 삭제: DOM 요소 접근 필요 없음
// let cameraInput = null; // ❌ 삭제
// let photoPreview = null; // ❌ 삭제
let manufacturerButtonsGroup = null;
let otherManufacturerGroup = null;
let manufacturerOtherInput = null;


// =================================================================
// 1. HTML 조각 파일 로더 함수
// =================================================================
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
                targetElement.innerHTML = htmlContent;

                if (callback) {
                    callback();
                }
            } else {
                console.error(`Target element not found: #${targetElementId}`);
            }
        })
        .catch(error => {
            console.error('Error during HTML include:', error);
            const msgElement = document.getElementById('statusMessage');
            if (msgElement) {
                msgElement.textContent = `페이지 로드 오류: ${url}`;
            }
        });
}


// =================================================================
// 2. 폼 요소 초기화 로직 (콜백 함수)
// =================================================================

function initializeFormListeners() {
    console.log("폼 요소 초기화 시작...");

    // 📌 전역 변수 재할당: DOM 요소 찾기
    statusMessage = document.getElementById('statusMessage');
    // photoInput = document.getElementById('file_select'); // ❌ 삭제
    // cameraInput = document.getElementById('camera_capture'); // ❌ 삭제
    // photoPreview = document.getElementById('photo_preview'); // ❌ 삭제
    manufacturerButtonsGroup = document.getElementById('manufacturer_buttons');
    otherManufacturerGroup = document.getElementById('other_manufacturer_group');
    manufacturerOtherInput = document.getElementById('manufacturer_other');
    
    // --- 버튼 그룹 설정 실행 ---
    setupButtonGroup('classification_buttons'); 
    setupButtonGroup('state_buttons');
    setupButtonGroup('unit_buttons');
    setupButtonGroup('concentration_unit_buttons'); 
    setupButtonGroup('manufacturer_buttons'); 

    // --- 사진 파일 이벤트 리스너 설정 (삭제) ---
    // if (photoInput) photoInput.addEventListener('change', handlePhotoChange); // ❌ 삭제
    // if (cameraInput) cameraInput.addEventListener('change', handlePhotoChange); // ❌ 삭제
    
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
// 3. 버튼 그룹 핸들러 함수 (유지)
// =================================================================
function setupButtonGroup(groupId, initialValue = null) {
    const group = document.getElementById(groupId);
    if (!group) return; 

    group.addEventListener('click', (event) => {
        const targetButton = event.target.closest('button');
        if (targetButton) {
            group.querySelectorAll('.active').forEach(btn => {
                btn.classList.remove('active');
            });
            targetButton.classList.add('active');

            const value = targetButton.getAttribute('data-value');
            if (groupId === 'state_buttons') {
                selectedState = value;
            } else if (groupId === 'unit_buttons') {
                selectedUnit = value;
            } else if (groupId === 'concentration_unit_buttons') {
                selectedConcentrationUnit = value;
            } else if (groupId === 'manufacturer_buttons') {
                selectedManufacturer = value;
            } else if (groupId === 'classification_buttons') {
                selectedClassification = value;
            }
        }
    });

    if (initialValue) {
        const initialButton = group.querySelector(`button[data-value="${initialValue}"]`);
        if (initialButton) {
            initialButton.classList.add('active');
        }
    }
}


// =================================================================
// 4. 사진 파일 미리보기 핸들러 (삭제됨)
// =================================================================

/* ❌ handlePhotoChange 함수 정의 전체 삭제 */


// =================================================================
// 5. 폼 제출 처리 함수 (Storage 로직 제거)
// =================================================================

async function importData() {
    if (event) {
        event.preventDefault(); 
    }

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
    const classification = selectedClassification; // ❌ 수정: selectedClassification 사용
    
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

    // 3. 사진 파일 처리 로직 (완전 삭제)
    // photoBase64 및 photoMimeType은 이 로직에서 생성되지 않습니다.
    
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
            // ❌ photo_base64 및 photo_mime_type 필드 제거
            photo_base64: null,
            photo_mime_type: null,
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
        
        // 6. 성공 응답 처리 (유지)
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
    // 1. form-input.html 로드: 완료 후 initializeFormListeners 콜백으로 실행
    includeHTML('pages/form-input.html', 'form-container', initializeFormListeners); 
    
    // 2. navbar.html 로드
    includeHTML('pages/navbar.html', 'navbar-container'); 
});


/**
 * 윈도우 시작 메뉴 팝업을 열고 닫는 함수
 */
function toggleStartMenu(event) {
    // 이벤트가 폼 제출을 유발하지 않도록 막습니다.
    if (event) {
        event.preventDefault(); 
    }
    
    const startMenu = document.getElementById('start-menu');
    if (startMenu) {
        startMenu.classList.toggle('visible');
    }
}

// 팝업이 열려 있을 때, 팝업 바깥을 클릭하면 팝업이 닫히도록 설정
window.addEventListener('click', (event) => {
    const startMenu = document.getElementById('start-menu');
    const startButton = document.querySelector('.start-button'); // 버튼을 다시 찾습니다.
    
    if (startMenu && startMenu.classList.contains('visible')) {
        // 팝업 내부나 시작 버튼을 클릭한 경우가 아니면 팝업을 닫습니다.
        if (event.target !== startMenu && !startMenu.contains(event.target) && 
            event.target !== startButton && !startButton.contains(event.target)) {
            startMenu.classList.remove('visible');
        }
    }
});
// 참고: toggleStartMenu 함수는 navbar.html의 버튼 onclick="toggleStartMenu(event)"에서 호출됩니다.