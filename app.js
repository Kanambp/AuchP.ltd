const $ = (s) => document.querySelector(s);
let allDocuments = [];
let selectedDocument = null;
$("#year").textContent = new Date().getFullYear();
$("#menuToggle").addEventListener("click", () => $("#navLinks").classList.toggle("open"));
$("#navLinks").querySelectorAll("a").forEach(a => a.addEventListener("click", () => $("#navLinks").classList.remove("open")));

const subjectMap = {
  "Play Group–PP2": ["EYE activity papers"],
  "Grade 1–3": ["Mathematics", "English", "Kiswahili", "Environmental Activities", "Creative Arts"],
  "Grade 4–6": ["Mathematics", "Kiswahili", "English", "Creative Arts", "Social Studies", "Agriculture and Nutrition", "Science and Technology", "CRE"],
  "Grade 7–9": ["Mathematics", "English Paper 1", "English Paper 2", "Kiswahili Paper 1", "Kiswahili Paper 2", "Integrated Science", "CRE", "Pretechnical Studies", "Agriculture and Nutrition", "Creative Arts", "Social Studies"]
};
const prices = {"Play Group–PP2":30,"Grade 1–3":45,"Grade 4–6":55,"Grade 7–9":90};

function updateSubjectFilter() {
  const level = $("#levelFilter").value;
  const options = level ? (subjectMap[level] || []) : [...new Set(Object.values(subjectMap).flat())];
  $("#subjectFilter").innerHTML = '<option value="">All subjects</option>' + options.map(s => `<option>${escapeHtml(s)}</option>`).join("");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function renderPapers() {
  const level = $("#levelFilter").value, subject = $("#subjectFilter").value;
  const search = $("#searchFilter").value.trim().toLowerCase();
  const rows = allDocuments.filter(d => (!level || d.level === level) && (!subject || d.subject === subject) &&
    (!search || `${d.title} ${d.subject} ${d.description}`.toLowerCase().includes(search)));
  $("#paperList").innerHTML = rows.length ? rows.map(d => `
    <article class="paper-item"><div><h4>${escapeHtml(d.title)}</h4><div class="paper-meta">${escapeHtml(d.level)} · ${escapeHtml(d.subject)} · ${escapeHtml(d.paper_type)}</div>
    ${d.description ? `<div class="paper-meta">${escapeHtml(d.description)}</div>` : ""}<button class="btn btn-primary order-btn" data-id="${d.id}">Order paper</button></div>
    <div class="paper-price">KSh ${Number(d.price_kes).toLocaleString("en-KE")}</div></article>`).join("") : '<div class="empty-state">No papers match your filters yet. Please check back later or contact AuchP.ltd.</div>';
  document.querySelectorAll(".order-btn").forEach(btn => btn.addEventListener("click", () => openCheckout(Number(btn.dataset.id))));
}
async function loadPapers() {
  try {
    const response = await fetch("/api/documents");
    allDocuments = await response.json();
    renderPapers();
  } catch {
    $("#paperList").innerHTML = '<div class="empty-state">The catalogue is temporarily unavailable. Please try again later.</div>';
  }
}
function openCheckout(id) {
  selectedDocument = allDocuments.find(d => d.id === id);
  if (!selectedDocument) return;
  $("#checkoutDocument").value = id;
  $("#checkoutSummary").textContent = `${selectedDocument.title} — ${selectedDocument.level} — KSh ${selectedDocument.price_kes}`;
  $("#checkoutMessage").textContent = "";
  $("#checkoutModal").classList.remove("hidden");
}
function closeCheckout() { $("#checkoutModal").classList.add("hidden"); }
$("#closeModal").addEventListener("click", closeCheckout);
$("#checkoutModal").addEventListener("click", e => { if (e.target === $("#checkoutModal")) closeCheckout(); });
$("#checkoutForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const payload = Object.fromEntries(form.entries());
  payload.document_id = Number($("#checkoutDocument").value);
  $("#checkoutMessage").textContent = "Creating your order…";
  try {
    const response = await fetch("/api/checkout", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not create order.");
    $("#checkoutMessage").textContent = `Order ${data.reference} created. ${data.message}`;
  } catch (err) { $("#checkoutMessage").textContent = err.message; }
});
$("#levelFilter").addEventListener("change", () => { updateSubjectFilter(); renderPapers(); });
$("#subjectFilter").addEventListener("change", renderPapers);
$("#searchFilter").addEventListener("input", renderPapers);
updateSubjectFilter();
loadPapers();
