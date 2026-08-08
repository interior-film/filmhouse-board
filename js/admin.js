import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig, EMAILJS_CONFIG } from "./firebase-config.js";
import { swatchCode, formatDate, statusLabel, statusClass, escapeHtml } from "./utils.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

if (EMAILJS_CONFIG.useEmailNotification && window.emailjs) {
  window.emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
}

const loginPanel = document.getElementById("loginPanel");
const adminList = document.getElementById("adminList");
const logoutBtn = document.getElementById("logoutBtn");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const rowsEl = document.getElementById("rows");
const adminCount = document.getElementById("adminCount");
const modalRoot = document.getElementById("modalRoot");

loginBtn.addEventListener("click", async () => {
  loginError.style.display = "none";
  const email = document.getElementById("adminEmail").value.trim();
  const pw = document.getElementById("adminPw").value;
  try {
    await signInWithEmailAndPassword(auth, email, pw);
  } catch (err) {
    loginError.textContent = "로그인에 실패했어요. 이메일/비밀번호를 확인해주세요.";
    loginError.style.display = "block";
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginPanel.style.display = "none";
    adminList.style.display = "block";
    logoutBtn.style.display = "inline-flex";
    loadPosts();
  } else {
    loginPanel.style.display = "block";
    adminList.style.display = "none";
    logoutBtn.style.display = "none";
  }
});

let cachedDocs = [];

async function loadPosts() {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  cachedDocs = snap.docs;
  adminCount.textContent = `총 ${snap.size}건`;
  rowsEl.innerHTML = "";

  snap.forEach((docSnap) => {
    const post = docSnap.data();
    const id = docSnap.id;
    const thumb = post.images && post.images[0] ? post.images[0] : null;

    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div class="thumb-sm" style="${thumb ? `background-image:url('${thumb}')` : "background:var(--paper-deep)"}"></div>
      <div>
        <div style="font-weight:700">${escapeHtml(post.title)} ${post.isPublic === false ? "🔒" : ""}</div>
        <div class="meta mono" style="font-size:11px;color:#8a7a63">${swatchCode(id)} · ${escapeHtml(post.authorName)} · ${formatDate(post.createdAt)}</div>
      </div>
      <span class="swatch-tag ${statusClass(post)}" style="justify-self:start">${statusLabel(post)}</span>
      <div style="display:flex;gap:6px;justify-self:end">
        <button class="btn small" data-open="${id}">답변하기</button>
        <button class="btn small clay" data-del="${id}">삭제</button>
      </div>
    `;
    rowsEl.appendChild(row);
  });

  rowsEl.querySelectorAll("[data-open]").forEach((btn) =>
    btn.addEventListener("click", () => openModal(btn.dataset.open))
  );
  rowsEl.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", () => handleDelete(btn.dataset.del))
  );
}

function findPost(id) {
  const d = cachedDocs.find((d) => d.id === id);
  return d ? { id, ...d.data() } : null;
}

function openModal(id) {
  const post = findPost(id);
  if (!post) return;
  const images = post.images || [];

  modalRoot.innerHTML = `
    <div class="lightbox" id="modalOverlay">
      <div class="panel" style="max-width:560px;max-height:85vh;overflow:auto;text-align:left" onclick="event.stopPropagation()">
        <h2 style="margin-bottom:6px">${escapeHtml(post.title)}</h2>
        <div class="mono" style="font-size:12px;color:#8a7a63;margin-bottom:14px">
          ${swatchCode(id)} · ${escapeHtml(post.authorName)} · ${post.email ? escapeHtml(post.email) : "이메일 미입력"} · ${post.region ? escapeHtml(post.region) : ""} ${post.pyeong ? escapeHtml(post.pyeong) : ""}
        </div>
        ${images.length ? `<div class="gallery">${images.map((u) => `<img src="${u}" />`).join("")}</div>` : ""}
        <div class="detail-block"><h3>상세 요청사항</h3><p>${escapeHtml(post.description)}</p></div>

        <div class="field">
          <label>견적 답변</label>
          <textarea id="quoteInput">${post.quoteText ? escapeHtml(post.quoteText) : ""}</textarea>
        </div>

        <div class="form-footer">
          <button class="btn" id="closeModalBtn">닫기</button>
          <button class="btn sage" id="saveQuoteBtn">견적완료로 저장</button>
        </div>
        <div id="modalMsg" class="hint" style="margin-top:8px"></div>
      </div>
    </div>
  `;

  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") modalRoot.innerHTML = "";
  });
  document.getElementById("closeModalBtn").addEventListener("click", () => (modalRoot.innerHTML = ""));
  document.getElementById("saveQuoteBtn").addEventListener("click", () => saveQuote(id, post));
}

async function saveQuote(id, post) {
  const quoteText = document.getElementById("quoteInput").value.trim();
  const msgEl = document.getElementById("modalMsg");
  if (!quoteText) {
    msgEl.textContent = "견적 내용을 입력해주세요.";
    return;
  }
  msgEl.textContent = "저장 중…";

  try {
    await updateDoc(doc(db, "posts", id), {
      quoteText,
      status: "완료",
      completedAt: serverTimestamp(),
    });

    if (EMAILJS_CONFIG.useEmailNotification && post.email && window.emailjs) {
      try {
        await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
          to_email: post.email,
          to_name: post.authorName,
          title: post.title,
          quote_text: quoteText,
          post_link: `${location.origin}${location.pathname.replace("admin.html", "")}post.html?id=${id}`,
        });
        msgEl.textContent = "저장 완료! 알림 이메일도 발송했어요.";
      } catch (mailErr) {
        console.error(mailErr);
        msgEl.textContent = "저장은 됐지만 이메일 발송에 실패했어요.";
      }
    } else {
      msgEl.textContent = "저장 완료!";
    }

    setTimeout(() => {
      modalRoot.innerHTML = "";
      loadPosts();
    }, 700);
  } catch (err) {
    console.error(err);
    msgEl.textContent = "저장 중 오류가 발생했어요.";
  }
}

async function handleDelete(id) {
  if (!confirm("이 문의를 삭제할까요? 되돌릴 수 없어요.")) return;
  await deleteDoc(doc(db, "posts", id));
  loadPosts();
}
