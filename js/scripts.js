const statusMessage = document.getElementById('statusMessage');
const photoInput = document.getElementById('file_select');
const cameraInput = document.getElementById('camera_capture');
const photoPreview = document.getElementById('photo_preview');

// 🔑 버튼 그룹의 선택 값을 저장할 전역 변수
let selectedState = null;
let selectedUnit = 'g'; // 단위 기본값 설정

// --- 버튼 그룹 핸들러 함수 ---
function setupButtonGroup(groupId, initialValue = null) {
    const group = document.getElementById(groupId);
    if (!group) return; 

    group.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            // 스타일 변경
            group.querySelectorAll('.active').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');

            // 전역 변수 값 업데이트
            const value = event.target.getAttribute('data-value');
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

// 사진 파일 미리보기 핸들러
function handlePhotoChange(event) {
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

// 이벤트 리스너 설정
photoInput.addEventListener('change', handlePhotoChange);
cameraInput.addEventListener('change', handlePhotoChange);

// 페이지 로드 후 버튼 그룹 설정 실행
document.addEventListener('DOMContentLoaded', () => {
    setupButtonGroup('state_buttons'); // 상태 버튼 그룹 설정
    setupButtonGroup('unit_buttons', 'g'); // 단위 버튼 그룹 설정 (기본값 'g'로 설정)
});


/**
    * 폼 데이터를 수집하여 Edge Function으로 전송합니다.
    */
async function importData() {
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
    
    // 🔑 버튼 그룹 값 가져오기
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
    const file = photoInput.files[0] || cameraInput.files[0];
    
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