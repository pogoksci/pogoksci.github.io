// =================================================================
// 0. 전역 변수 및 설정
// =================================================================

// 🚨 Supabase 및 Edge Function 설정 (이 값들이 실제 키로 대체되었는지 확인하세요)
const SUPABASE_URL = "https://muprmzkvrjacqatqxayf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cHJtemt2cmphY3FhdHF4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjYwNzAsImV4cCI6MjA3NTEwMjA3MH0.K2MO-l6QG5nztCPlT3_zqYOrMt-bqM-O5ZYLQpV1L9Y";
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
let selectedCabinetId = null;
// 🔑 캐비닛 등록 폼 전용 선택 값
let selectedAreaCreation = null;
let selectedCabinetName = null;
let selectedDoorVerticalSplit = null;
let selectedDoorHorizontalSplit = null;
let selectedShelfHeight = null;
let selectedStorageColumns = null;

// 🔑 기타 입력란 DOM 요소 (초기화는 setupCabinetRegisterForm 안에서 수행)
let otherAreaInput = null;
let otherCabinetInput = null;

// 6단계 위치 선택 값을 저장할 객체 (Inventory DB에 저장될 최종 값)
const locationSelections = {
    cabinet_id: null,
    door_vertical: null,
    door_horizontal: null,
    internal_shelf_level: null,
    storage_columns: null,
    location_area: null
};

// 전역에서 접근해야 하는 HTML 요소들 (초기값은 null)
let statusMessage = null;
let manufacturerButtonsGroup = null;
let otherManufacturerGroup = null;
let manufacturerOtherInput = null;

// 사진 관련
let photoInput = null;
let cameraInput = null;
let photoPreview = null;
let selectedPhoto_320_Base64 = null; // 이미지 데이터를 Base64로 저장할 변수
let selectedPhoto_160_Base64 = null; // 이미지 데이터를 Base64로 저장할 변수
let cameraStream = null; // 카메라 스트림을 저장할 전역 변수
let selectedCabinetPhoto_320_Base64 = null;
let selectedCabinetPhoto_160_Base64 = null;

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

    // '+' 버튼(FAB) 숨기기
    setFabVisibility(false);

    // 📌 전역 변수 재할당
    statusMessage = document.getElementById('statusMessage');
    manufacturerButtonsGroup = document.getElementById('manufacturer_buttons');
    otherManufacturerGroup = document.getElementById('other_manufacturer_group');
    manufacturerOtherInput = document.getElementById('manufacturer_other');

    // ⬇️ [수정됨] 사진 및 카메라 모달 관련 요소 전체 초기화
    photoInput = document.getElementById('photo-input');
    cameraInput = document.getElementById('camera-input'); // 모바일 폴백용으로 유지
    photoPreview = document.getElementById('photo-preview');
    const cameraBtn = document.getElementById('camera-btn');
    const photoBtn = document.getElementById('photo-btn');
    
    // 모달 관련 요소
    const captureBtn = document.getElementById('capture-btn');
    const cancelCameraBtn = document.getElementById('cancel-camera-btn');

    // '카메라로 촬영' 버튼 클릭 시 startCamera 함수 호출
    if (cameraBtn) {
        cameraBtn.addEventListener('click', startCamera);
    }
    // '파일에서 선택' 버튼 클릭 시 photoInput을 클릭
    if (photoBtn && photoInput) {
        photoBtn.addEventListener('click', () => photoInput.click());
    }
    // 모달의 '사진 찍기' 버튼 클릭 시 takePicture 함수 호출
    if (captureBtn) {
        captureBtn.addEventListener('click', takePicture);
    }
    // 모달의 '취소' 버튼 클릭 시 stopCamera 함수 호출
    if (cancelCameraBtn) {
        cancelCameraBtn.addEventListener('click', stopCamera);
    }
    
    // 파일이 선택되었을 때의 공통 처리 함수 (기존과 동일)
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            processImage(e.target.result, (resizedImages) => {
                selectedPhoto_320_Base64 = resizedImages.base64_320;
                selectedPhoto_160_Base64 = resizedImages.base64_160;
                photoPreview.innerHTML = `<img src="${resizedImages.base64_320}" alt="Photo preview">`;
            });
        };
        reader.readAsDataURL(file);
    };

    // 숨겨진 두 개의 input(type=file)에 이벤트 리스너 연결
    if (photoInput) {
        photoInput.addEventListener('change', handleFileSelect);
    }
    if (cameraInput) {
        // 이 부분은 모바일에서 '카메라로 촬영'이 실패했을 때의 폴백(fallback)으로 작동합니다.
        cameraInput.addEventListener('change', handleFileSelect);
    }

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

    // 폼 컨테이너에 통합 이벤트 리스너 추가 (기존과 동일)
    const formContainer = document.getElementById('form-container');
    if (formContainer) {
        formContainer.addEventListener('submit', (event) => {
            if (event.target && event.target.id === 'cabinet-creation-form') {
                createCabinet(event);
            } else if (event.target && event.target.id === 'inventory-form') {
                importData(event);
            }
        });
    }
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

    // 초기 옵션 설정
    areaSelect.innerHTML = '<option value="" class="placeholder" selected>-- 선택 안 함 --</option>';
    areas.forEach(area => {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.name;
        areaSelect.appendChild(option);
    });

    // ⬇️ [새로운 코드 추가] 드롭다운 메뉴를 열고 닫을 때의 이벤트 처리
    const placeholderOption = areaSelect.querySelector('.placeholder');

    // 메뉴를 열 때(mousedown): '-- 선택 안 함 --' 숨기기
    areaSelect.addEventListener('mousedown', () => {
        placeholderOption.style.display = 'none';
    });

    // 선택을 변경했을 때(change): '-- 선택 안 함 --' 다시 표시
    areaSelect.addEventListener('change', (event) => {
        handleAreaSelect(event.target.value);
        placeholderOption.style.display = 'block';
    });
    
    // 포커스가 해제됐을 때(blur): '-- 선택 안 함 --' 다시 표시
    areaSelect.addEventListener('blur', () => {
        placeholderOption.style.display = 'block';
    });
}

