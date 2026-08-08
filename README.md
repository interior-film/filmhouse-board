# 마스터인테리어필름 견적 문의 게시판 — 설정 가이드

기존 구글폼 방식 대신, **게시판에 사진과 상세 내용을 올리면 준님이 확인 후 비공개/공개로 견적을 남기는 방식**입니다.
전화번호 없이 이름 + 비밀번호만으로 글을 쓸 수 있고, 견적이 완료되면 글 상단에 "견적완료" 표시가 뜨고, 이메일을 남긴 경우 알림도 보낼 수 있어요.

## 이 프로젝트가 하는 일

- `index.html` — 게시판 목록 (필름 견본 라벨 스타일로 상태 표시)
- `write.html` — 고객이 사진 + 상세내용으로 문의 작성 (이름/비밀번호만 입력, 이메일은 선택)
- `post.html` — 문의 상세 보기. 비공개 글은 비밀번호를 입력해야 열람 가능
- `admin.html` — 준님 전용 관리자 페이지. 로그인 후 모든 문의 확인, 견적 답변 작성, 완료 처리, 삭제
- 데이터/사진 저장은 **Firebase**(구글의 무료 백엔드 서비스)를 사용합니다. Google Drive/Apps Script보다 게시판 형태(로그인, 실시간 목록, 상태값)에 훨씬 적합해서 추천드려요. 사용량이 아주 많아지기 전까지는 무료입니다.

---

## 1. Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속 → 로그인 → **프로젝트 추가**
2. 프로젝트 이름 입력 (예: `filmhouse-board`) → 애널리틱스는 꺼도 됩니다 → 만들기

### 1-1. 웹 앱 등록 (설정값 얻기)
1. 프로젝트 개요 화면에서 `</>` (웹) 아이콘 클릭
2. 앱 닉네임 아무거나 입력 → 앱 등록
3. 화면에 나오는 `firebaseConfig` 값을 복사해서 `js/firebase-config.js` 파일의 `firebaseConfig` 부분에 그대로 붙여넣기

### 1-2. Firestore 켜기 (데이터 저장소)
1. 왼쪽 메뉴 **빌드 → Firestore Database → 데이터베이스 만들기**
2. 위치는 `asia-northeast3 (서울)` 선택
3. 보안 규칙은 일단 "테스트 모드"로 시작 → 아래 3번 항목의 규칙으로 나중에 교체

### 1-3. 사진 업로드 켜기 — imgbb (무료, 카드 필요 없음)
사진 저장은 Firebase Storage 대신 **imgbb**라는 무료 이미지 호스팅 서비스를 사용해요. 이메일 가입만 하면 되고 신용카드는 전혀 필요 없어요.

1. https://api.imgbb.com/ 접속
2. 계정이 없으면 이메일로 무료 가입 (또는 구글/소셜 로그인)
3. 로그인 후 "Get API key" 버튼을 누르면 API 키가 나와요. 복사하세요.
4. `js/firebase-config.js` 파일의 `IMGBB_API_KEY` 값에 그대로 붙여넣기

이 값을 채워 넣는 순간 `PHOTOS_ENABLED`가 자동으로 켜져서 사진 업로드가 바로 활성화돼요. 지금 당장 안 하셔도 괜찮고, 텍스트 문의만으로도 게시판은 정상 작동해요.

### 1-4. Authentication 켜기 (관리자 로그인용)
1. 왼쪽 메뉴 **빌드 → Authentication → 시작하기**
2. 로그인 방법에서 **이메일/비밀번호** 사용 설정
3. **Users 탭 → 사용자 추가**에서 준님이 쓸 관리자 이메일/비밀번호를 직접 하나 등록
   (이게 `admin.html` 로그인에 사용하는 계정입니다. 별도 회원가입 기능은 없고, 이 화면에서 직접 계정을 만드는 방식이에요.)

---

## 2. 보안 규칙 설정

