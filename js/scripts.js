// =================================================================
// 0. 전역 변수 및 설정
// =================================================================

// 🚨 Supabase 및 Edge Function 설정
const SUPABASE_URL = "https://muprmzkvrjacqatqxayf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cHJtemt2cmphY3FhdHF4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjYwNzAsImV4cCI6MjA3NTEwMjA3MH0.K2MO-l6QG5nztCPlT3_zqYOrMt-bqM-O5ZYLQpV1L9Y";
const FUNCTION_NAME = "casimport";
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// 🔑 버튼 그룹의 선택 값을 저장할 전역 변수
let selectedClassification = null;
let selectedState = null;
let selectedUnit = null;
let selectedConcentrationUnit = null;
let selectedManufacturer = null;

// 🔑 수납위치 관련 전역 변수
let allAreas = [];
let allCabinets = [];
// 🔑 시약장 등록/수정 폼 전용 선택 값
let selectedAreaCreation = null;
let selectedCabinetName = null;
let selectedDoorVerticalSplit = null;
let selectedDoorHorizontalSplit = null;
let selectedShelfHeight = null;
let selectedStorageColumns = null;
let isEditMode = false; // 수정 모드 여부
let editingCabinetId = null; // 수정 중인 시약장 ID

// 🔑 기타 입력란 DOM 요소
let otherAreaInput = null;
let otherCabinetInput = null;

// 6단계 위치 선택 값을 저장할 객체
const locationSelections = {
    cabinet_id: null,
    door_vertical: null,
    door_horizontal: null,
    internal_shelf_level: null,
    storage_columns: null,
    location_area: null
};

// 전역에서 접근해야 하는 HTML 요소들
let statusMessage = null;
let manufacturerButtonsGroup = null;
let otherManufacturerGroup = null;
let manufacturerOtherInput = null;

// 사진 관련 전역 변수
let photoInput = null;
let cameraInput = null;
let photoPreview = null;
let selectedPhoto_320_Base64 = null;
let selectedPhoto_160_Base64 = null;
let selectedCabinetPhoto_320_Base64 = null;
let selectedCabinetPhoto_160_Base64 = null;
let cameraStream = null;

// (수정 기능 추가 시 `editingInventoryId`도 여기에 추가됩니다)

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
// 2. 폼 요소 초기화 로직
// =================================================================

function initializeFormListeners() {
    console.log("폼 요소 초기화 시작...");
    setFabVisibility(false);

    statusMessage = document.getElementById('statusMessage');
    manufacturerButtonsGroup = document.getElementById('manufacturer_buttons');
    otherManufacturerGroup = document.getElementById('other_manufacturer_group');
    manufacturerOtherInput = document.getElementById('manufacturer_other');

    photoInput = document.getElementById('photo-input');
    cameraInput = document.getElementById('camera-input');
    photoPreview = document.getElementById('photo-preview');
    const cameraBtn = document.getElementById('camera-btn');
    const photoBtn = document.getElementById('photo-btn');

    if (photoBtn && photoInput) {
        photoBtn.addEventListener('click', () => photoInput.click());
    }
    if (cameraBtn) {
        cameraBtn.addEventListener('click', startCamera);
    }

    setupCameraModalListeners();

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            processImage(e.target.result, (resizedImages) => {
                selectedPhoto_320_Base64 = resizedImages.base64_320;
                selectedPhoto_160_Base64 = resizedImages.base64_160;
                if (photoPreview) {
                    photoPreview.innerHTML = `<img src="${resizedImages.base64_320}" alt="Photo preview">`;
                }
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

    setupButtonGroup('classification_buttons');
    setupButtonGroup('state_buttons');
    setupButtonGroup('unit_buttons');
    setupButtonGroup('concentration_unit_buttons');
    setupButtonGroup('manufacturer_buttons');

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

    fetchLocationData();
    console.log("폼 요소 초기화 완료.");

    // 통합 폼 제출 이벤트 리스너
    const formContainer = document.getElementById('form-container');
    if (formContainer) {
        formContainer.addEventListener('submit', (event) => {
            if (event.target && event.target.id === 'cabinet-creation-form') {
                // 수정 모드인지 확인하여 적절한 함수 호출
                if (isEditMode) {
                    updateCabinet(event);
                } else {
                    createCabinet(event);
                }
            } else if (event.target && event.target.id === 'inventory-form') {
                // (나중에 재고 수정 기능 추가 시 여기도 isEditMode 확인 로직 추가)
                importData(event);
            }
        });
    }
}

async function fetchLocationData() {
    try {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '장소 데이터 조회 실패');
        
        allAreas = data.areas || [];
        allCabinets = data.cabinets || [];
        // populateAreaSelect는 form-input.html에만 존재하므로 여기서 호출
        if(document.getElementById('location_area_select')) {
            populateAreaSelect(allAreas);
        }
    } catch (error) {
        console.error("장소 데이터 로드 중 오류 발생:", error);
        if (statusMessage) {
            statusMessage.textContent = `❌ 장소 정보 로드 오류: ${error.message}`;
            statusMessage.style.color = 'red';
        }
    }
}

function populateAreaSelect(areas) {
    const areaSelect = document.getElementById('location_area_select');
    if (!areaSelect) return;

    areaSelect.innerHTML = '<option value="" class="placeholder" selected>-- 선택 안 함 --</option>';
    areas.forEach(area => {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.name;
        areaSelect.appendChild(option);
    });

    const placeholderOption = areaSelect.querySelector('.placeholder');
    areaSelect.addEventListener('mousedown', () => {
        if (placeholderOption) placeholderOption.style.display = 'none';
    });
    areaSelect.addEventListener('change', (event) => {
        handleAreaSelect(event.target.value);
        if (placeholderOption) placeholderOption.style.display = 'block';
    });
    areaSelect.addEventListener('blur', () => {
        if (placeholderOption) placeholderOption.style.display = 'block';
    });
}

function handleAreaSelect(areaIdStr) {
    const areaId = areaIdStr ? parseInt(areaIdStr, 10) : null;
    locationSelections.location_area = areaId ? (allAreas.find(a => a.id === areaId)?.name || null) : null;
    
    const cabinetSelect = document.getElementById('location_cabinet_select');
    if (!cabinetSelect) return;
    
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
        if (placeholderOption) placeholderOption.style.display = 'block';
    };
    
    clearLocationSteps();
}