/**
 * 2단계: 수납함(Cabinet) 드롭다운 업데이트 및 3~6단계 초기화
 */
function handleAreaSelect(areaIdStr) {
    const areaId = areaIdStr ? parseInt(areaIdStr, 10) : null;
    locationSelections.location_area = areaId ? (allAreas.find(a => a.id === areaId)?.name || null) : null;
    selectedCabinetId = null;
    
    const cabinetSelect = document.getElementById('location_cabinet_select');
    if (!cabinetSelect) return;
    
    // '선택 안 함' 옵션에 클래스 추가
    cabinetSelect.innerHTML = '<option value="" class="placeholder" selected>-- 선택 안 함 --</option>';
    cabinetSelect.disabled = !areaId;
    
    if (areaId) {
        const filteredCabinets = allCabinets.filter(c => c.area_id === areaId);
        filteredCabinets.forEach(cabinet => {
            const option = document.createElement('option');
            option.value = cabinet.id;
            option.setAttribute('data-cabinet-info', JSON.stringify(cabinet)); 
            option.textContent = cabinet.name;
            cabinetSelect.appendChild(option);
        });
    }

    // ⬇️ [새로운 코드 추가] '수납함' 드롭다운에도 동일한 효과 적용
    const placeholderOption = cabinetSelect.querySelector('.placeholder');

    cabinetSelect.addEventListener('mousedown', () => {
        if (placeholderOption) placeholderOption.style.display = 'none';
    });
    
    cabinetSelect.addEventListener('blur', () => {
        if (placeholderOption) placeholderOption.style.display = 'block';
    });

    cabinetSelect.onchange = (event) => {
        const selectedOption = event.target.options[event.target.selectedIndex];
        const cabinetInfo = selectedOption.value ? JSON.parse(selectedOption.getAttribute('data-cabinet-info')) : null;
        
        handleCabinetSelect(event.target.value, cabinetInfo);
        
        // 선택 후에도 플레이스홀더가 다시 보이도록 처리
        if (placeholderOption) placeholderOption.style.display = 'block';
    };
    
    clearLocationSteps();
}

/**
 * 3~6단계: 선택된 Cabinet 기반으로 버튼 그룹 동적 생성
 */
