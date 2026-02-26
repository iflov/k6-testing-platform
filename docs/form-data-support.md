# Form-Data API 부하 테스트 지원 가이드

_작성일: 2026-02-26 | 대상: K6 Testing Platform_

---

## 1. 개요

### 배경

현재 K6 Testing Platform은 `application/json` 형식의 요청만 지원합니다. 하지만 실제 운영 환경에서는 파일 업로드, 폼 제출 등 `multipart/form-data` 형식의 API가 많이 사용됩니다.

이 문서는 form-data 형식의 API를 K6로 부하 테스트하기 위한 **구현 가이드**와 **K6 스크립트 작성 방법**을 다룹니다.

### 지원 대상 Content-Type

| Content-Type | 설명 | 사용 사례 |
|---|---|---|
| `application/json` | 기존 지원 (기본값) | REST API 일반 요청 |
| `multipart/form-data` | **신규 추가** | 파일 업로드, 폼 데이터 전송 |
| `application/x-www-form-urlencoded` | **신규 추가** | HTML 폼 제출, 로그인 요청 |

---

## 2. K6의 Form-Data 지원 방식

K6는 `multipart/form-data`를 네이티브로 지원합니다. `http.post()`에 객체를 전달하면 자동으로 `multipart/form-data`로 인코딩됩니다.

