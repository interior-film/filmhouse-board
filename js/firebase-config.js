// ⚠️ 이 파일에 본인의 Firebase / EmailJS 값을 채워 넣으세요.
// 값을 구하는 방법은 README.md의 "1. Firebase 프로젝트 만들기"를 참고하세요.

export const firebaseConfig = {
  apiKey: "AIzaSyBZVh2wuiMHATWwCQOMiySfTtszYsx7FzE",
  authDomain: "filmhouse-board.firebaseapp.com",
  projectId: "filmhouse-board",
  storageBucket: "filmhouse-board.firebasestorage.app",
  messagingSenderId: "949145703057",
  appId: "1:949145703057:web:909c08069c4a316c27e530",
  measurementId: "G-CH8RXJ7MTN",
};

// 견적 완료 시 이메일 알림을 보내고 싶다면 EmailJS(무료)를 사용합니다.
// 사용하지 않으려면 useEmailNotification 을 false로 두세요.
export const EMAILJS_CONFIG = {
  useEmailNotification: false,
  publicKey: "YOUR_EMAILJS_PUBLIC_KEY",
  serviceId: "YOUR_EMAILJS_SERVICE_ID",
  templateId: "YOUR_EMAILJS_TEMPLATE_ID",
};

// 시공 부위 선택지 - 필요하면 자유롭게 수정하세요.
export const WORK_AREAS = [
  "몰딩", "걸레받이", "문/문틀", "가구/붙박이장", "싱크대", "샤시/창틀", "기타",
];

// 사진 업로드 기능 스위치입니다.
// Firebase Storage를 아직 안 켰다면 false로 두세요 (사진 없이 글만 등록/수정 가능).
// 나중에 Storage를 켜고 나면 true로 바꾸면 사진 업로드가 바로 활성화돼요.
export const PHOTOS_ENABLED = false;