function handleCabinetSelect(cabinetIdStr, cabinetInfo) {
    selectedCabinetId = parseInt(cabinetIdStr, 10);
    locationSelections.cabinet_id = selectedCabinetId;
    
    clearLocationSteps();
    if (!selectedCabinetId) return;

    // ⬇️ [수정됨] 1. 3단계 (상/중/하 도어 분할 수) 버튼 생성 로직
    generateLocationButtons(
        'location_door_vertical_group', 
        cabinetInfo.door_vertical_count, 
        'door_vertical',
        (value, count) => `${count - value + 1}층` // '3층, 2층, 1층' 순서로 표시
    );
    
    // ⬇️ [수정됨] 2. 4단계 (좌/우 분할 수) 버튼 생성 로직
    generateLocationButtons(
        'location_door_horizontal_group', 
        cabinetInfo.door_horizontal_count, 
        'door_horizontal',
        (value, count) => {
            if (count === 1) return '문';
            if (value === 1) return '좌측문';
            if (value === 2) return '우측문';
            return `${value}번째 문`; // 예외 처리
        }
    );

    // 3. 5단계 (도어당 선반 층수) 버튼 생성
    generateLocationButtons(
        'location_internal_shelf_group', 
        cabinetInfo.shelf_height, 
        'internal_shelf_level',
        (value) => `${value}단` // 기존 방식 유지
    );

    // 4. 6단계 (도어 내부 보관 열 수) 버튼 생성
    generateLocationButtons(
        'location_storage_column_group', 
        cabinetInfo.storage_columns, 
        'storage_columns',
        (value) => `${value}열` // 기존 방식 유지
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
    locationSelections.storage_columns = null;

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
        button.className = 'btn-location';
        button.setAttribute('data-value', value);
        button.textContent = nameFormatter(value, count);

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

    // 전역 변수 업데이트를 위한 헬퍼 함수
    const updateGlobalVariable = (variableName, value) => {
        switch (variableName) {
            case 'classification_buttons': selectedClassification = value; break;
            case 'state_buttons': selectedState = value; break;
            case 'unit_buttons': selectedUnit = value; break;
            case 'concentration_unit_buttons': selectedConcentrationUnit = value; break;
            case 'manufacturer_buttons': selectedManufacturer = value; break;
            case 'location_type_buttons': selectedAreaCreation = value; break;
            case 'cabinet_name_buttons': selectedCabinetName = value; break;
            case 'door_vertical_split_buttons': selectedDoorVerticalSplit = value; break;
            case 'door_horizontal_split_buttons': selectedDoorHorizontalSplit = value; break;
            case 'shelf_height_buttons': selectedShelfHeight = value; break;
            case 'storage_columns_buttons': selectedStorageColumns = value; break;
        }
    };

    group.addEventListener('click', (event) => {
        const targetButton = event.target.closest('button');
        if (targetButton) {
            const value = targetButton.getAttribute('data-value');
            const isActive = targetButton.classList.contains('active');

            // 먼저 그룹 내 모든 버튼의 'active' 상태를 해제합니다.
            group.querySelectorAll('.active').forEach(btn => {
                btn.classList.remove('active');
            });

            if (isActive) {
                // 만약 클릭한 버튼이 이미 활성화 상태였다면, 선택을 취소합니다.
                // (active 클래스는 위에서 이미 제거되었으므로 변수 값만 null로 바꿉니다.)
                updateGlobalVariable(groupId, null);
            } else {
                // 만약 비활성화 상태였다면, 해당 버튼을 활성화하고 변수 값을 업데이트합니다.
                targetButton.classList.add('active');
                updateGlobalVariable(groupId, value);
            }
        }
    });

    // 초기값 설정 (기존과 동일)
    if (initialValue) {
        const initialButton = group.querySelector(`button[data-value="${initialValue}"]`);
        if (initialButton) {
            initialButton.classList.add('active');
            updateGlobalVariable(groupId, initialValue); // 초기값 설정 시 변수도 업데이트
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

    // 🔑 2. 메뉴 항목(menu-item)에 클릭 이벤트 연결 로직 추가
    const menuItems = startMenu.querySelectorAll('.menu-item');

    menuItems.forEach(item => {
        item.addEventListener('click', (event) => {
            event.preventDefault(); // 기본 링크 동작 방지
            startMenu.classList.remove('visible'); // 팝업 닫기

            const itemText = event.target.textContent.trim();

            if (itemText === '시약장 설정') {
                // 🚨 '시약장 설정' 링크 클릭 시, 시약장 목록 페이지를 로드합니다.
                includeHTML('pages/location-list.html', 'form-container', setupLocationList);
            }
            // Add logic for other menu items here (e.g., 교구/물품 설정)

        });
    });

    // 3. 팝업 외부 닫힘 이벤트 로직 (Window에 연결)
    globalThis.addEventListener('click', (event) => {
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

async function importData(event) {
    if (event) {
        event.preventDefault();
    }

    const submitButton = document.getElementById('inventory-submit-button');
    if (!statusMessage || !submitButton) {
        console.error("Status message or submit button not found!");
        return;
    }

    // 1. CAS 번호 유효성 검사
    const casRn = document.getElementById('cas_rn').value.trim();
    if (!casRn) {
        statusMessage.textContent = 'CAS 번호를 입력해 주세요.';
        statusMessage.style.color = 'red';
        return;
    }

    // 2. 나머지 (선택 사항) 데이터 수집
    const purchaseVolumeStr = document.getElementById('purchase_volume').value;
    const concentrationValueStr = document.getElementById('concentration_value').value;
    const manufacturerOther = manufacturerOtherInput ? manufacturerOtherInput.value.trim() : '';
    const purchaseDate = document.getElementById('purchase_date').value;

    const purchaseVolume = parseFloat(purchaseVolumeStr);
    const concentrationValue = parseFloat(concentrationValueStr);

    let finalManufacturer = null;
    if (selectedManufacturer === '기타') {
        finalManufacturer = manufacturerOther || null;
    } else {
        finalManufacturer = selectedManufacturer;
    }

    const finalClassification = selectedClassification || '미분류';

    // 3. 서버로 전송할 최종 데이터 구성
    const inventoryData = {
        casRns: [casRn],
        inventoryDetails: {
            concentration_value: isNaN(concentrationValue) ? null : concentrationValue,
            concentration_unit: selectedConcentrationUnit || null,
            purchase_volume: isNaN(purchaseVolume) ? null : purchaseVolume,
            current_amount: isNaN(purchaseVolume) ? null : purchaseVolume, // current_amount는 purchase_volume과 동일하게 설정
            unit: selectedUnit || null,
            state: selectedState || null,
            manufacturer: finalManufacturer,
            purchase_date: purchaseDate || null,
            classification: finalClassification,
            
            // 보관 위치 정보 (선택 사항)
            cabinet_id: locationSelections.cabinet_id,
            location_area: locationSelections.location_area,
            door_vertical: locationSelections.door_vertical,
            door_horizontal: locationSelections.door_horizontal,
            internal_shelf_level: locationSelections.internal_shelf_level,
            storage_columns: locationSelections.storage_columns,
            
            // ⬇️ [수정됨] 두 가지 사이즈의 이미지 Base64 데이터 추가
            photo_320_base64: selectedPhoto_320_Base64,
            photo_160_base64: selectedPhoto_160_Base64,
            
            location: 'Initial Check-in',
        }
    };

    try {
        submitButton.disabled = true;
        submitButton.textContent = '저장 중...';
        statusMessage.textContent = '데이터를 처리 중입니다...';
        statusMessage.style.color = 'blue';

        // 4. Supabase Edge Function 호출
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

        // ⬇️ [수정됨] 5. 성공 응답을 팝업으로 표시
        const result = data[0];
        let msg = '';
        if (result.isNewSubstance) {
            msg = `✅ 신규 물질(${casRn}) 정보 및 시약병 등록 완료!`;
        } else {
            msg = `✅ 기존 물질(${casRn})에 새 시약병 등록 완료!`;
        }
        alert(msg); // 팝업으로 메시지 표시
        statusMessage.textContent = ''; // 기존 상태 메시지는 지움

        document.getElementById('inventory-form').reset();
        photoPreview.innerHTML = '<span>사진 없음</span>'; // 미리보기 초기화
        selectedPhoto_320_Base64 = null; // 변수 초기화
        selectedPhoto_160_Base64 = null; // 변수 초기화
        document.querySelectorAll('.button-group .active').forEach(button => {
            button.classList.remove('active');
        });

    } catch (error) {
        console.error("데이터 전송 중 오류 발생:", error);
        // ⬇️ [수정됨] 오류 메시지를 팝업으로 표시
        alert(`❌ 오류: 데이터 처리 실패.\n\n(${error.message})`);
        statusMessage.textContent = ''; // 기존 상태 메시지는 지움

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '약품 입고 내역 저장';
    }
}

// =================================================================
// 6. 페이지 진입점 (최종 실행 시작)
// =================================================================

globalThis.addEventListener('DOMContentLoaded', () => {
    // 1. form-input.html 로드: 완료 후 initializeFormListeners 콜백으로 실행
    includeHTML('pages/form-input.html', 'form-container', initializeFormListeners);

    // 2. navbar.html 로드: 완료 후 navbar 이벤트 설정을 콜백으로 실행
    includeHTML('pages/navbar.html', 'navbar-container', setupNavbarListeners);
});

// =================================================================
// 8. 시약장 등록 폼 로드 함수
// =================================================================

/**
 * 플로팅 액션 버튼(FAB) 클릭 시 새 캐비닛 등록 폼을 로드합니다.
 */

// deno-lint-ignore no-unused-vars
function showNewCabinetForm() {
    console.log("새 캐비닛 등록 폼 로드 시작...");

    setFabVisibility(false);

    // 새로운 HTML 조각 파일 로드
    includeHTML('pages/cabinet-form.html', 'form-container', setupCabinetRegisterForm);
}

/**
 * 새 캐비닛 등록 폼 로드 후 실행될 콜백 함수
 */
function setupCabinetRegisterForm() {
    console.log("새 캐비닛 등록 폼 로드 완료.");
    setFabVisibility(false);

    // 📌 전역 변수 재할당: 동적으로 로드된 요소를 찾습니다.
    //const form = document.getElementById('cabinet-creation-form');

    otherAreaInput = document.getElementById('other_area_input');
    otherCabinetInput = document.getElementById('other_cabinet_input');

    // 시약장 사진 관련 요소 초기화
    const photoInput = document.getElementById('cabinet-photo-input');
    const cameraInput = document.getElementById('cabinet-camera-input');
    const photoPreview = document.getElementById('cabinet-photo-preview');
    const cameraBtn = document.getElementById('cabinet-camera-btn');
    const photoBtn = document.getElementById('cabinet-photo-btn');

    if (cameraBtn && cameraInput) {
        cameraBtn.addEventListener('click', () => cameraInput.click());
    }
    if (photoBtn && photoInput) {
        photoBtn.addEventListener('click', () => photoInput.click());
    }

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            processImage(e.target.result, (resizedImages) => {
                selectedCabinetPhoto_320_Base64 = resizedImages.base64_320;
                selectedCabinetPhoto_160_Base64 = resizedImages.base64_160;
                photoPreview.innerHTML = `<img src="${resizedImages.base64_320}" alt="Cabinet photo preview">`;
            });
        };
        reader.readAsDataURL(file);
    };

    if (photoInput) {
        photoInput.addEventListener('change', handleFileSelect);
    }
    if (cameraInput) {
        cameraInput.addEventListener('change', handleFileSelect);
    }

    // --- 1. 모든 버튼 그룹 초기화 ---
    setupButtonGroup('location_type_buttons');
    setupButtonGroup('cabinet_name_buttons');
    setupButtonGroup('door_vertical_split_buttons');
    setupButtonGroup('door_horizontal_split_buttons');
    setupButtonGroup('shelf_height_buttons');
    setupButtonGroup('storage_columns_buttons');

    // --- 2. '기타' 입력란 조건부 표시 로직 연결 ---
    attachOtherInputLogic('location_type_buttons', 'other_area_group', 'other_area_input');
    attachOtherInputLogic('cabinet_name_buttons', 'other_cabinet_group', 'other_cabinet_input');

    // --- 3. 폼 제출 이벤트 연결 ---
    //form.addEventListener('submit', createCabinet);
}

// --- 4. 폼 제출 함수 ---
async function createCabinet(event) {
    if (event) {
        event.preventDefault();
    }

    const submitButton = document.getElementById('cabinet-submit-button');
    if (!submitButton || !statusMessage || !otherAreaInput || !otherCabinetInput) {
        alert("시스템 오류: 폼 초기화가 완료되지 않았습니다. 페이지를 새로고침하세요.");
        return;
    }

    // 1. 최종 이름 결정 및 유효성 검사
    const areaName = selectedAreaCreation === '기타' ?
        (otherAreaInput?.value?.trim() || null) :
        (selectedAreaCreation || null);

    const cabinetName = selectedCabinetName === '기타' ?
        (otherCabinetInput?.value?.trim() || null) :
        (selectedCabinetName || null);

    if (areaName === null || cabinetName === null ||
        selectedDoorVerticalSplit === null ||
        selectedShelfHeight === null ||
        selectedStorageColumns === null ||
        selectedDoorHorizontalSplit === null) {
        alert("모든 필수 필드(*)를 선택/입력해 주세요. (기타 입력란 포함)");
        return;
    }

    statusMessage.textContent = '시약장 등록을 시도 중...';
    statusMessage.style.color = 'blue';

    // ⬇️ [수정됨] 2. 텍스트 값을 올바른 숫자로 변환하는 로직
    let doorVerticalCountValue = 1; // 기본값
    if (selectedDoorVerticalSplit === '상중하도어') {
        doorVerticalCountValue = 3;
    } else if (selectedDoorVerticalSplit === '상하도어') {
        doorVerticalCountValue = 2;
    }

    const doorHorizontalCountValue = (selectedDoorHorizontalSplit === '좌우분리도어') ? 2 : 1;
    const shelfHeightValue = parseInt(selectedShelfHeight, 10) || 3;
    const storageColumnsValue = parseInt(selectedStorageColumns, 10) || 1;

    // 3. 서버 전송 데이터 구성
    const cabinetData = {
        area_name: areaName,
        cabinet_name: cabinetName,
        door_vertical_count: doorVerticalCountValue,
        door_horizontal_count: doorHorizontalCountValue,
        shelf_height: shelfHeightValue,
        storage_columns: storageColumnsValue,
        photo_320_base64: selectedCabinetPhoto_320_Base64,
        photo_160_base64: selectedCabinetPhoto_160_Base64,
    };

    const CABINET_REG_URL = `${SUPABASE_URL}/functions/v1/cabinet-register`;

    try {
        submitButton.disabled = true;
        submitButton.textContent = '등록 중...';

        const response = await fetch(CABINET_REG_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify(cabinetData)
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || `HTTP Error! Status: ${response.status}`);
        }

        const newCabinetName = data.cabinetName || cabinetName;
        console.log("✅ 시약장 등록 성공:", data);
        alert(`✅ 시약장 "${newCabinetName}"이(가) 성공적으로 등록되었습니다.`);
        selectedCabinetPhoto_320_Base64 = null;
        selectedCabinetPhoto_160_Base64 = null;
        loadLocationListPage();

    } catch (error) {
        console.error("시약장 등록 중 오류 발생:", error.message);
        alert(`❌ 등록 실패: ${error.message}`);
        statusMessage.textContent = `❌ 등록 실패: ${error.message.substring(0, 50)}...`;

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '시약장 등록';
    }
}

function attachOtherInputLogic(buttonGroupId, otherGroupId, targetInputId) {
    const group = document.getElementById(buttonGroupId);
    const otherGroup = document.getElementById(otherGroupId);
    const otherInput = document.getElementById(targetInputId);

    if (!group || !otherGroup || !otherInput) return;

    group.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            const value = event.target.getAttribute('data-value');
            if (value === '기타') {
                otherGroup.style.display = 'block';
                otherInput.setAttribute('required', 'required');
            } else {
                otherGroup.style.display = 'none';
                otherInput.removeAttribute('required');
                otherInput.value = '';
            }
        }
    });
}

