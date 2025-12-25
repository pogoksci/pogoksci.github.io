-- 1. 컬럼 추가 (Columns Addition)
ALTER TABLE public.lab_usage_log
ADD COLUMN IF NOT EXISTS applicant_name text,
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS participant_count integer;

-- 2. RLS 정책 수정 (RLS Policy Update)
-- 기존 정책 충돌 방지를 위해 먼저 삭제 (이름은 환경에 따라 다를 수 있음)
DROP POLICY IF EXISTS "Authenticated can insert" ON public.lab_usage_log;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.lab_usage_log;

-- 인증된 사용자(Student 포함)에게 INSERT 권한 부여
CREATE POLICY "Authenticated can insert"
ON public.lab_usage_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- (선택사항) 학생들이 본인이 등록한 예약 내역을 조회('내 예약 조회' 기능)하려면 
-- 자신의 ID가 기록되거나, 혹은 insert한 세션에서 바로 읽을 수 있는 권한이 필요합니다.
-- 현재 요구사항에서는 'INSERT 허용'이 핵심이므로 위 정책으로 충분할 수 있으나,
-- 추후 '내 예약 조회' 시 RLS에 막힌다면 아래와 같은 SELECT 정책도 고려해보세요.
-- CREATE POLICY "Authenticated can view own logs"
-- ON public.lab_usage_log
-- FOR SELECT
-- TO authenticated
-- USING (true); -- (테스트용: 모든 사람이 조회 가능) 또는 적절한 필터 조건
