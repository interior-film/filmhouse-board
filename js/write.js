import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig, WORK_AREAS, PHOTOS_ENABLED } from "./firebase-config.js";
import { hashPassword } from "./utils.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// 시공 부위 chip 렌더링
const workAreasEl = document.getElementById("workAreas");
WORK_AREAS.forEach((area) => {
  const label = document.createElement("label");
  label.className = "chip";
  label.innerHTML = `<input type="checkbox" value="${area}" /><span>${area}</span>`;
  label.querySelector("input").addEventListener("change", (e) => {
    label.classList.toggle("checked", e.target.checked);
  });
  workAreasEl.appendChild(label);
});

// 사진 선택 / 미리보기
const photoInput = document.getElementById("photoInput");
const photoDrop = document.getElementById("photoDrop");
const photoPreview = document.getElementById("photoPreview");
let selectedFiles = [];

if (PHOTOS_ENABLED) {
  photoDrop.addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", () => {
    const files = Array.from(photoInput.files).slice(0, 6);
    selectedFiles = files;
    photoPreview.innerHTML = "";
    files.forEach((file) => {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      photoPreview.appendChild(img);
    });
  });
} else {
  photoDrop.textContent = "사진 업로드는 준비 중이에요 (곧 추가돼요) — 지금은 사진 없이 등록돼요";
  photoDrop.style.cursor = "default";
  photoDrop.style.opacity = "0.6";
}

const form = document.getElementById("writeForm");
const submitBtn = document.getElementById("submitBtn");
const formError = document.getElementById("formError");

function showError(msg) {
  formError.textContent = msg;
  formError.style.display = "block";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.style.display = "none";

  const authorName = document.getElementById("authorName").value.trim();
  const password = document.getElementById("password").value;
  const email = document.getElementById("email").value.trim();
  const title = document.getElementById("title").value.trim();
  const region = document.getElementById("region").value.trim();
  const pyeong = document.getElementById("pyeong").value.trim();
  const description = document.getElementById("description").value.trim();
  const isPublic = document.querySelector('input[name="visibility"]:checked').value === "public";
  const workAreas = Array.from(workAreasEl.querySelectorAll("input:checked")).map((i) => i.value);

  if (!authorName || !password || !title || !description) {
    showError("이름, 비밀번호, 제목, 상세 요청사항은 필수예요.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "등록 중…";

  try {
    const passwordHash = await hashPassword(password);

    // 이미지 업로드
    const imageUrls = [];
    for (const file of selectedFiles) {
      const path = `posts/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      imageUrls.push(url);
    }

    await addDoc(collection(db, "posts"), {
      authorName,
      passwordHash,
      email: email || null,
      title,
      region: region || null,
      pyeong: pyeong || null,
      workAreas,
      description,
      images: imageUrls,
      isPublic,
      status: "접수중",
      quoteText: null,
      createdAt: serverTimestamp(),
      completedAt: null,
    });

    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
    showError("등록 중 오류가 발생했어요. firebase-config.js 설정을 확인하거나 잠시 후 다시 시도해주세요.");
    submitBtn.disabled = false;
    submitBtn.textContent = "문의 등록하기";
  }
});
