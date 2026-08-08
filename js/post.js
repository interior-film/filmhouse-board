import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig, WORK_AREAS, PHOTOS_ENABLED } from "./firebase-config.js";
import { hashPassword, swatchCode, formatDate, statusLabel, statusClass, escapeHtml } from "./utils.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

const content = document.getElementById("content");
const params = new URLSearchParams(location.search);
const postId = params.get("id");

let isAdmin = false;
let post = null;

function renderNotFound() {
  content.innerHTML = `<div class="empty-state">문의를 찾을 수 없어요. 삭제되었거나 잘못된 링크예요.</div>`;
}

function renderGate() {
  content.innerHTML = `
    <div class="gate">
      <div class="lock">🔒</div>
      <h2>비공개 문의예요</h2>
      <p>작성 시 입력한 비밀번호를 입력하면 확인할 수 있어요.</p>
      <form id="gateForm">
        <input type="password" id="gatePw" placeholder="비밀번호" required />
        <button class="btn primary" type="submit">확인</button>
      </form>
      <div id="gateError" class="error-text" style="display:none">비밀번호가 일치하지 않아요.</div>
    </div>
  `;
  document.getElementById("gateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = document.getElementById("gatePw").value;
    const h = await hashPassword(pw);
    if (h === post.passwordHash) {
      sessionStorage.setItem(`unlock_${postId}`, "1");
      renderFull();
    } else {
      document.getElementById("gateError").style.display = "block";
    }
  });
}

function renderFull() {
  const images = post.images || [];
  const gallery = images.length
    ? `<div class="gallery">${images.map((url) => `<img src="${url}" data-full="${url}" />`).join("")}</div>`
    : "";

  const metaBits = [
    post.region ? escapeHtml(post.region) : null,
    post.pyeong ? escapeHtml(post.pyeong) : null,
    post.workAreas && post.workAreas.length ? escapeHtml(post.workAreas.join(", ")) : null,
  ].filter(Boolean).join(" · ");

  let quoteHtml;
  if (post.status === "완료" && post.quoteText) {
    quoteHtml = `
      <div class="quote-block">
        <h3>✅ 견적 안내</h3>
        <p style="white-space:pre-wrap">${escapeHtml(post.quoteText)}</p>
        ${post.completedAt ? `<div class="hint" style="margin-top:8px">${formatDate(post.completedAt)} 답변</div>` : ""}
      </div>`;
  } else {
    quoteHtml = `<div class="quote-block pending"><h3>견적 준비 중</h3><p>확인 후 빠르게 답변드릴게요.</p></div>`;
  }

  content.innerHTML = `
    <div class="post-head">
      <span class="swatch-tag ${statusClass(post)}">${statusLabel(post)}</span>
      <h2 class="post-title" style="margin-top:10px">${escapeHtml(post.title)}</h2>
      <div class="post-meta-row">
        <span class="mono">${swatchCode(postId)}</span>
        <span>${escapeHtml(post.authorName)}</span>
        <span>${formatDate(post.createdAt)}</span>
        ${metaBits ? `<span>${metaBits}</span>` : ""}
      </div>
    </div>
    ${gallery}
    <div class="detail-block">
      <h3>상세 요청사항</h3>
      <p>${escapeHtml(post.description)}</p>
    </div>
    ${quoteHtml}
    <div class="form-footer" style="justify-content:flex-start;margin-top:18px">
      <button class="btn" id="editBtn">✏️ 내용 수정하기</button>
      <button class="btn clay" id="deleteBtn">삭제하기</button>
    </div>
  `;

  content.querySelectorAll(".gallery img").forEach((img) => {
    img.addEventListener("click", () => {
      const box = document.createElement("div");
      box.className = "lightbox";
      box.innerHTML = `<img src="${img.dataset.full}" />`;
      box.addEventListener("click", () => box.remove());
      document.body.appendChild(box);
    });
  });

  document.getElementById("editBtn").addEventListener("click", () => {
    requestPasswordThen(renderEditForm);
  });
  document.getElementById("deleteBtn").addEventListener("click", () => {
    requestPasswordThen(handleDelete);
  });
}

