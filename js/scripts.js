// =================================================================
// 0. 전역 변수 및 설정
// =================================================================

// 🚨 Supabase 및 Edge Function 설정 (이 값들이 실제 키로 대체되었는지 확인하세요)
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

// 🔑 수납위치 관련 전역 변수
let allAreas = []; // Area 데이터 전체 저장
let allCabinets = []; // Cabinet 데이터 전체 저장
let selectedAreaId = null; 
let selectedCabinetId = null;

// 6단계 위치 선택 값을 저장할 객체 (Inventory DB에 저장될 최종 값)
let locationSelections = {
    cabinet_id: null,
    door_vertical: null,
    door_horizontal: null,
    internal_shelf_level: null,
    storage_column: null,
    location_area: null 
};

// 전역에서 접근해야 하는 HTML 요소들 (초기값은 null)
let statusMessage = null;
//let photoInput = null; 
//let cameraInput = null; 
//let photoPreview = null; 
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

    // 📌 전역 변수 재할당: 동적으로 로드된 요소를 찾습니다.
    // (index.html 본체에 있는 요소도 포함하여 여기서 모두 다시 찾습니다.)
    statusMessage = document.getElementById('statusMessage'); 
    
    // form-input.html 조각 안에 있는 요소들
    manufacturerButtonsGroup = document.getElementById('manufacturer_buttons');
    otherManufacturerGroup = document.getElementById('other_manufacturer_group');
    manufacturerOtherInput = document.getElementById('manufacturer_other');
    
    // --- 버튼 그룹 설정 실행 ---
    setupButtonGroup('classification_buttons'); 
    setupButtonGroup('state_buttons');
    setupButtonGroup('unit_buttons');
    setupButtonGroup('concentration_unit_buttons'); 
    setupButtonGroup('manufacturer_buttons'); 
    
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

    // 🔑 장소 데이터 로드 시작
    fetchLocationData(); 

    console.log("폼 요소 초기화 완료.");
}

// ------------------------------------------------------------------
// 2-1. 장소 데이터 조회 함수 (Edge Function GET 호출)
// ------------------------------------------------------------------
async function fetchLocationData() {
    try {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '장소 데이터 조회 실패');
        }
        
        // 전역 변수에 저장
        allAreas = data.areas;
        allCabinets = data.cabinets;
        
        // 1단계 UI 채우기 시작
        populateAreaSelect(allAreas);

    } catch (error) {
        console.error("장소 데이터 로드 중 오류 발생:", error);
        if (statusMessage) {
            statusMessage.textContent = `❌ 장소 정보 로드 오류: ${error.message}`;
            statusMessage.style.color = 'red';
        }
    }
}

// ------------------------------------------------------------------
// 2-2. 수납위치 UI 동적 제어 함수
// ------------------------------------------------------------------

/**
 * 1단계: 약품실 드롭다운 채우기
 */
function populateAreaSelect(areas) {
    const areaSelect = document.getElementById('location_area_select');
    if (!areaSelect) return;

    areaSelect.innerHTML = '<option value="" disabled selected>약품실 선택</option>';
    areas.forEach(area => {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.name;
        areaSelect.appendChild(option);
    });

    // 이벤트 리스너 연결
    areaSelect.addEventListener('change', (event) => {
        handleAreaSelect(event.target.value);
    });
}

/**
 * 2단계: 수납함(Cabinet) 드롭다운 업데이트 및 3~6단계 초기화
 */
function handleAreaSelect(areaIdStr) {
    // 1. 선택 값 초기화 및 저장
    selectedAreaId = parseInt(areaIdStr, 10);
    locationSelections.location_area = allAreas.find(a => a.id === selectedAreaId)?.name || null;
    selectedCabinetId = null;
    
    // 2. 수납함 드롭다운 업데이트
    const cabinetSelect = document.getElementById('location_cabinet_select');
    if (!cabinetSelect) return;
    
    cabinetSelect.innerHTML = '<option value="" disabled selected>수납함 선택</option>';
    cabinetSelect.disabled = false; // 활성화
    
    if (selectedAreaId) {
        const filteredCabinets = allCabinets.filter(c => c.area_id === selectedAreaId);
        filteredCabinets.forEach(cabinet => {
            const option = document.createElement('option');
            option.value = cabinet.id;
            // Cabinet 속성 전체를 data-info 속성에 저장하여 3~6단계 로직에 활용
            option.setAttribute('data-cabinet-info', JSON.stringify(cabinet)); 
            option.textContent = cabinet.name;
            cabinetSelect.appendChild(option);
        });
    }

    // 3. 이벤트 리스너 연결 (새로 연결해야 함)
    cabinetSelect.onchange = (event) => {
        // 선택된 option의 data-cabinet-info 속성에서 Cabinet 객체 전체를 가져옵니다.
        const selectedOption = event.target.options[event.target.selectedIndex];
        const cabinetInfo = JSON.parse(selectedOption.getAttribute('data-cabinet-info'));
        
        handleCabinetSelect(event.target.value, cabinetInfo);
    };
    
    // 4. 3~6단계 UI 초기화
    clearLocationSteps();
}

/**
 * 3~6단계: 선택된 Cabinet 기반으로 버튼 그룹 동적 생성
 */