function handleCabinetSelect(cabinetIdStr, cabinetInfo) {
    const cabinetId = cabinetIdStr ? parseInt(cabinetIdStr, 10) : null;
    locationSelections.cabinet_id = cabinetId;
    
    clearLocationSteps();
    if (!cabinetId || !cabinetInfo) return;

    generateLocationButtons('location_door_vertical_group', cabinetInfo.door_vertical_count, 'door_vertical', (value, count) => `${count - value + 1}층`);
    generateLocationButtons('location_door_horizontal_group', cabinetInfo.door_horizontal_count, 'door_horizontal', (value, count) => count === 1 ? '문' : (value === 1 ? '좌측문' : '우측문'));
    generateLocationButtons('location_internal_shelf_group', cabinetInfo.shelf_height, 'internal_shelf_level', (value) => `${value}단`);
    generateLocationButtons('location_storage_column_group', cabinetInfo.storage_columns, 'storage_columns', (value) => `${value}열`);
}

function clearLocationSteps() {
    locationSelections.door_vertical = null;
    locationSelections.door_horizontal = null;
    locationSelections.internal_shelf_level = null;
    locationSelections.storage_columns = null;

    const containerIds = ['location_door_vertical_group', 'location_door_horizontal_group', 'location_internal_shelf_group', 'location_storage_column_group'];
    containerIds.forEach(id => {
        const container = document.getElementById(id);
        if (container) container.innerHTML = '<span style="color:#888;">수납함 선택 후 표시됩니다.</span>';
    });
}

function generateLocationButtons(containerId, count, dataKey, nameFormatter) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const value = i + 1;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-location';
        button.setAttribute('data-value', value);
        button.textContent = nameFormatter(value, count);
        
        button.addEventListener('click', () => {
            container.querySelectorAll('.active').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
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

            group.querySelectorAll('.active').forEach(btn => btn.classList.remove('active'));

            if (isActive) {
                updateGlobalVariable(groupId, null);
            } else {
                targetButton.classList.add('active');
                updateGlobalVariable(groupId, value);
            }
        }
    });

    if (initialValue) {
        const initialButton = group.querySelector(`button[data-value="${initialValue}"]`);
        if (initialButton) {
            initialButton.classList.add('active');
            updateGlobalVariable(groupId, initialValue);
        }
    }
}

// =================================================================
// 4. Navbar 이벤트 리스너 설정
// =================================================================
// [전체 코드로 교체]
function setupNavbarListeners() {
    // 1. 필요한 모든 네비게이션 요소를 가져옵니다.
    const startMenu = document.getElementById('start-menu');
    const startButton = document.querySelector('.start-button');
    const inventoryNav = document.getElementById('nav-inventory'); // '약품 관리' 탭

    if (!startMenu || !startButton || !inventoryNav) {
        console.error("네비게이션 요소를 찾을 수 없습니다. navbar.html의 id를 확인해주세요.");
        return;
    }

    // --- 하단 네비게이션 탭 이벤트 리스너 ---

    // '약품 관리' 탭 클릭 시 목록 페이지 로드
    inventoryNav.addEventListener('click', (event) => {
        event.preventDefault();
        loadInventoryListPage();
    });

    // --- 시작 메뉴(팝업) 이벤트 리스너 ---

    // 시작 메뉴(팝업)의 '홈' 버튼 클릭 시 메인 화면 로드 및 FAB 숨기기
    const homeMenuItem = startMenu.querySelector('.menu-item-home'); // '홈' 메뉴 아이템
    if (homeMenuItem) {
        homeMenuItem.addEventListener('click', (event) => {
            event.preventDefault();
            startMenu.classList.remove('visible');
            includeHTML('pages/main.html', 'form-container', () => {
                setFabVisibility(false);
            });
        });
    }

    // 시작 메뉴(햄버거 아이콘) 버튼 클릭 시 팝업 토글
    startButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        startMenu.classList.toggle('visible');
    });

    // 팝업 메뉴 안의 항목 클릭 시
    const menuItems = startMenu.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            startMenu.classList.remove('visible');
            const itemText = event.target.textContent.trim();

            if (itemText === '시약장 설정') {
                loadLocationListPage();
            } else if (itemText === '약품 관리') {
                loadInventoryListPage();
            } 
            // ⬇️ [수정됨] '홈' 메뉴 클릭 시 동작 변경
            else if (itemText === '홈') {
                // main.html 로드가 완료된 후, 콜백 함수를 실행하여 버튼을 숨깁니다.
                includeHTML('pages/main.html', 'form-container', () => {
                    setFabVisibility(false);
                });
            }
        });
    });

    // 팝업 메뉴 바깥쪽 클릭 시 닫기
    globalThis.addEventListener('click', (event) => {
        if (startMenu.classList.contains('visible') && !startMenu.contains(event.target) && !startButton.contains(event.target)) {
            startMenu.classList.remove('visible');
        }
    });
}