function loadLocationListPage() {
    console.log("목록 페이지로 복귀 및 데이터 새로고침 시작.");
    setFabVisibility(true);
    includeHTML('pages/location-list.html', 'form-container', fetchCabinetListAndRender);
}

function setupLocationList() {
    // 이제 이 함수는 직접 불리지 않고, fetchCabinetListAndRender가 직접 콜백으로 사용됩니다.
    // 혼란을 방지하기 위해 내용을 비워두거나, fetchCabinetListAndRender를 호출하도록 유지할 수 있습니다.
    setFabVisibility(true);
    console.log("시약장 목록 페이지 로드 완료. 데이터 로드 시작.");
    fetchCabinetListAndRender();
}

/**
 * Edge Function에 GET 요청을 보내 Cabinet 목록을 조회하고 렌더링합니다.
 */
async function fetchCabinetListAndRender() {
    const listContainer = document.getElementById('cabinet-list-container');
    const statusMsg = document.getElementById('status-message-list');
    
    if (!listContainer || !statusMsg) return;

    statusMsg.textContent = '등록된 보관장소를 불러오는 중...';
    statusMsg.style.color = 'blue';

    try {
        // GET 요청은 casimport 함수를 그대로 사용합니다.
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '시약장 목록 데이터 조회 실패');
        }
        
        allAreas = data.areas || [];
        const cabinets = data.cabinets || [];
        
        if (cabinets.length === 0) {
            listContainer.innerHTML = `<div style="text-align: center; padding: 50px 20px; color: #888;"><h4>등록된 보관장소가 없습니다.</h4><p style="margin-top: 15px;">'새 시약장 등록' 버튼을 눌러 첫 번째 시약장을 등록해 주세요.</p></div>`;
            return;
        }

        renderCabinetCards(cabinets, listContainer);
        statusMsg.textContent = `✅ 시약장 목록 ${cabinets.length}개 로드 완료`;
        statusMsg.style.color = 'green';

    } catch (error) {
        console.error("시약장 목록 로드 중 오류 발생:", error);
        statusMsg.textContent = `❌ 시약장 목록 로드 오류: ${error.message}`;
        statusMsg.style.color = 'red';
    }

    // ⬇️ [수정] 한 번만 등록되도록 이벤트 리스너를 새로고침 로직 안에 배치합니다.
    // 기존 리스너가 있다면 제거하고 새로 추가하여 중복을 방지합니다.
    const newContainer = listContainer.cloneNode(true);
    listContainer.parentNode.replaceChild(newContainer, listContainer);

    newContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const cabinetId = event.target.dataset.id;
            handleDeleteCabinet(cabinetId);
        }
    });
}