// 관리자는 바로 통과, 아니면 비밀번호 확인 모달을 띄운 뒤 콜백 실행
function requestPasswordThen(callback) {
  if (isAdmin) { callback(); return; }

  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `
    <div class="panel" style="max-width:320px;text-align:center" onclick="event.stopPropagation()">
      <h3 style="margin-bottom:10px">비밀번호 확인</h3>
      <p class="hint" style="margin-bottom:12px">작성 시 입력한 비밀번호를 입력해주세요.</p>
      <form id="pwCheckForm" style="display:flex;gap:8px">
        <input type="password" id="pwCheckInput" required style="flex:1" />
        <button class="btn primary" type="submit">확인</button>
      </form>
      <div id="pwCheckError" class="error-text" style="display:none;margin-top:8px">비밀번호가 일치하지 않아요.</div>
    </div>
  `;
  box.addEventListener("click", (e) => { if (e.target === box) box.remove(); });
  document.body.appendChild(box);

  document.getElementById("pwCheckForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = document.getElementById("pwCheckInput").value;
    const h = await hashPassword(pw);
    if (h === post.passwordHash) {
      box.remove();
      callback();
    } else {
      document.getElementById("pwCheckError").style.display = "block";
    }
  });
}

let keptImages = [];
let newFiles = [];

function renderEditForm() {
  keptImages = [...(post.images || [])];
  newFiles = [];

  const chipsHtml = WORK_AREAS.map((area) => {
    const checked = post.workAreas && post.workAreas.includes(area);
    return `<label class="chip${checked ? " checked" : ""}"><input type="checkbox" value="${area}" ${checked ? "checked" : ""} /><span>${area}</span></label>`;
  }).join("");

  content.innerHTML = `
    <form class="panel" id="editForm">
      <h2 style="margin-bottom:16px">문의 수정</h2>
      <div class="field">
        <label>제목</label>
        <input type="text" id="editTitle" required maxlength="60" value="${escapeHtml(post.title)}" />
      </div>
      <div class="row2">
        <div class="field"><label>지역</label><input type="text" id="editRegion" value="${escapeHtml(post.region || "")}" /></div>
        <div class="field"><label>평수</label><input type="text" id="editPyeong" value="${escapeHtml(post.pyeong || "")}" /></div>
      </div>
      <div class="field">
        <label>시공 부위</label>
        <div class="chip-group" id="editWorkAreas">${chipsHtml}</div>
      </div>
      <div class="field">
        <label>상세 요청사항</label>
        <textarea id="editDescription" required>${escapeHtml(post.description)}</textarea>
      </div>
      <div class="field">
        <label>사진</label>
        <div class="photo-preview" id="editPreview"></div>
        <input type="file" id="editPhotoInput" accept="image/*" multiple hidden />
        <div class="photo-drop" id="editPhotoDrop" style="margin-top:10px">${PHOTOS_ENABLED ? "클릭해서 사진 추가" : "사진 업로드는 준비 중이에요 (곧 추가돼요)"}</div>
      </div>
      <div class="field">
        <label>공개 범위</label>
        <div class="radio-toggle">
          <label><input type="radio" name="editVisibility" value="public" ${post.isPublic !== false ? "checked" : ""} /><span>공개</span></label>
          <label><input type="radio" name="editVisibility" value="private" ${post.isPublic === false ? "checked" : ""} /><span>비공개</span></label>
        </div>
      </div>
      <div id="editError" class="error-text" style="display:none"></div>
      <div class="form-footer">
        <button type="button" class="btn" id="cancelEditBtn">취소</button>
        <button type="submit" class="btn primary" id="saveEditBtn">저장하기</button>
      </div>
    </form>
  `;

  document.getElementById("editWorkAreas").querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", (e) => e.target.closest(".chip").classList.toggle("checked", e.target.checked));
  });

  renderEditPreview();
  const dropEl = document.getElementById("editPhotoDrop");
  const inputEl = document.getElementById("editPhotoInput");
  if (PHOTOS_ENABLED) {
    dropEl.addEventListener("click", () => inputEl.click());
    inputEl.addEventListener("change", () => {
      const room = 6 - keptImages.length - newFiles.length;
      newFiles.push(...Array.from(inputEl.files).slice(0, Math.max(room, 0)));
      inputEl.value = "";
      renderEditPreview();
    });
  } else {
    dropEl.style.cursor = "default";
    dropEl.style.opacity = "0.6";
  }

  document.getElementById("cancelEditBtn").addEventListener("click", () => renderFull());
  document.getElementById("editForm").addEventListener("submit", saveEdit);
}