// =================================================================
// 5. 폼 제출 처리 함수
// =================================================================
async function importData(event) {
    if (event) event.preventDefault();

    const submitButton = document.getElementById('inventory-submit-button');
    if (!statusMessage || !submitButton) return;

    const casRn = document.getElementById('cas_rn').value.trim();
    if (!casRn) {
        statusMessage.textContent = 'CAS 번호를 입력해 주세요.';
        statusMessage.style.color = 'red';
        return;
    }

    const purchaseVolumeStr = document.getElementById('purchase_volume').value;
    const concentrationValueStr = document.getElementById('concentration_value').value;
    const manufacturerOther = manufacturerOtherInput ? manufacturerOtherInput.value.trim() : '';
    const purchaseDate = document.getElementById('purchase_date').value;

    const purchaseVolume = parseFloat(purchaseVolumeStr);
    const concentrationValue = parseFloat(concentrationValueStr);

    const finalManufacturer = selectedManufacturer === '기타' ? (manufacturerOther || null) : selectedManufacturer;
    const finalClassification = selectedClassification || '미분류';

    const inventoryData = {
        casRns: [casRn],
        inventoryDetails: {
            concentration_value: isNaN(concentrationValue) ? null : concentrationValue,
            concentration_unit: selectedConcentrationUnit || null,
            purchase_volume: isNaN(purchaseVolume) ? null : purchaseVolume,
            current_amount: isNaN(purchaseVolume) ? null : purchaseVolume,
            unit: selectedUnit || null,
            state: selectedState || null,
            manufacturer: finalManufacturer,
            purchase_date: purchaseDate || null,
            classification: finalClassification,
            cabinet_id: locationSelections.cabinet_id,
            location_area: locationSelections.location_area,
            door_vertical: locationSelections.door_vertical,
            door_horizontal: locationSelections.door_horizontal,
            internal_shelf_level: locationSelections.internal_shelf_level,
            storage_columns: locationSelections.storage_columns,
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

        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
            body: JSON.stringify(inventoryData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP Error! Status: ${response.status}`);
        if (!data || !Array.isArray(data) || data.length === 0) throw new Error("서버에서 유효한 응답을 받지 못했습니다.");

        const result = data[0];
        const msg = result.isNewSubstance ? `✅ 신규 물질(${casRn}) 정보 및 시약병 등록 완료!` : `✅ 기존 물질(${casRn})에 새 시약병 등록 완료!`;
        alert(msg);

        // ⬇️ [수정됨] 폼 초기화 대신 '약품 관리' 목록 화면으로 이동합니다.
        loadInventoryListPage();
    
    } catch (error) {
        console.error("데이터 전송 중 오류 발생:", error);
        alert(`❌ 오류: 데이터 처리 실패.\n\n(${error.message})`);
        statusMessage.textContent = '';
    } finally {
        if (document.getElementById('inventory-form')) { // 현재 폼이 아직 화면에 있다면
             submitButton.disabled = false;
             submitButton.textContent = '입고 약품 정보 저장';
        }
    }
}

// =================================================================
// 6. 페이지 진입점
// =================================================================
globalThis.addEventListener('DOMContentLoaded', () => {
// 1. 초기 화면을 main.html로 로드
    includeHTML('pages/main.html', 'form-container'); 
    
    // 2. 하단 네비게이션 바 로드 및 기능 연결
    includeHTML('pages/navbar.html', 'navbar-container', () => {
        // navbar.html 로드가 완료된 후, 버튼 기능 설정
        setupNavbarListeners();
        // 3. 앱이 처음 시작될 때 FAB 버튼을 숨김
        setFabVisibility(false);
    });
});

// =================================================================
// 7. 시약장 관련 함수
// =================================================================

// deno-lint-ignore no-unused-vars
function showNewCabinetForm() {
    console.log("새 시약장 등록 폼 로드 시작...");
    setFabVisibility(false);
    includeHTML('pages/cabinet-form.html', 'form-container', setupCabinetRegisterForm);
}

function setupCabinetRegisterForm() {
    console.log("시약장 폼 로드 완료. 모드:", isEditMode ? "수정" : "신규");
    setFabVisibility(false);

    otherAreaInput = document.getElementById('other_area_input');
    otherCabinetInput = document.getElementById('other_cabinet_input');

    setupButtonGroup('location_type_buttons');
    setupButtonGroup('cabinet_name_buttons');
    setupButtonGroup('door_vertical_split_buttons');
    setupButtonGroup('door_horizontal_split_buttons');
    setupButtonGroup('shelf_height_buttons');
    setupButtonGroup('storage_columns_buttons');
    
    attachOtherInputLogic('location_type_buttons', 'other_area_group', 'other_area_input'); 
    attachOtherInputLogic('cabinet_name_buttons', 'other_cabinet_group', 'other_cabinet_input');

    const photoInput = document.getElementById('cabinet-photo-input');
    const cameraInput = document.getElementById('cabinet-camera-input');
    const photoPreview = document.getElementById('cabinet-photo-preview');
    const cameraBtn = document.getElementById('cabinet-camera-btn');
    const photoBtn = document.getElementById('cabinet-photo-btn');
    const cancelButton = document.getElementById('cancel-form-btn');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            // isEditMode와 editingCabinetId를 초기화하여
            // 수정 모드 상태가 남지 않도록 합니다.
            isEditMode = false;
            editingCabinetId = null;
            loadLocationListPage();
        });
    }

    if (cameraBtn) cameraBtn.addEventListener('click', startCamera);
    if (photoBtn && photoInput) photoBtn.addEventListener('click', () => photoInput.click());
    
    setupCameraModalListeners();
    
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            processImage(e.target.result, (resizedImages) => {
                selectedCabinetPhoto_320_Base64 = resizedImages.base64_320;
                selectedCabinetPhoto_160_Base64 = resizedImages.base64_160;
                if (photoPreview) {
                  photoPreview.innerHTML = `<img src="${resizedImages.base64_320}" alt="Cabinet photo preview">`;
                }
            });
        };
        reader.readAsDataURL(file);
    };
    if (photoInput) photoInput.addEventListener('change', handleFileSelect);
    if (cameraInput) cameraInput.addEventListener('change', handleFileSelect);

    if (isEditMode && editingCabinetId) {
        document.querySelector('#cabinet-creation-form h2').textContent = '시약장 정보 수정';
        document.getElementById('cabinet-submit-button').textContent = '수정 내용 저장';

        const idToFind = parseInt(editingCabinetId, 10);
        const cabinetToEdit = allCabinets.find(c => c.id === idToFind);

        if (!cabinetToEdit) {
            alert("오류: 수정할 시약장 정보를 찾을 수 없습니다.");
            loadLocationListPage();
            return;
        }

        if (cabinetToEdit.photo_url_320 && photoPreview) {
            photoPreview.innerHTML = `<img src="${cabinetToEdit.photo_url_320}" alt="Cabinet photo preview">`;
        }

        const preselectButton = (groupId, value, otherInputId) => {
            const group = document.getElementById(groupId);
            if (!group || value == null) return;

            const button = group.querySelector(`button[data-value="${value}"]`);
            if (button) {
                button.click();
            } else {
                const otherButton = group.querySelector('button[data-value="기타"]');
                if (otherButton) otherButton.click();
                const otherInput = document.getElementById(otherInputId);
                if (otherInput) otherInput.value = value;
            }
        };

        const area = allAreas.find(a => a.id === cabinetToEdit.area_id);
        const areaName = area ? area.name : null;

        let verticalDoorValue = '단일도어';
        if (cabinetToEdit.door_vertical_count === 3) verticalDoorValue = '상중하도어';
        else if (cabinetToEdit.door_vertical_count === 2) verticalDoorValue = '상하도어';
        const horizontalDoorValue = cabinetToEdit.door_horizontal_count === 2 ? '좌우분리도어' : '단일도어';
        
        preselectButton('location_type_buttons', areaName, 'other_area_input');
        preselectButton('cabinet_name_buttons', cabinetToEdit.name, 'other_cabinet_input');
        preselectButton('door_vertical_split_buttons', verticalDoorValue);
        preselectButton('door_horizontal_split_buttons', horizontalDoorValue);
        preselectButton('shelf_height_buttons', cabinetToEdit.shelf_height.toString());
        preselectButton('storage_columns_buttons', cabinetToEdit.storage_columns.toString());
    } else {
        document.querySelector('#cabinet-creation-form h2').textContent = '시약장 등록';
        document.getElementById('cabinet-submit-button').textContent = '시약장 등록';
        selectedCabinetPhoto_320_Base64 = null;
        selectedCabinetPhoto_160_Base64 = null;
    }
}

async function createCabinet(event) {
    if (event) event.preventDefault();

    const submitButton = document.getElementById('cabinet-submit-button');
    if (!submitButton || !statusMessage || !otherAreaInput || !otherCabinetInput) {
        alert("시스템 오류: 폼 초기화가 완료되지 않았습니다.");
        return;
    }

    const areaName = selectedAreaCreation === '기타' ? (otherAreaInput?.value?.trim() || null) : selectedAreaCreation;
    const cabinetName = selectedCabinetName === '기타' ? (otherCabinetInput?.value?.trim() || null) : selectedCabinetName;

    if (!areaName || !cabinetName || !selectedDoorVerticalSplit || !selectedShelfHeight || !selectedStorageColumns || !selectedDoorHorizontalSplit) {
        alert("모든 필수 필드(*)를 선택/입력해 주세요.");
        return;
    }

    statusMessage.textContent = '시약장 등록을 시도 중...';
    statusMessage.style.color = 'blue';

    let doorVerticalCountValue = 1;
    if (selectedDoorVerticalSplit === '상중하도어') doorVerticalCountValue = 3;
    else if (selectedDoorVerticalSplit === '상하도어') doorVerticalCountValue = 2;

    const doorHorizontalCountValue = (selectedDoorHorizontalSplit === '좌우분리도어') ? 2 : 1;
    const shelfHeightValue = parseInt(selectedShelfHeight, 10) || 3;
    const storageColumnsValue = parseInt(selectedStorageColumns, 10) || 1;

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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
            body: JSON.stringify(cabinetData)
        });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || `HTTP Error! Status: ${response.status}`);

        const newCabinetName = data.cabinetName || cabinetName;
        console.log("✅ 시약장 등록 성공:", data);
        alert(`✅ 시약장 "${newCabinetName}"이(가) 성공적으로 등록되었습니다.`);
        selectedCabinetPhoto_320_Base64 = null;
        selectedCabinetPhoto_160_Base64 = null;
        loadLocationListPage();

    } catch (error) {
        console.error("시약장 등록 중 오류 발생:", error.message);
        alert(`❌ 등록 실패: ${error.message}`);
        if (statusMessage) statusMessage.textContent = `❌ 등록 실패: ${error.message.substring(0, 50)}...`;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '시약장 등록';
    }
}

async function updateCabinet(event) {
    if (event) event.preventDefault();

    const submitButton = document.getElementById('cabinet-submit-button');
    if (!submitButton || !statusMessage || !otherAreaInput || !otherCabinetInput) {
        alert("시스템 오류: 폼 초기화가 완료되지 않았습니다.");
        return;
    }

    const areaName = selectedAreaCreation === '기타' ? (otherAreaInput?.value?.trim() || null) : selectedAreaCreation;
    const cabinetName = selectedCabinetName === '기타' ? (otherCabinetInput?.value?.trim() || null) : selectedCabinetName;

    if (!areaName || !cabinetName || !selectedDoorVerticalSplit || !selectedShelfHeight || !selectedStorageColumns || !selectedDoorHorizontalSplit) {
        alert("모든 필수 필드(*)를 선택/입력해 주세요.");
        return;
    }

    statusMessage.textContent = '시약장 정보를 수정하는 중...';
    statusMessage.style.color = 'blue';

    let doorVerticalCountValue = 1;
    if (selectedDoorVerticalSplit === '상중하도어') doorVerticalCountValue = 3;
    else if (selectedDoorVerticalSplit === '상하도어') doorVerticalCountValue = 2;

    const doorHorizontalCountValue = (selectedDoorHorizontalSplit === '좌우분리도어') ? 2 : 1;
    const shelfHeightValue = parseInt(selectedShelfHeight, 10) || 3;
    const storageColumnsValue = parseInt(selectedStorageColumns, 10) || 1;

    const cabinetData = {
        cabinet_id: editingCabinetId,
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
        submitButton.textContent = '저장 중...';

        const response = await fetch(CABINET_REG_URL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
            body: JSON.stringify(cabinetData)
        });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || `HTTP Error! Status: ${response.status}`);

        console.log("✅ 시약장 수정 성공:", data);
        alert(`✅ 시약장 정보가 성공적으로 수정되었습니다.`);
        loadLocationListPage();

    } catch (error) {
        console.error("시약장 수정 중 오류 발생:", error.message);
        alert(`❌ 수정 실패: ${error.message}`);
        if (statusMessage) statusMessage.textContent = `❌ 수정 실패: ${error.message.substring(0, 50)}...`;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '수정 내용 저장';
        editingCabinetId = null;
        isEditMode = false;
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
    const fab = document.getElementById('fab-button');
    if (fab) {
        fab.textContent = '새 시약장 등록'; // 버튼 텍스트
        fab.onclick = showNewCabinetForm; // 버튼 기능
    }
    setFabVisibility(true); // 버튼 보이기
    includeHTML('pages/location-list.html', 'form-container', fetchCabinetListAndRender);
}

function setupLocationList() {
    setFabVisibility(true); // ⬅️ 이 화면에서만 버튼을 보이게 함
    console.log("시약장 목록 페이지 로드 완료. 데이터 로드 시작.");
    fetchCabinetListAndRender();
}

async function fetchCabinetListAndRender() {
    const listContainer = document.getElementById('cabinet-list-container');
    const statusMsg = document.getElementById('status-message-list');
    if (!listContainer || !statusMsg) return;

    statusMsg.textContent = '등록된 보관장소를 불러오는 중...';
    statusMsg.style.color = 'blue';

    try {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '시약장 목록 데이터 조회 실패');
        
        allAreas = data.areas || [];
        const cabinets = data.cabinets || [];
        
        if (cabinets.length === 0) {
            listContainer.innerHTML = `<div style="text-align: center; padding: 50px 20px; color: #888;"><h4>등록된 시약장이 없습니다.</h4><p style="margin-top: 15px;">'새 시약장 등록' 버튼을 눌러 첫 번째 시약장을 등록해 주세요.</p></div>`;
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

    const newContainer = listContainer.cloneNode(true);
    if (listContainer.parentNode) {
        listContainer.parentNode.replaceChild(newContainer, listContainer);
    }
    newContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const cabinetId = event.target.dataset.id;
            handleDeleteCabinet(cabinetId);
        }
        else if (event.target.classList.contains('edit-btn')) {
            const cabinetId = event.target.dataset.id;
            handleEditCabinet(cabinetId);
        }    
    });
}

function renderCabinetCards(cabinets, container) {
    container.innerHTML = ''; 

    cabinets.forEach(cabinet => {
        const areaName = allAreas.find(a => a.id === cabinet.area_id)?.name || '알 수 없음';
        
        const card = document.createElement('div');
        card.className = 'cabinet-card';
        card.setAttribute('data-cabinet-id', cabinet.id);
        
        const imageUrl = cabinet.photo_url_320 || '';
        card.innerHTML = `
            <div class="card-image-placeholder">
                <img src="${imageUrl}" alt="${cabinet.name} 사진" style="display: ${imageUrl ? 'block' : 'none'};">
                <span style="display: ${imageUrl ? 'none' : 'block'};">[${cabinet.name} 사진 없음]</span>
            </div>
            <div class="card-info">
                <h3>${cabinet.name} <small class="area-name">${areaName}</small></h3>
            </div>
            <div class="card-actions">
                <button class="edit-btn" data-id="${cabinet.id}">수정</button>
                <button class="delete-btn" data-id="${cabinet.id}">삭제</button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

async function handleDeleteCabinet(cabinetId) {
    if (!confirm(`정말로 이 시약장을 삭제하시겠습니까?\nID: ${cabinetId}`)) return;

    const CABINET_REG_URL = `${SUPABASE_URL}/functions/v1/cabinet-register`;
    try {
        const response = await fetch(`${CABINET_REG_URL}?id=${cabinetId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '삭제에 실패했습니다.');

        const cardToRemove = document.querySelector(`.cabinet-card[data-cabinet-id="${cabinetId}"]`);
        if (cardToRemove) cardToRemove.remove();
        alert('성공적으로 삭제되었습니다.');
    } catch (error) {
        console.error('삭제 처리 중 오류 발생:', error);
        alert(`삭제 실패: ${error.message}`);
    }
}

function setFabVisibility(visible) {
    const fab = document.querySelector('.fab');
    if (fab) {
        fab.style.display = visible ? 'block' : 'none';
    }
}

// =================================================================
// 8. 카메라 관련 함수
// =================================================================
async function startCamera() {
    const cameraModal = document.getElementById('camera-modal');
    if (!cameraModal) return;
    
    cameraModal.style.display = 'flex';
    const cameraView = document.getElementById('camera-view');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('현재 브라우저에서는 카메라 기능을 사용할 수 없습니다.');
        stopCamera();
        return;
    }
    if (!cameraView) {
        console.error("❌ camera-view 요소를 찾을 수 없습니다.");
        stopCamera();
        return;
    }

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, audio: false 
        });
        cameraView.srcObject = cameraStream;
    } catch (err) {
        console.error("카메라 접근 오류:", err);
        if (err.name === "NotAllowedError") {
            alert("카메라 접근 권한이 차단되었습니다.\n브라우저 및 운영체제의 카메라 권한 설정을 확인해주세요.");
        } else if (err.name === "NotFoundError") {
            alert("컴퓨터에 연결된 카메라를 찾을 수 없습니다.");
        } else {
            alert("카메라를 시작하는 중 알 수 없는 오류가 발생했습니다.");
        }
        stopCamera();
    }
}

function stopCamera() {
    const cameraModal = document.getElementById('camera-modal');
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    if (cameraModal) cameraModal.style.display = 'none';
}

function takePicture() {
    const cameraView = document.getElementById('camera-view');
    const canvas = document.getElementById('photo-canvas');
    if (!cameraView || !canvas) return;

    canvas.width = cameraView.videoWidth;
    canvas.height = cameraView.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cameraView, 0, 0, canvas.width, canvas.height);
    const base64Str = canvas.toDataURL('image/png');

    const isCabinetForm = !!document.getElementById('cabinet-creation-form');

    processImage(base64Str, (resizedImages) => {
        if (isCabinetForm) {
            const cabinetPhotoPreview = document.getElementById('cabinet-photo-preview');
            selectedCabinetPhoto_320_Base64 = resizedImages.base64_320;
            selectedCabinetPhoto_160_Base64 = resizedImages.base64_160;
            if (cabinetPhotoPreview) cabinetPhotoPreview.innerHTML = `<img src="${resizedImages.base64_320}" alt="Cabinet photo preview">`;
        } else {
            selectedPhoto_320_Base64 = resizedImages.base64_320;
            selectedPhoto_160_Base64 = resizedImages.base64_160;
            if (photoPreview) photoPreview.innerHTML = `<img src="${resizedImages.base64_320}" alt="Photo preview">`;
        }
    });

    stopCamera();
}

function resizeToFit(img, targetSize) {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, targetSize, targetSize); 

    const aspectRatio = img.width / img.height;
    let drawWidth = targetSize;
    let drawHeight = targetSize;

    if (aspectRatio > 1) {
        drawHeight = targetSize / aspectRatio;
    } else {
        drawWidth = targetSize * aspectRatio;
    }

    const xOffset = (targetSize - drawWidth) / 2;
    const yOffset = (targetSize - drawHeight) / 2;
    
    ctx.drawImage(img, xOffset, yOffset, drawWidth, drawHeight);
    return canvas.toDataURL('image/png');
}

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

// deno-lint-ignore no-unused-vars
function cancelForm() {
    loadLocationListPage();
}

/**
 * 카메라 모달의 '사진 찍기', '취소' 버튼에 이벤트 리스너를 설정하는 함수
 */
function setupCameraModalListeners() {
    const captureBtn = document.getElementById('capture-btn');
    const cancelCameraBtn = document.getElementById('cancel-camera-btn');

    if (captureBtn) {
        captureBtn.addEventListener('click', takePicture);
    }
    if (cancelCameraBtn) {
        cancelCameraBtn.addEventListener('click', stopCamera);
    }
}

// =================================================================
// 9. 약품 관리 목록 및 상세 정보 관련 함수
// =================================================================

/**
 * '약품 입고 정보 입력' 폼을 로드하는 함수
 */
function loadInventoryFormPage() {
    isEditMode = false;
    editingInventoryId = null;
    includeHTML('pages/form-input.html', 'form-container', initializeFormListeners);
}

/**
 * '약품 관리' 목록 페이지를 로드하고 FAB 버튼을 설정하는 함수
 */
function loadInventoryListPage() {
    const fab = document.getElementById('fab-button');
    if (fab) {
        fab.textContent = '입고 약품 등록'; // 버튼 텍스트
        fab.onclick = loadInventoryFormPage; // 버튼 기능
    }
    setFabVisibility(true); // 버튼 보이기
    includeHTML('pages/inventory-list.html', 'form-container', fetchInventoryAndRender);
}

// ✅ 재고 목록 불러오기
async function fetchInventoryAndRender() {
    const container = document.getElementById("inventory-list-container");
    const statusMessage = document.getElementById("status-message-inventory-list");

    try {
        statusMessage.textContent = "재고 목록을 불러오는 중...";
        container.innerHTML = "";

        // Supabase에서 Inventory + Substance + Cabinet 정보 함께 조회
        const { data, error } = await supabase
            .from("Inventory")
            .select(`
                id,
                bottle_identifier,
                current_amount,
                unit,
                purchase_date,
                state,
                classification,
                manufacturer,
                photo_url_160,
                substance_id (
                    id,
                    name,
                    cas_rn
                ),
                cabinet_id (
                    id,
                    name,
                    area_id (
                        id,
                        name
                    )
                )
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            statusMessage.textContent = "등록된 재고가 없습니다.";
            return;
        }

        // 목록 렌더링
        data.forEach(item => {
            const div = document.createElement("div");
            div.className = "cabinet-card";
            div.style.marginBottom = "10px";

            const imgUrl = item.photo_url_160 || "css/logo.png";
            const substanceName = item.substance_id?.name || "이름 없음";
            const cas = item.substance_id?.cas_rn || "-";
            const location = item.cabinet_id?.area_id?.name
                ? `${item.cabinet_id.area_id.name} > ${item.cabinet_id.name}`
                : "위치 정보 없음";

            div.innerHTML = `
                <div class="card-image-placeholder">
                    <img src="${imgUrl}" alt="${substanceName}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div class="card-info">
                    <h3>${substanceName}</h3>
                    <p class="area-name">${location}</p>
                    <p class="cabinet-specs">CAS: ${cas}</p>
                    <p class="cabinet-specs">${item.current_amount ?? "-"} ${item.unit ?? ""}</p>
                </div>
            `;

            // 클릭 시 상세 페이지로 이동
            div.addEventListener("click", () => {
                localStorage.setItem("selected_inventory_id", item.id);
                includeHTML("pages/inventory-detail.html");
            });

            container.appendChild(div);
        });

        statusMessage.textContent = "";
    } catch (err) {
        console.error("재고 목록 로드 오류:", err);
        statusMessage.textContent = "재고 목록을 불러오는 중 오류가 발생했습니다.";
    }
}

/**
 * 인벤토리 데이터를 받아 카드 UI를 생성하는 함수
 */
function renderInventoryCards(inventory, container) {
    container.innerHTML = '';
    
    const grouped = inventory.reduce((acc, item) => {
        const key = item.classification || '미분류';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    for (const category in grouped) {
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `<h3>${category}</h3><span>${grouped[category].length}</span>`;
        container.appendChild(categoryHeader);

        grouped[category].forEach(item => {
            const card = document.createElement('div');
            card.className = 'inventory-card';
            card.onclick = () => onInventoryCardClick(item.id);

            const cabinet = allCabinets.find(c => c.id === item.cabinet_id);
            const locationText = cabinet ? `『${cabinet.name}』 ${item.internal_shelf_level || '?'}단 ${item.storage_column || '?'}열` : '위치 미지정';

            card.innerHTML = `
                <div class="inventory-card-image">
                    <img src="${item.photo_url_160 || ''}" alt="시약병 사진" style="display: ${item.photo_url_160 ? 'block' : 'none'};">
                    <span style="display: ${item.photo_url_160 ? 'none' : 'block'};">[사진 없음]</span>
                </div>
                <div class="inventory-card-info">
                    <p class="name"><strong>${item.Substance.name || '이름 없음'} ${item.concentration_value || ''}${item.concentration_unit || ''}</strong> No.${item.id}</p>
                    <p class="location">${locationText}</p>
                </div>
                <div class="inventory-card-formula">
                    ${item.Substance.molecular_formula || ''}
                </div>
            `;
            container.appendChild(card);
        });
    }
}

/**
 * '약품 관리' 목록의 카드를 클릭했을 때 상세 페이지를 로드하는 함수
 */
function onInventoryCardClick(inventoryId) {
    includeHTML('pages/inventory-detail.html', 'form-container', () => {
        fetchAndRenderDetails(inventoryId);
    });
}

/**
 * 서버에서 특정 재고의 상세 데이터를 가져와 화면에 렌더링하는 함수
 */
async function fetchAndRenderDetails(inventoryId) {
    setFabVisibility(false); // FAB 숨기기
    try {
        const response = await fetch(`${EDGE_FUNCTION_URL}?type=inventory-detail&id=${inventoryId}`, {
            headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '상세 정보 조회 실패');

        // 1. 기본 정보 채우기
        if (data.photo_url_320) {
            document.getElementById('detail-photo').innerHTML = `<img src="${data.photo_url_320}" alt="시약병 사진">`;
        } else {
            document.getElementById('detail-photo').innerHTML = '<span>사진 없음</span>';
        }
        document.getElementById('detail-name').textContent = data.Substance.name || '이름 없음';
        document.getElementById('detail-cas').textContent = `CAS: ${data.Substance.cas_rn}`;
        const locationText = data.Cabinet ? `위치: 『${data.Cabinet.name}』 ${data.internal_shelf_level || '?'}단 ${data.storage_column || '?'}열` : '위치: 미지정';
        document.getElementById('detail-location').textContent = locationText;

        // 2. MSDS 아코디언 채우기
        const msdsContainer = document.getElementById('msds-accordion');
        msdsContainer.innerHTML = '';
        if (data.Substance.MSDS && data.Substance.MSDS.length > 0) {
            data.Substance.MSDS.sort((a, b) => a.section_number - b.section_number);
            const titles = ["화학제품과 회사에 관한 정보", "유해성·위험성", "구성성분의 명칭 및 함유량", "응급조치 요령", "폭발·화재 시 대처방법", "누출 사고 시 대처방법", "취급 및 저장방법", "노출방지 및 개인보호구", "물리화학적 특성", "안정성 및 반응성", "독성에 관한 정보", "환경에 미치는 영향", "폐기 시 주의사항", "운송에 필요한 정보", "법적 규제 현황", "그 밖의 참고사항"];
            data.Substance.MSDS.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'accordion-item';
                itemEl.innerHTML = `
                    <button class="accordion-header">${item.section_number}. ${titles[item.section_number - 1] || '정보'}</button>
                    <div class="accordion-content">
                        <p>${item.content}</p>
                    </div>
                `;
                msdsContainer.appendChild(itemEl);
            });
            msdsContainer.querySelectorAll('.accordion-header').forEach(button => {
                button.addEventListener('click', () => {
                    button.classList.toggle('active');
                    const content = button.nextElementSibling;
                    if (content.style.maxHeight) {
                        content.style.maxHeight = null;
                        content.classList.remove('show');
                    } else {
                        content.classList.add('show');
                        content.style.maxHeight = content.scrollHeight + "px";
                    }
                });
            });
        } else {
            msdsContainer.innerHTML = '<p>등록된 MSDS 정보가 없습니다.</p>';
        }

        // 3. 유해화학물질 정보 채우기
        const hazardContainer = document.getElementById('hazard-info-container');
        hazardContainer.innerHTML = '';
        if (data.Substance.HazardClassifications && data.Substance.HazardClassifications.length > 0) {
            data.Substance.HazardClassifications.forEach(item => {
                const hazardCard = document.createElement('div');
                hazardCard.className = 'hazard-card';
                hazardCard.innerHTML = `
                    <h4>${item.classification_type || '분류 정보 없음'}</h4>
                    <p><strong>고유번호:</strong> ${item.id_number || '정보 없음'}</p>
                    <p><strong>함량정보:</strong> ${item.content_info || '정보 없음'}</p>
                    <p><strong>고시정보:</strong> ${item.gosi_info || '정보 없음'}</p>
                    <p><strong>고시일자:</strong> ${item.gosidate || '정보 없음'}</p>
                `;
                hazardContainer.appendChild(hazardCard);
            });
        } else {
            hazardContainer.innerHTML = '<p>등록된 유해화학물질 정보가 없습니다.</p>';
        }

        // 4. 삭제 및 수정 버튼에 이벤트 연결
        document.getElementById('delete-inventory-btn').onclick = () => handleDeleteInventory(inventoryId);
        document.getElementById('edit-inventory-btn').onclick = () => handleEditInventory(inventoryId);

    } catch (error) {
        console.error("상세 정보 로드 오류:", error);
        document.getElementById('detail-page-container').innerHTML = `<p>오류: ${error.message}</p>`;
    }
}

/**
 * 재고 삭제를 처리하는 함수
 */
async function handleDeleteInventory(inventoryId) {
    if (!confirm("정말로 이 재고 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;

    try {
        const response = await fetch(`${EDGE_FUNCTION_URL}?type=inventory&id=${inventoryId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '삭제 실패');
        
        alert('성공적으로 삭제되었습니다.');
        loadInventoryListPage();
    } catch (error) {
        alert(`삭제 중 오류 발생: ${error.message}`);
    }
}

/**
 * '수정' 버튼 클릭 시 실행: 수정 모드를 활성화하고 폼을 로드합니다.
 */
function handleEditInventory(inventoryId) {
    console.log(`수정 모드 시작: Inventory ID ${inventoryId}`);
    isEditMode = true;
    editingInventoryId = inventoryId;
    includeHTML('pages/form-input.html', 'form-container', initializeFormListeners);
}

/**
 * 수정된 재고 정보를 서버에 PATCH 요청으로 전송합니다.
 */
async function updateInventory(event) {
    if (event) event.preventDefault();

    const submitButton = document.getElementById('inventory-submit-button');
    if (!statusMessage || !submitButton || !editingInventoryId) return;

    const casRn = document.getElementById('cas_rn').value.trim();
    if (!casRn) {
        alert('CAS 번호는 필수입니다.');
        return;
    }
    
    // 1. 폼 데이터 수집 (importData와 동일)
    const purchaseVolumeStr = document.getElementById('purchase_volume').value;
    const concentrationValueStr = document.getElementById('concentration_value').value;
    const manufacturerOther = manufacturerOtherInput ? manufacturerOtherInput.value.trim() : '';
    const purchaseDate = document.getElementById('purchase_date').value;

    const purchaseVolume = parseFloat(purchaseVolumeStr);
    const concentrationValue = parseFloat(concentrationValueStr);

    const finalManufacturer = selectedManufacturer === '기타' ? (manufacturerOther || null) : selectedManufacturer;
    const finalClassification = selectedClassification || '미분류';

    // 2. 서버로 전송할 최종 데이터 구성
    const inventoryData = {
        inventory_id: editingInventoryId, // 수정할 재고의 ID
        inventoryDetails: {
            // casRn은 수정하지 않으므로 여기서 제외합니다.
            concentration_value: isNaN(concentrationValue) ? null : concentrationValue,
            concentration_unit: selectedConcentrationUnit || null,
            purchase_volume: isNaN(purchaseVolume) ? null : purchaseVolume,
            // current_amount는 사용량 등록 기능에서 별도로 관리해야 하므로, 여기서는 수정하지 않습니다.
            unit: selectedUnit || null,
            state: selectedState || null,
            manufacturer: finalManufacturer,
            purchase_date: purchaseDate || null,
            classification: finalClassification,
            cabinet_id: locationSelections.cabinet_id,
            door_vertical: locationSelections.door_vertical,
            door_horizontal: locationSelections.door_horizontal,
            internal_shelf_level: locationSelections.internal_shelf_level,
            storage_columns: locationSelections.storage_columns,
            // 새로 선택한 사진이 있다면 데이터가 담기고, 없다면 null이 전송됩니다.
            photo_320_base64: selectedPhoto_320_Base64,
            photo_160_base64: selectedPhoto_160_Base64,
        }
    };

    try {
        submitButton.disabled = true;
        submitButton.textContent = '수정 중...';

        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
            body: JSON.stringify(inventoryData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '수정 실패');

        alert('✅ 성공적으로 수정되었습니다.');
        loadInventoryListPage();

    } catch (error) {
        console.error("데이터 수정 중 오류 발생:", error);
        alert(`❌ 수정 실패: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '수정 내용 저장';
        isEditMode = false;
        editingInventoryId = null;
    }
}