### 2.1 텍스트 필드만 전송

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export default function () {
  const payload = {
    username: 'testuser',
    email: 'test@example.com',
    age: '25',
  };

  const res = http.post('https://api.example.com/submit', payload);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

> K6에 객체를 body로 전달하면 자동으로 `Content-Type: multipart/form-data`로 설정됩니다.
> 헤더를 명시적으로 지정하지 않아야 boundary가 자동 생성됩니다.

### 2.2 파일 업로드 (바이너리 파일)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

// open()은 반드시 init context (최상위 스코프)에서 호출해야 합니다
const fileData = open('/path/to/test-file.xlsx', 'b');

export default function () {
  const payload = {
    dryRun: 'true',
    file: http.file(fileData, 'test-data.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  };

  const res = http.post('https://api.example.com/upload', payload);

  check(res, {
    'upload successful': (r) => r.status === 200,
  });
  sleep(1);
}
```

> **중요**: `open()` 함수는 K6의 init context(VU 함수 바깥)에서만 호출할 수 있습니다.
> VU 함수(`export default function`) 내부에서 호출하면 에러가 발생합니다.

### 2.3 URL Encoded 폼

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export default function () {
  const payload = 'username=testuser&password=testpass&remember=true';
  const params = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  const res = http.post('https://api.example.com/login', payload, params);

  check(res, {
    'login successful': (r) => r.status === 200,
  });
  sleep(1);
}
```

---

## 3. 실제 사례: 일괄지급 API 부하 테스트

### 3.1 대상 API 분석

**Endpoint**: `POST https://dev3.admin.store5000.com/admin/bulk-payment/execute`

| 항목 | 상세 |
|------|------|
| Content-Type | `multipart/form-data` |
| 파일 필드명 | `file` |
| 허용 파일 형식 | `.xlsx` (Excel) |
| 최대 파일 크기 | 10MB |
| 인증 | 세션 기반 (또는 `amIdx` 파라미터) |

#### 요청 필드 상세

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `file` | File (binary) | O | 일괄지급 데이터가 포함된 .xlsx 파일 |
| `dryRun` | String | X | `"true"` 시 검증만 수행 (실제 지급하지 않음) |
| `amIdx` | String | X | 관리자 ID (세션 없는 경우 필수) |
| `reservation` | String | X | `"true"` 시 예약 지급 모드 활성화 |
| `startTime` | String | X | 예약 실행 시각 (형식: `YYYYMMDDHHmm`, reservation=true 시 필수) |

#### 엑셀 파일 구조 (시트명: `일괄지급`)

| 열 | 필드 | 타입 | 필수 | 범위 |
|----|------|------|------|------|
| 1 | 회원정보 (mm_idx) | 정수 | O | 1 이상 |
| 2 | 골드상자 | 정수 | X | 0 이상 |
| 3 | 포인트 | 정수 | X | 0 이상 |
| 4 | 배송비쿠폰(개) | 정수 | X | 0-500 |
| 5 | 배송비유효기간(시간) | 정수 | 조건부 | 1-8760 |
| 6 | 상자할인쿠폰(개) | 정수 | X | 0-500 |
| 7 | 상자할인금액(원) | 정수 | 조건부 | 0-9000 |
| 8 | 상자할인유효기간(시간) | 정수 | 조건부 | 1-8760 |
| 9 | 정률할인(%) | 정수 | X | 0-90 |
| 10 | 타입 | 문자열 | O | 이벤트/배송환급/테스트/기타 |
| 11 | 사유 | 문자열 | O | 1-200자 |

#### 응답 형식

**성공 (즉시 지급)**:
```json
{
  "code": 200,
  "message": "일괄 지급 완료 (10건, 523ms)",
  "data": {
    "totalRows": 10,
    "successCount": 10,
    "summary": {
      "goldBox": 50,
      "point": 10000,
      "deliveryCoupon": 15,
      "boxDiscountCoupon": 10,
      "discountRateCoupon": 5
    }
  }
}
```

**성공 (Dry Run)**:
```json
{
  "code": 200,
  "message": "검증 완료 (오류 없음)",
  "data": {
    "totalRows": 10,
    "errorCount": 0
  }
}
```

**실패**:
```json
{
  "code": 400,
  "message": "유효성 검증 실패",
  "data": {
    "totalRows": 10,
    "errorCount": 2,
    "errors": {
      "2": ["Row 2: 회원정보는 필수입니다."],
      "5": ["Row 5: 골드상자는 0 이상의 정수여야 합니다."]
    }
  }
}
```

### 3.2 K6 테스트 스크립트 예제

#### 예제 1: Dry Run 모드 부하 테스트 (검증만)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

// init context에서 파일 로드 (필수)
const testFile = open('/path/to/test-bulk-payment.xlsx', 'b');

export const options = {
  scenarios: {
    bulk_payment_dryrun: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
    },
  },
  tags: {
    testId: 'bulk-payment-dryrun-001',
    scenario: 'load',
  },
};

export default function () {
  const payload = {
    file: http.file(
      testFile,
      'bulk-payment-test.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ),
    dryRun: 'true',
    amIdx: '1',
  };

  const res = http.post(
    'https://dev3.admin.store5000.com/admin/bulk-payment/execute',
    payload
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'no validation errors': (r) => {
      const body = JSON.parse(r.body);
      return body.code === 200;
    },
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  sleep(1);
}
```

#### 예제 2: 실제 지급 부하 테스트 (소량 VU)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

const testFile = open('/path/to/test-bulk-payment.xlsx', 'b');

export const options = {
  scenarios: {
    bulk_payment_execute: {
      executor: 'constant-vus',
      vus: 1,       // 실제 지급이므로 VU 최소화
      duration: '1m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<10000'], // 95% 요청이 10초 이내
    http_req_failed: ['rate<0.1'],      // 실패율 10% 미만
  },
};

export default function () {
  const payload = {
    file: http.file(
      testFile,
      'bulk-payment-test.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ),
    dryRun: 'false',
    amIdx: '1',
  };

  const res = http.post(
    'https://dev3.admin.store5000.com/admin/bulk-payment/execute',
    payload
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'payment executed': (r) => {
      const body = JSON.parse(r.body);
      return body.code === 200 && body.data.successCount > 0;
    },
  });

  // 실제 지급이므로 긴 간격 설정 (MySQL 락 대기 고려)
  sleep(3);
}
```

#### 예제 3: 예약 지급 부하 테스트

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

const testFile = open('/path/to/test-bulk-payment.xlsx', 'b');

export const options = {
  scenarios: {
    bulk_payment_reservation: {
      executor: 'shared-iterations',
      vus: 3,
      iterations: 10,
      maxDuration: '5m',
    },
  },
};

export default function () {
  // 현재 시각 + 1시간 후로 예약
  const now = new Date();
  now.setHours(now.getHours() + 1);
  const startTime = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0');

  const payload = {
    file: http.file(
      testFile,
      'bulk-payment-test.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ),
    dryRun: 'false',
    amIdx: '1',
    reservation: 'true',
    startTime: startTime,
  };

  const res = http.post(
    'https://dev3.admin.store5000.com/admin/bulk-payment/execute',
    payload
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'reservation registered': (r) => {
      const body = JSON.parse(r.body);
      return body.code === 200 && body.message.includes('예약');
    },
  });

  sleep(2);
}
```

### 3.3 테스트 시 주의사항

#### MySQL 락 경합

이 API는 `GET_LOCK('bulk_payment_lock')`을 사용하여 동시 실행을 방지합니다. 따라서:

- **동시에 1개의 지급만 처리 가능** — 여러 VU가 동시에 요청하면 나머지는 락 대기
- 락 타임아웃은 30초 — 대기 시간이 30초를 초과하면 실패 응답
- **Dry Run 모드는 락을 사용하지 않으므로** 병렬 부하 테스트에 적합

```
권장 테스트 전략:
1. dryRun=true로 높은 VU 부하 테스트 (검증 로직 성능 측정)
2. dryRun=false로 낮은 VU 순차 테스트 (실제 지급 성능 측정)
3. 여러 VU로 동시 지급 시도 (락 경합 시나리오 테스트)
```

#### 트랜잭션 안전성

- 이 API는 **All-or-Nothing 트랜잭션**을 사용합니다
- 한 건이라도 실패하면 전체 롤백됩니다
- 부하 테스트 후 **DB 상태를 반드시 확인**하세요

#### 테스트 데이터 준비

부하 테스트용 Excel 파일은 **실제 존재하는 회원 ID**를 사용해야 합니다. 존재하지 않는 회원 ID를 사용하면 검증 단계에서 실패합니다.

```
테스트용 엑셀 파일 예시 (시트명: 일괄지급):

| 회원정보 | 골드상자 | 포인트 | 배송비쿠폰 | 배송비유효기간 | 상자할인쿠폰 | 상자할인금액 | 상자할인유효기간 | 정률할인 | 타입   | 사유           |
|---------|---------|--------|-----------|-------------|------------|-----------|-------------|--------|--------|---------------|
| 12345   | 1       | 100    | 0         | 0           | 0          | 0         | 0           | 0      | 테스트  | k6 부하테스트용 |
| 12346   | 0       | 500    | 1         | 24          | 0          | 0         | 0           | 0      | 테스트  | k6 부하테스트용 |
```

---

## 4. 플랫폼 구현 계획

### 4.1 수정 대상 파일

| 파일 | 수정 내용 | 복잡도 |
|------|-----------|--------|
| `apps/k6-runner-v2/src/types/test.types.ts` | `ContentType`, `FormDataField` 타입 추가 | LOW |
| `apps/k6-runner-v2/src/modules/scenarios/scenario.service.ts` | form-data/urlencoded K6 스크립트 생성 | HIGH |
| `apps/k6-runner-v2/src/utils/validation.ts` | contentType 유효성 검사 추가 | LOW |
| `apps/control-panel/components/TestController.tsx` | Content-Type 선택 UI, form-data 필드 에디터 | MEDIUM |
| `apps/control-panel/app/api/k6/run/route.ts` | contentType, formFields 전달 | LOW |

### 4.2 타입 정의

```typescript
// apps/k6-runner-v2/src/types/test.types.ts

export type ContentType = 'json' | 'form-data' | 'x-www-form-urlencoded';

export interface FormDataField {
  key: string;           // 필드명 (예: "file", "dryRun")
  value: string;         // 필드값 또는 파일 경로
  type: 'text' | 'file'; // text: 일반 값, file: 파일 업로드
  filename?: string;     // file 타입일 때 전송할 파일명
  contentType?: string;  // file 타입일 때 MIME 타입
}

export interface TestConfig {
  // ... 기존 필드 유지
  contentType?: ContentType;
  formFields?: FormDataField[];
}
```

### 4.3 K6 스크립트 생성 분기 로직

`ScenarioService.generateK6Script()` 내에서 `contentType`에 따라 분기합니다:

```
contentType 값에 따른 분기:

json (기본값)
  → 기존 로직 그대로 유지
  → Content-Type: application/json 헤더
  → body를 JSON 문자열로 전달

form-data
  → file 타입 필드가 있으면 open()을 init context에 배치
  → body를 객체 리터럴로 구성
  → file 필드는 http.file()로 래핑
  → Content-Type 헤더 제거 (K6가 boundary 포함하여 자동 설정)

x-www-form-urlencoded
  → body를 "key=value&key=value" 형식으로 구성
  → Content-Type: application/x-www-form-urlencoded 헤더
```

### 4.4 생성될 K6 스크립트 예시

#### form-data (파일 포함)

아래는 일괄지급 API 설정 시 자동 생성될 K6 스크립트 형태입니다:

```javascript
import http from 'k6/http';
import { check, sleep, fail } from 'k6';

// init context에서 파일 로드
const file_0 = open('/data/test-bulk-payment.xlsx', 'b');

export const options = {
  scenarios: {
    load_constant: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
    },
  },
  tags: {
    testId: 'abc-123',
    scenario: 'load',
  },
};

export default function () {
  const payload = {
    file: http.file(
      file_0,
      'test-bulk-payment.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ),
    dryRun: 'true',
    amIdx: '1',
  };

  const res = http.post(
    'https://dev3.admin.store5000.com/admin/bulk-payment/execute',
    payload
  );

  if (res.error_code && res.error_code >= 1000 && res.error_code <= 1999) {
    console.error(`Critical connection error: ${res.error} (Code: ${res.error_code})`);
  }

  check(res, {
    'status is successful (200/201)': (r) => r.status === 200 || r.status === 201,
  });
  sleep(1);
}
```

#### form-data (텍스트만)

```javascript
import http from 'k6/http';
import { check, sleep, fail } from 'k6';

export const options = { /* ... */ };

export default function () {
  const payload = {
    username: 'testuser',
    email: 'test@example.com',
    message: 'Hello World',
  };

  const res = http.post('https://api.example.com/form-submit', payload);

  check(res, {
    'status is successful (200/201)': (r) => r.status === 200 || r.status === 201,
  });
  sleep(1);
}
```

#### x-www-form-urlencoded

```javascript
import http from 'k6/http';
import { check, sleep, fail } from 'k6';

export const options = { /* ... */ };

export default function () {
  const params = {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  };

  const body = 'username=testuser&password=testpass&remember=true';

  const res = http.post('https://api.example.com/login', body, params);

  check(res, {
    'status is successful (200/201)': (r) => r.status === 200 || r.status === 201,
  });
  sleep(1);
}
```

### 4.5 프론트엔드 UI 변경

POST/PUT/PATCH 메서드 선택 시 기존 "Request Body (JSON)" 영역이 다음과 같이 변경됩니다:

```
┌─────────────────────────────────────────────────────┐
│ Content Type                                        │
│ ┌──────────┐ ┌───────────┐ ┌──────────────────────┐ │
│ │   JSON   │ │ Form Data │ │ x-www-form-urlencoded│ │
│ └──────────┘ └───────────┘ └──────────────────────┘ │
│                                                     │
│ [JSON 선택 시]                                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ { "message": "Hello from k6!" }                 │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [Form Data 선택 시]                                  │
│ Key          Value               Type        Action │
│ ┌──────────┐ ┌──────────────────┐ ┌──────┐ ┌─────┐ │
│ │ file     │ │ /data/test.xlsx  │ │ file │ │  X  │ │
│ └──────────┘ └──────────────────┘ └──────┘ └─────┘ │
│ ┌──────────┐ ┌──────────────────┐ ┌──────┐ ┌─────┐ │
│ │ dryRun   │ │ true             │ │ text │ │  X  │ │
│ └──────────┘ └──────────────────┘ └──────┘ └─────┘ │
│ ┌──────────┐ ┌──────────────────┐ ┌──────┐ ┌─────┐ │
│ │ amIdx    │ │ 1                │ │ text │ │  X  │ │
│ └──────────┘ └──────────────────┘ └──────┘ └─────┘ │
│                               [+ Add Field]        │
│                                                     │
│ [File 타입 선택 시 추가 입력]                         │
│ Filename: test.xlsx                                 │
│ MIME Type: application/vnd.openxmlformats-...       │
│                                                     │
│ ⓘ 파일 경로는 K6 실행 환경(Docker) 기준입니다.        │
│   Docker 볼륨 마운트를 통해 파일을 공유하세요.         │
└─────────────────────────────────────────────────────┘
```

---

## 5. Docker 환경에서의 파일 접근

K6 Runner는 Docker 컨테이너 내에서 실행됩니다. form-data 테스트에서 파일을 업로드하려면 **K6 실행 환경에서 해당 파일에 접근 가능**해야 합니다.

### 5.1 docker-compose.yml 볼륨 마운트

```yaml
# docker-compose.yml
services:
  k6-runner:
    # ... 기존 설정
    volumes:
      - ./test-data:/data  # 호스트의 test-data/ → 컨테이너의 /data/
```

### 5.2 테스트 파일 배치

```bash
# 프로젝트 루트에 test-data 디렉토리 생성
mkdir -p test-data

# 테스트용 Excel 파일 복사
cp ~/path/to/test-bulk-payment.xlsx test-data/

# K6 스크립트에서 참조할 경로: /data/test-bulk-payment.xlsx
```

### 5.3 로컬 실행 시 (Docker 없이)

Docker 없이 로컬에서 K6를 직접 실행하는 경우, 절대 경로 또는 K6 실행 디렉토리 기준 상대 경로를 사용합니다:

```javascript
// 절대 경로
const fileData = open('/Users/admin/Desktop/test-data/test.xlsx', 'b');

// 상대 경로 (K6 실행 위치 기준)
const fileData = open('./test-data/test.xlsx', 'b');
```

---

## 6. 테스트 시나리오 권장사항

### 6.1 일괄지급 API 부하 테스트 전략

```
Phase 1: 단일 요청 검증 (Smoke Test)
  - VUs: 1, Iterations: 1
  - dryRun: true
  - 목적: 연결 확인, 파일 업로드 동작 확인

Phase 2: 검증 로직 부하 테스트 (Load Test)
  - VUs: 5-20, Duration: 5m
  - dryRun: true (DB 변경 없음)
  - 목적: Excel 파싱 + 검증 로직의 성능 측정

Phase 3: 동시성 테스트 (Stress Test)
  - VUs: 10-50, Duration: 3m
  - dryRun: true
  - 목적: 동시 요청 시 서버 안정성 확인

Phase 4: 실제 지급 성능 테스트
  - VUs: 1, Iterations: 10 (순차 실행)
  - dryRun: false
  - 목적: 실제 트랜잭션 처리 시간 측정
  - 주의: MySQL 락으로 동시 1건만 처리됨
```

### 6.2 주요 모니터링 지표

| 지표 | 설명 | 임계값 예시 |
|------|------|-----------|
| `http_req_duration` | 요청-응답 소요 시간 | p95 < 10s |
| `http_req_failed` | 요청 실패율 | rate < 5% |
| `http_reqs` | 초당 요청 수 (RPS) | - |
| `data_sent` | 전송 데이터량 (파일 크기 반영) | - |
| `data_received` | 수신 데이터량 | - |
| `iteration_duration` | sleep 포함 반복 소요 시간 | - |

### 6.3 파일 크기별 테스트

서로 다른 크기의 Excel 파일로 성능 차이를 측정합니다:

| 파일 | 행 수 | 예상 크기 | 용도 |
|------|------|-----------|------|
| small.xlsx | 10행 | ~5KB | 기본 기능 테스트 |
| medium.xlsx | 100행 | ~20KB | 일반적인 운영 사용량 |
| large.xlsx | 1,000행 | ~100KB | 대량 지급 시나리오 |
| max.xlsx | 5,000행 | ~500KB | 최대 부하 시나리오 |

---

## 7. 인증 처리

일괄지급 API는 세션 기반 인증이 필요합니다. K6에서 인증을 처리하는 방법:

### 7.1 amIdx 파라미터 사용

세션 없이 `amIdx` 파라미터로 관리자를 식별하는 방식:

```javascript
const payload = {
  file: http.file(testFile, 'test.xlsx', 'application/...'),
  amIdx: '1',  // 관리자 ID
  dryRun: 'true',
};
```

### 7.2 세션 로그인 후 쿠키 전달

K6의 `http.CookieJar`를 활용하여 로그인 세션을 유지하는 방식:

```javascript
import http from 'k6/http';
import { check } from 'k6';

export function setup() {
  // 로그인 요청
  const loginRes = http.post('https://dev3.admin.store5000.com/admin/login', {
    id: 'test_admin',
    password: 'test_password',
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });

  // 쿠키 반환 (세션 ID)
  const cookies = loginRes.cookies;
  return { cookies };
}

export default function (data) {
  // 쿠키 설정
  const jar = http.cookieJar();
  for (const [name, values] of Object.entries(data.cookies)) {
    for (const cookie of values) {
      jar.set(cookie.domain, name, cookie.value);
    }
  }

  // 인증된 상태로 API 호출
  const payload = {
    file: http.file(testFile, 'test.xlsx', 'application/...'),
    dryRun: 'true',
  };

  const res = http.post(
    'https://dev3.admin.store5000.com/admin/bulk-payment/execute',
    payload
  );
  // ...
}
```

---

## 8. 트러블슈팅

### 자주 발생하는 문제

| 문제 | 원인 | 해결 |
|------|------|------|
| `open() can only be called in init context` | VU 함수 내부에서 open() 호출 | open()을 스크립트 최상위 스코프로 이동 |
| `LIMIT_FILE_SIZE` 에러 | 업로드 파일이 10MB 초과 | 테스트 파일 크기를 10MB 이하로 조정 |
| `xlsx 파일만 업로드 가능합니다` | 파일 MIME 타입 불일치 | http.file()의 세 번째 인자에 올바른 MIME 타입 지정 |
| `Another bulk payment is in progress` | MySQL 락 경합 | VU 수를 줄이거나, dryRun=true 사용 |
| `파일이 비어있습니다` | 파일 경로가 잘못됨 | Docker 볼륨 마운트 확인, 경로 확인 |
| 인증 실패 (401) | 세션 없음, amIdx 미전달 | amIdx 파라미터 추가 또는 로그인 세션 설정 |

---

## 9. 참고 자료

- [K6 공식 문서 - Multipart requests](https://grafana.com/docs/k6/latest/examples/data-uploads/)
- [K6 공식 문서 - http.file()](https://grafana.com/docs/k6/latest/javascript-api/k6-http/file/)
- [K6 공식 문서 - open()](https://grafana.com/docs/k6/latest/javascript-api/init-context/open/)
- [K6 공식 문서 - http.post()](https://grafana.com/docs/k6/latest/javascript-api/k6-http/post/)