function renderEditPreview() {
  const wrap = document.getElementById("editPreview");
  wrap.innerHTML = "";
  keptImages.forEach((url, i) => {
    const box = document.createElement("div");
    box.style.position = "relative";
    box.innerHTML = `<img src="${url}" /><button type="button" data-kept="${i}" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:var(--clay);color:#fff;cursor:pointer;font-size:12px;line-height:1">×</button>`;
    wrap.appendChild(box);
  });
  newFiles.forEach((file, i) => {
    const box = document.createElement("div");
    box.style.position = "relative";
    box.innerHTML = `<img src="${URL.createObjectURL(file)}" /><button type="button" data-new="${i}" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:var(--clay);color:#fff;cursor:pointer;font-size:12px;line-height:1">×</button>`;
    wrap.appendChild(box);
  });
  wrap.querySelectorAll("[data-kept]").forEach((b) =>
    b.addEventListener("click", () => { keptImages.splice(+b.dataset.kept, 1); renderEditPreview(); })
  );
  wrap.querySelectorAll("[data-new]").forEach((b) =>
    b.addEventListener("click", () => { newFiles.splice(+b.dataset.new, 1); renderEditPreview(); })
  );
}

async function saveEdit(e) {
  e.preventDefault();
  const errEl = document.getElementById("editError");
  errEl.style.display = "none";
  const saveBtn = document.getElementById("saveEditBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "저장 중…";

  try {
    const uploaded = [];
    for (const file of newFiles) {
      const path = `posts/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      uploaded.push(await getDownloadURL(fileRef));
    }

    const workAreas = Array.from(document.getElementById("editWorkAreas").querySelectorAll("input:checked")).map((i) => i.value);

    const updated = {
      title: document.getElementById("editTitle").value.trim(),
      region: document.getElementById("editRegion").value.trim() || null,
      pyeong: document.getElementById("editPyeong").value.trim() || null,
      description: document.getElementById("editDescription").value.trim(),
      workAreas,
      images: [...keptImages, ...uploaded],
      isPublic: document.querySelector('input[name="editVisibility"]:checked').value === "public",
    };

    await updateDoc(doc(db, "posts", postId), updated);
    post = { ...post, ...updated };
    renderFull();
  } catch (err) {
    console.error(err);
    errEl.textContent = "저장 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
    errEl.style.display = "block";
    saveBtn.disabled = false;
    saveBtn.textContent = "저장하기";
  }
}

async function handleDelete() {
  if (!confirm("정말 삭제할까요? 되돌릴 수 없어요.")) return;
  await deleteDoc(doc(db, "posts", postId));
  location.href = "index.html";
}

async function load() {
  if (!postId) { renderNotFound(); return; }
  const snap = await getDoc(doc(db, "posts", postId));
  if (!snap.exists()) { renderNotFound(); return; }
  post = snap.data();

  const unlocked = sessionStorage.getItem(`unlock_${postId}`) === "1";
  if (post.isPublic !== false || isAdmin || unlocked) {
    renderFull();
  } else {
    renderGate();
  }
}

onAuthStateChanged(auth, (user) => {
  isAdmin = !!user;
  if (post) {
    // 로그인 상태가 늦게 확정된 경우 다시 렌더링
    if (isAdmin) renderFull();
  }
});

load();