/**
 * 목록 데이터를 기반으로 화면에 카드 UI를 생성하는 함수
 */
function renderCabinetCards(cabinets, container) {
    container.innerHTML = ''; 

    cabinets.forEach(cabinet => {
        const areaName = allAreas.find(a => a.id === cabinet.area_id)?.name || '알 수 없음';
        
        // ⬇️ [새로운 코드] 숫자 코드를 텍스트 설명으로 변환합니다.
        let verticalDoorText = '단일도어';
        if (cabinet.door_vertical_count === 3) {
            verticalDoorText = '상중하도어';
        } else if (cabinet.door_vertical_count === 2) {
            verticalDoorText = '상하도어';
        }

        const horizontalDoorText = cabinet.door_horizontal_count === 2 ? '좌우분리도어' : '단일도어';
        
        const card = document.createElement('div');
        card.className = 'cabinet-card';
        card.setAttribute('data-cabinet-id', cabinet.id);
        
        // ⬇️ [수정됨] 새로운 정보를 포함하도록 card.innerHTML을 업데이트합니다.
        card.innerHTML = `
            <div class="card-image-placeholder">
                [${cabinet.name} 사진]
            </div>
            <div class="card-info">
                <h3>${cabinet.name}</h3>
                <p class="area-name">${areaName}</p>
                <p class="cabinet-specs">${verticalDoorText}, ${horizontalDoorText}</p>
                <p class="cabinet-specs">(${cabinet.shelf_height}단, ${cabinet.storage_columns}열)</p>
            </div>
            <div class="card-actions">
                <button class="delete-btn" data-id="${cabinet.id}">삭제</button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

/**
 * ⬇️ [새로운 함수 추가] 캐비닛 삭제를 처리하는 함수
 */
async function handleDeleteCabinet(cabinetId) {
    if (!confirm(`정말로 이 시약장을 삭제하시겠습니까?\nID: ${cabinetId}`)) {
        return;
    }

    // cabinet-register 함수 URL 정의
    const CABINET_REG_URL = `${SUPABASE_URL}/functions/v1/cabinet-register`;

    try {
        const response = await fetch(`${CABINET_REG_URL}?id=${cabinetId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || '삭제에 실패했습니다.');
        }

        const cardToRemove = document.querySelector(`.cabinet-card[data-cabinet-id="${cabinetId}"]`);
        if (cardToRemove) {
            cardToRemove.remove();
        }
        alert('성공적으로 삭제되었습니다.');

    } catch (error) {
        console.error('삭제 처리 중 오류 발생:', error);
        alert(`삭제 실패: ${error.message}`);
    }
}

