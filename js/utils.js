// 비밀번호를 그대로 저장하지 않고 SHA-256 해시로 저장/비교합니다.
export async function hashPassword(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// imgbb(무료, 카드 필요 없음)에 이미지를 업로드하고 공개 URL을 돌려줍니다.
export async function uploadImageToImgbb(file, apiKey) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: "POST",
    body: formData,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || "이미지 업로드에 실패했어요.");
  }
  return json.data.url;
}

// Firestore 문서 id로부터 사람이 읽기 좋은 견본 코드를 만듭니다. 예: FH-3F9A
export function swatchCode(id) {
  return "FH-" + id.slice(0, 4).toUpperCase();
}

export function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function statusLabel(post) {
  if (post.status === "완료") return "견적완료";
  return post.isPublic ? "접수중" : "접수중 · 비공개";
}

export function statusClass(post) {
  if (post.status === "완료") return "status-done";
  if (!post.isPublic) return "status-private";
  return "status-open";
}

export function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
