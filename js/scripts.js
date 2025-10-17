// =================================================================
// 0. 전역 변수 및 설정
// =================================================================

// 🚨 Supabase 및 Edge Function 설정
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
// 🔑 시약장 등록 폼 전용 선택 값
let selectedAreaCreation = null;
let selectedCabinetName = null;
let selectedDoorVerticalSplit = null;
let selectedDoorHorizontalSplit = null;
let selectedShelfHeight = null;
let selectedStorageColumns = null;

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
    setFabVisibility(false);

    statusMessage = document.getElementById('statusMessage');
    manufacturerButtonsGroup = document.getElementById('manufacturer_buttons');
    otherManufacturerGroup = document.getElementById('other_manufacturer_group');
    manufacturerOtherInput = document.getElementById('manufacturer_other');

    // 시약병 사진 관련 요소 초기화
    photoInput = document.getElementById('photo-input');
    cameraInput = document.getElementById('camera-input');
    photoPreview = document.getElementById('photo-preview');
    const cameraBtn = document.getElementById('camera-btn');
    const photoBtn = document.getElementById('photo-btn');
    const captureBtn = document.getElementById('capture-btn');
    const cancelCameraBtn = document.getElementById('cancel-camera-btn');

    if (photoBtn && photoInput) {
        photoBtn.addEventListener('click', () => photoInput.click());
    }
    if (cameraBtn) {
        cameraBtn.addEventListener('click', startCamera);
    }
    if (captureBtn) {
        captureBtn.addEventListener('click', takePicture);
    }
    if (cancelCameraBtn) {
        cancelCameraBtn.addEventListener('click', stopCamera);
    }
    
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

async function fetchLocationData() {
    try {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || '장소 데이터 조회 실패');
        }
        allAreas = data.areas;
        allCabinets = data.cabinets;
        populateAreaSelect(allAreas);
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

    generateLocationButtons(
        'location_door_vertical_group', 
        cabinetInfo.door_vertical_count, 
        'door_vertical',
        (value, count) => `${count - value + 1}층`
    );
    
    generateLocationButtons(
        'location_door_horizontal_group', 
        cabinetInfo.door_horizontal_count, 
        'door_horizontal',
        (value, count) => {
            if (count === 1) return '문';
            if (value === 1) return '좌측문';
            return '우측문';
        }
    );

    generateLocationButtons(
        'location_internal_shelf_group', 
        cabinetInfo.shelf_height, 
        'internal_shelf_level',
        (value) => `${value}단`
    );

    generateLocationButtons(
        'location_storage_column_group', 
        cabinetInfo.storage_columns, 
        'storage_columns',
        (value) => `${value}열`
    );
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
function setupNavbarListeners() {
    const startMenu = document.getElementById('start-menu');
    const startButton = document.querySelector('.start-button');
    if (!startMenu || !startButton) return;

    startButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        startMenu.classList.toggle('visible');
    });

    const menuItems = startMenu.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            startMenu.classList.remove('visible');
            const itemText = event.target.textContent.trim();
            if (itemText === '시약장 설정') {
                includeHTML('pages/location-list.html', 'form-container', setupLocationList);
            }
        });
    });

    globalThis.addEventListener('click', (event) => {
        if (startMenu.classList.contains('visible')) {
            if (!startMenu.contains(event.target) && !startButton.contains(event.target)) {
                startMenu.classList.remove('visible');
            }
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
        if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error("서버에서 유효한 응답을 받지 못했습니다.");
        }

        const result = data[0];
        const msg = result.isNewSubstance ? `✅ 신규 물질(${casRn}) 정보 및 시약병 등록 완료!` : `✅ 기존 물질(${casRn})에 새 시약병 등록 완료!`;
        alert(msg);
        statusMessage.textContent = '';

        document.getElementById('inventory-form').reset();
        if (photoPreview) photoPreview.innerHTML = '<span>사진 없음</span>';
        selectedPhoto_320_Base64 = null;
        selectedPhoto_160_Base64 = null;
        document.querySelectorAll('.button-group .active').forEach(button => button.classList.remove('active'));

    } catch (error) {
        console.error("데이터 전송 중 오류 발생:", error);
        alert(`❌ 오류: 데이터 처리 실패.\n\n(${error.message})`);
        statusMessage.textContent = '';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '재고 정보 DB에 저장';
    }
}

// =================================================================
// 6. 페이지 진입점
// =================================================================
globalThis.addEventListener('DOMContentLoaded', () => {
    includeHTML('pages/form-input.html', 'form-container', initializeFormListeners);
    includeHTML('pages/navbar.html', 'navbar-container', setupNavbarListeners);
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
    console.log("새 시약장 등록 폼 로드 완료.");
    setFabVisibility(false);

    otherAreaInput = document.getElementById('other_area_input');
    otherCabinetInput = document.getElementById('other_cabinet_input');

    const photoInput = document.getElementById('cabinet-photo-input');
    const cameraInput = document.getElementById('cabinet-camera-input');
    const photoPreview = document.getElementById('cabinet-photo-preview');
    const cameraBtn = document.getElementById('cabinet-camera-btn');
    const photoBtn = document.getElementById('cabinet-photo-btn');

    if (cameraBtn) {
        cameraBtn.addEventListener('click', startCamera);
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

    setupButtonGroup('location_type_buttons');
    setupButtonGroup('cabinet_name_buttons');
    setupButtonGroup('door_vertical_split_buttons');
    setupButtonGroup('door_horizontal_split_buttons');
    setupButtonGroup('shelf_height_buttons');
    setupButtonGroup('storage_columns_buttons');
    
    attachOtherInputLogic('location_type_buttons', 'other_area_group', 'other_area_input'); 
    attachOtherInputLogic('cabinet_name_buttons', 'other_cabinet_group', 'other_cabinet_input');
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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
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
    setFabVisibility(true);
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
    });
}

function renderCabinetCards(cabinets, container) {
    container.innerHTML = ''; 

    cabinets.forEach(cabinet => {
        const areaName = allAreas.find(a => a.id === cabinet.area_id)?.name || '알 수 없음';
        
        let verticalDoorText = '단일도어';
        if (cabinet.door_vertical_count === 3) verticalDoorText = '상중하도어';
        else if (cabinet.door_vertical_count === 2) verticalDoorText = '상하도어';
        const horizontalDoorText = cabinet.door_horizontal_count === 2 ? '좌우분리도어' : '단일도어';
        
        const card = document.createElement('div');
        card.className = 'cabinet-card';
        card.setAttribute('data-cabinet-id', cabinet.id);
        
        card.innerHTML = `
            <div class="card-image-placeholder">
                <img src="${cabinet.photo_url_320 || ''}" alt="${cabinet.name} 사진" style="display: ${cabinet.photo_url_320 ? 'block' : 'none'};">
                <span style="display: ${cabinet.photo_url_320 ? 'none' : 'block'};">[${cabinet.name} 사진 없음]</span>
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
    const cameraView = document.getElementById('camera-view');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('현재 브라우저에서는 카메라 기능을 사용할 수 없습니다.');
        return;
    }

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, audio: false 
        });
        cameraView.srcObject = cameraStream;
        cameraModal.style.display = 'flex';
    } catch (err) {
        console.error("카메라 접근 오류:", err);
        alert("카메라를 시작할 수 없습니다. 운영체제 및 브라우저의 카메라 접근 권한을 확인해주세요.");
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