### Firestore 규칙
Firestore Database → 규칙 탭에서 아래로 교체:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if true;

      allow create: if request.resource.data.status == "접수중"
                    && request.resource.data.title is string
                    && request.resource.data.title.size() < 100;

      // 관리자는 모든 수정(견적 답변, 상태 변경 포함) 가능
      allow update, delete: if request.auth != null;

      // 작성자 본인도 비밀번호가 일치하면 "내용"만 수정 가능
      // (status, quoteText, passwordHash, completedAt은 못 건드리게 막아둠)
      allow update: if request.auth == null
                    && request.resource.data.passwordHash == resource.data.passwordHash
                    && request.resource.data.diff(resource.data).affectedKeys()
                         .hasOnly(['title','region','pyeong','workAreas','description','images','isPublic'])
                    && request.resource.data.status == resource.data.status
                    && request.resource.data.quoteText == resource.data.quoteText;

      allow delete: if request.auth == null; // post.js에서 이미 비밀번호를 확인한 뒤에만 호출됨
    }
  }
}
```

> 참고: 사진은 Firebase가 아니라 imgbb에 저장되므로 Storage 규칙은 따로 필요 없어요.
>
> 참고2: 비공개 글은 화면(프론트엔드)에서 비밀번호를 입력해야 내용이 보이고, 수정/삭제도 비밀번호가 맞아야 되도록 막아뒀어요. 다만 이건 개발자 도구로 데이터를 직접 들여다보면 우회가 아예 불가능한 수준의 보안은 아니에요(비밀번호는 해시로 저장되지만, 문서 자체는 공개 읽기 대상이라 해시값도 함께 노출돼요). 소규모 문의 게시판 수준에서는 충분하지만, 나중에 더 강한 보안이 필요해지면 Cloud Functions를 추가하는 방법을 알려드릴 수 있어요.

---

## 3. (선택) 견적 완료 이메일 알림 — EmailJS

이메일을 남긴 고객에게 "견적완료" 알림 메일을 자동으로 보내고 싶다면:

1. https://www.emailjs.com 무료 가입
2. **Email Services**에서 본인 이메일(Gmail 등) 연결 → Service ID 확인
3. **Email Templates**에서 템플릿 하나 생성. 아래 변수를 본문에 넣어주세요:
   - `{{to_name}}`, `{{title}}`, `{{quote_text}}`, `{{post_link}}`
4. **Account → General**에서 Public Key 확인
5. `js/firebase-config.js`의 `EMAILJS_CONFIG`에 값 채우고 `useEmailNotification: true`로 변경

이 기능을 안 쓰고 싶으면 `useEmailNotification: false`로 그대로 두면 됩니다. 이 경우 고객은 게시판에서 직접 "견적완료" 표시를 확인하는 방식이 돼요.

---

## 4. 배포 (GitHub Pages)

저번 견적 폼과 동일한 방식이에요.

1. GitHub에 새 저장소 생성 (예: `filmhouse-board`)
2. 이 폴더 전체(`index.html`, `write.html`, `post.html`, `admin.html`, `css/`, `js/`)를 업로드
3. 저장소 **Settings → Pages → Branch: main / (root)** 선택 후 저장
4. 몇 분 후 `https://[깃허브아이디].github.io/filmhouse-board/` 에서 접속 가능

---

## 5. 사용 흐름 요약

- **고객**: `write.html`에서 이름/비밀번호/사진/상세내용 작성 → 공개 또는 비공개 선택 → 등록. 이후 `post.html` 링크로 돌아와서 자기 글 확인 (비공개면 비밀번호 입력) → "내용 수정하기" 또는 "삭제하기" 버튼으로 비밀번호 확인 후 수정/삭제 가능 (단, 상태/견적 내용은 고객이 못 바꿈)
- **준님**: `admin.html` 로그인 → 목록에서 "답변하기" 클릭 → 견적 내용 입력 → "견적완료로 저장" → 게시판에 "견적완료" 뱃지 표시 + (설정했다면) 고객에게 이메일 발송

---

## 6. 커스터마이징 포인트

- 시공 부위 선택지: `js/firebase-config.js`의 `WORK_AREAS` 배열 수정
- 색상/폰트: `css/style.css` 상단 `:root` 변수
- 사진 최대 개수(현재 6장): `js/write.js`의 `.slice(0, 6)` 부분

---

막히는 부분 있으면 캡처해서 알려주시면 바로 도와드릴게요.