function handleCabinetSelect(cabinetIdStr, cabinetInfo) {
    selectedCabinetId = parseInt(cabinetIdStr, 10);
    locationSelections.cabinet_id = selectedCabinetId;
    
    // 3~6단계 UI 초기화
    clearLocationSteps();
    if (!selectedCabinetId) return;

    // 1. 3단계 (상/중/하 도어 분할 수) 버튼 생성
    generateLocationButtons(
        'location_door_vertical_group', 
        cabinetInfo.door_vertical_count, 
        'door_vertical',
        (i) => `${i}단 도어`
    );
    
    // 2. 4단계 (좌/우 분할 수) 버튼 생성
    generateLocationButtons(
        'location_door_horizontal_group', 
        cabinetInfo.door_horizontal_count, 
        'door_horizontal',
        (i) => i === 1 ? '단일 문' : (i === 2 ? '좌/우' : `분할 ${i}개`)
    );

    // 3. 5단계 (도어당 선반 층수) 버튼 생성
    // (shelf_height: 3층이면 3개의 버튼 생성)
    generateLocationButtons(
        'location_internal_shelf_group', 
        cabinetInfo.shelf_height, 
        'internal_shelf_level',
        (i) => `${i}층`
    );

    // 4. 6단계 (도어 내부 보관 열 수) 버튼 생성
    // (storage_columns: 6열이면 6개의 버튼 생성)
    generateLocationButtons(
        'location_storage_column_group', 
        cabinetInfo.storage_columns, 
        'storage_column',
        (i) => `${i}열`
    );
}

/**
 * 3~6단계 버튼 UI 및 값 초기화 헬퍼 함수
 */
function clearLocationSteps() {
    // 모든 위치 선택 값 초기화 (Cabinet ID와 Area Name 제외)
    locationSelections.door_vertical = null;
    locationSelections.door_horizontal = null;
    locationSelections.internal_shelf_level = null;
    locationSelections.storage_column = null;
    
    // UI 초기화
    const containerIds = [
        'location_door_vertical_group', 
        'location_door_horizontal_group', 
        'location_internal_shelf_group', 
        'location_storage_column_group'
    ];
    containerIds.forEach(id => {
        const container = document.getElementById(id);
        if (container) container.innerHTML = '<span style="color:#888;">수납함 선택 후 표시됩니다.</span>';
    });
}

/**
 * 버튼 그룹 동적 생성 헬퍼 함수
 */
function generateLocationButtons(containerId, count, dataKey, nameFormatter) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = ''; // 기존 버튼 제거
    
    for (let i = 0; i < count; i++) {
        const value = i + 1; // 1부터 시작 (1, 2, 3...)
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-location'; // CSS는 styles.css에서 정의해야 함
        button.setAttribute('data-value', value);
        button.textContent = nameFormatter(value);
        
        // 이벤트 리스너 추가
        button.addEventListener('click', () => {
            // 버튼 활성화 스타일 업데이트
            container.querySelectorAll('.active').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // 전역 위치 객체 업데이트
            locationSelections[dataKey] = value;
        });

        container.appendChild(button);
    }
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
            } else if (groupId === 'classification_buttons') {
                selectedClassification = value;
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
// 4. Navbar 이벤트 리스너 설정 (토글 및 외부 닫힘)
// =================================================================

function setupNavbarListeners() {
    const startMenu = document.getElementById('start-menu');
    const startButton = document.querySelector('.start-button'); 
    
    if (!startMenu || !startButton) {
        console.error("Navbar elements not found after loading!");
        return;
    }

    // 1. Start Button에 클릭 이벤트 연결 (메뉴 토글)
    startButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation(); // 팝업 외부 닫힘 이벤트로 전파 차단
        
        startMenu.classList.toggle('visible'); // 메뉴 토글
    });

    // 2. 팝업 외부 닫힘 이벤트 로직 (Window에 연결)
    // 이 로직은 navbar HTML이 로드된 후에 단 한 번만 연결되어야 합니다.
    window.addEventListener('click', (event) => {
        // 팝업이 열려 있고, 클릭된 요소가 팝업 내부도 아니고 버튼도 아니라면 닫기
        if (startMenu.classList.contains('visible')) {
            if (!startMenu.contains(event.target) &&
                !startButton.contains(event.target)) {
                
                startMenu.classList.remove('visible');
            }
        }
    });
}


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
    const classification = selectedClassification; 
    
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

    // 3. 서버로 전송할 최종 Inventory 데이터 구성
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
            
            cabinet_id: locationSelections.cabinet_id,
            location_area: locationSelections.location_area,
            door_vertical: locationSelections.door_vertical,
            door_horizontal: locationSelections.door_horizontal,
            internal_shelf_level: locationSelections.internal_shelf_level,
            storage_column: locationSelections.storage_column,

            // Storage 로직 제거에 따른 null 명시
            photo_base64: null, 
            photo_mime_type: null,
            photo_storage_url: null,
            
            location: 'Initial Check-in', // ⚠️ 보관장소는 이 다음 단계에서 수정할 예정
        }
    };
    
    try {
        // 5. Supabase Edge Function 호출
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
    // 1. form-input.html 로드: 완료 후 initializeFormListeners 콜백으로 실행
    includeHTML('pages/form-input.html', 'form-container', initializeFormListeners); 
    
    // 2. navbar.html 로드: 완료 후 navbar 이벤트 설정을 콜백으로 실행
    includeHTML('pages/navbar.html', 'navbar-container', setupNavbarListeners); 
});