function setFabVisibility(visible) {
    const fab = document.querySelector('.fab');
    if (fab) {
        if (visible) {
            fab.style.display = 'block';
        } else {
            fab.style.display = 'none';
        }
    }
}

/**
 * 카메라를 시작하고 모달을 표시하는 함수
 */
async function startCamera() {
    const cameraModal = document.getElementById('camera-modal');
    const cameraView = document.getElementById('camera-view');

    // 미디어 API 지원 여부 확인
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('お使いのブラウザではカメラ機能を利用できません。');
        return;
    }

    try {
        // 사용자에게 카메라 사용 권한 요청
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, // 후면 카메라 우선
            audio: false 
        });

        // <video> 요소에 카메라 스트림 연결
        cameraView.srcObject = cameraStream;
        cameraModal.style.display = 'flex'; // 모달 보이기

    } catch (err) {
        console.error("카메라 접근 오류:", err);
        alert("카메라를 시작할 수 없습니다. 카메라 접근 권한을 확인해주세요.");
    }
}

/**
 * 카메라 스트림을 중지하고 모달을 닫는 함수
 */
function stopCamera() {
    const cameraModal = document.getElementById('camera-modal');
    if (cameraStream) {
        // 모든 비디오 트랙을 중지하여 카메라 끄기
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    cameraModal.style.display = 'none'; // 모달 숨기기
}

/**
 * 비디오 화면을 캡처하여 처리하는 함수
 */
function takePicture() {
    const cameraView = document.getElementById('camera-view');
    const canvas = document.getElementById('photo-canvas');
    
    // 캔버스 크기를 비디오 크기에 맞춤
    canvas.width = cameraView.videoWidth;
    canvas.height = cameraView.videoHeight;
    
    // 캔버스에 현재 비디오 프레임 그리기
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cameraView, 0, 0, canvas.width, canvas.height);
    
    // 캔버스에서 Base64 데이터 추출
    const base64Str = canvas.toDataURL('image/png');

    // 기존 리사이징 함수 호출
    processImage(base64Str, (resizedImages) => {
        selectedPhoto_320_Base64 = resizedImages.base64_320;
        selectedPhoto_160_Base64 = resizedImages.base64_160;
        photoPreview.innerHTML = `<img src="${resizedImages.base64_320}" alt="Photo preview">`;
    });

    // 사진 찍은 후 카메라 끄고 모달 닫기
    stopCamera();
}

