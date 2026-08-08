import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { swatchCode, formatDate, statusLabel, statusClass, escapeHtml } from "./utils.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const grid = document.getElementById("grid");
const countNote = document.getElementById("countNote");
const emptyState = document.getElementById("emptyState");

async function loadPosts() {
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    if (snap.empty) {
      countNote.textContent = "총 0건의 문의";
      emptyState.style.display = "block";
      return;
    }

    countNote.textContent = `총 ${snap.size}건의 문의`;
    grid.innerHTML = "";

    snap.forEach((docSnap) => {
      const post = docSnap.data();
      const id = docSnap.id;
      const isPrivate = post.isPublic === false;
      const thumb = !isPrivate && post.images && post.images[0] ? post.images[0] : null;

      const card = document.createElement("a");
      card.href = `post.html?id=${id}`;
      card.className = "card";
      card.innerHTML = `
        <div class="thumb" style="${thumb ? `background-image:url('${thumb}')` : ""}">
          <span class="tag-corner swatch-tag ${statusClass(post)}">${statusLabel(post)}</span>
          ${!thumb ? (isPrivate ? "비공개 문의" : "사진 없음") : ""}
        </div>
        <div class="body">
          <div class="title">${escapeHtml(isPrivate ? "비공개 문의" : (post.title || "제목 없음"))}</div>
          <div class="meta">
            ${post.region ? `<span>${escapeHtml(post.region)}</span>` : ""}
            ${post.workAreas && post.workAreas.length ? `<span>${escapeHtml(post.workAreas.join(", "))}</span>` : ""}
          </div>
          <div class="foot">
            <span class="mono">${swatchCode(id)}</span>
            <span>${formatDate(post.createdAt)}</span>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    countNote.textContent = "불러오는 중 오류가 발생했어요. firebase-config.js 설정을 확인해주세요.";
  }
}

loadPosts();