/**
 * 이미지를 비율에 맞게 캔버스 중앙에 그리고 Base64로 반환하는 헬퍼 함수
 */
function resizeToFit(img, targetSize) {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    // 캔버스 배경을 투명하게 채웁니다.
    ctx.clearRect(0, 0, targetSize, targetSize); 

    const aspectRatio = img.width / img.height;
    
    let drawWidth = targetSize;
    let drawHeight = targetSize;

    // 이미지의 가로가 더 긴 경우 (가로 기준 리사이징)
    if (aspectRatio > 1) {
        drawHeight = targetSize / aspectRatio;
    } 
    // 이미지의 세로가 더 길거나 같은 경우 (세로 기준 리사이징)
    else {
        drawWidth = targetSize * aspectRatio;
    }

    // 캔버스 중앙에 이미지를 위치시키기 위한 좌표 계산
    const xOffset = (targetSize - drawWidth) / 2;
    const yOffset = (targetSize - drawHeight) / 2;
    
    // 캔버스에 비율이 유지된 이미지 그리기
    ctx.drawImage(img, xOffset, yOffset, drawWidth, drawHeight);
    
    return canvas.toDataURL('image/png');
}

/**
 * 이미지를 320px, 160px 두 가지 버전으로 처리하는 메인 함수
 */
function processImage(base64Str, callback) {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
        const resized_320 = resizeToFit(img, 320);
        const resized_160 = resizeToFit(img, 160);
        
        callback({
            base64_320: resized_320,
            base64_160: resized_160
        });
    };
}