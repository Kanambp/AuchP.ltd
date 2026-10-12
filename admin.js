const $ = s => document.querySelector(s);
const subjectMap = {
 "Play Group–PP2":["EYE activity papers"],
 "Grade 1–3":["Mathematics","English","Kiswahili","Environmental Activities","Creative Arts"],
 "Grade 4–6":["Mathematics","Kiswahili","English","Creative Arts","Social Studies","Agriculture and Nutrition","Science and Technology","CRE"],
 "Grade 7–9":["Mathematics","English Paper 1","English Paper 2","Kiswahili Paper 1","Kiswahili Paper 2","Integrated Science","CRE","Pretechnical Studies","Agriculture and Nutrition","Creative Arts","Social Studies"]
};
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function api(url,options={}) {
 const res=await fetch(url,options); const data=await res.json().catch(()=>({}));
 if(!res.ok) throw new Error(data.error||"Request failed."); return data;
}
async function checkSession(){
 try {const user=await api("/api/admin/me");$("#loginPanel").classList.add("hidden");$("#dashboard").classList.remove("hidden");$("#adminIdentity").textContent=`Signed in as ${user.email}`;loadDocuments();loadOrders();}
 catch {$("#loginPanel").classList.remove("hidden");$("#dashboard").classList.add("hidden");}
}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();$("#loginMessage").textContent="Signing in…";const payload=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});$("#loginMessage").textContent="";checkSession();}catch(err){$("#loginMessage").textContent=err.message;}});
$("#logoutBtn").addEventListener("click",async()=>{await api("/api/admin/logout",{method:"POST"});checkSession();});
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));document.querySelectorAll(".tab-panel").forEach(p=>p.classList.add("hidden"));$("#"+btn.dataset.tab+"Tab").classList.remove("hidden");}));
$("#uploadLevel").addEventListener("change",()=>{const list=subjectMap[$("#uploadLevel").value]||[];$("#uploadSubject").innerHTML='<option value="">Select subject</option>'+list.map(s=>`<option>${esc(s)}</option>`).join("");});
$("#uploadForm").addEventListener("submit",async e=>{e.preventDefault();$("#uploadMessage").textContent="Uploading…";try{await api("/api/admin/documents",{method:"POST",body:new FormData(e.currentTarget)});$("#uploadMessage").textContent="Document uploaded and published.";e.currentTarget.reset();$("#uploadSubject").innerHTML='<option value="">Select subject</option>';loadDocuments();}catch(err){$("#uploadMessage").textContent=err.message;}});
async function loadDocuments(){
 try{const docs=await api("/api/admin/documents");if(!docs.length){$("#adminDocuments").innerHTML='<div class="empty-admin">No papers uploaded yet.</div>';return;}
 $("#adminDocuments").innerHTML='<div class="admin-table-wrap"><table><thead><tr><th>Paper</th><th>Level / subject</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+docs.map(d=>`<tr><td><strong>${esc(d.title)}</strong><br><span class="small-note">${esc(d.original_name)}</span></td><td>${esc(d.level)}<br>${esc(d.subject)}</td><td>KSh ${d.price_kes}</td><td><span class="status ${d.active?'active':''}">${d.active?'Published':'Hidden'}</span></td><td><button class="mini-btn" data-toggle="${d.id}" data-active="${d.active}">${d.active?'Hide':'Publish'}</button> <button class="mini-btn danger" data-delete="${d.id}">Delete</button></td></tr>`).join("")+'</tbody></table></div>';
 document.querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",async()=>{await api(`/api/admin/documents/${b.dataset.toggle}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:b.dataset.active!=="1"})});loadDocuments();}));
 document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(confirm("Permanently delete this paper and its uploaded file?")){await api(`/api/admin/documents/${b.dataset.delete}`,{method:"DELETE"});loadDocuments();}}));
 }catch(err){$("#adminDocuments").textContent=err.message;}
}
async function loadOrders(){
 try{const orders=await api("/api/admin/orders");if(!orders.length){$("#adminOrders").innerHTML='<div class="empty-admin">No orders yet.</div>';return;}
 $("#adminOrders").innerHTML='<div class="admin-table-wrap"><table><thead><tr><th>Reference</th><th>Customer</th><th>Paper</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead><tbody>'+orders.map(o=>`<tr><td>${esc(o.reference)}</td><td>${esc(o.customer_name)}<br>${esc(o.phone)}</td><td>${esc(o.document_title)}</td><td>KSh ${o.amount_kes}</td><td>${esc(o.payment_method)}</td><td><span class="status">${esc(o.status)}</span></td><td>${esc(o.created_at)}</td></tr>`).join("")+'</tbody></table></div>';
 }catch(err){$("#adminOrders").textContent=err.message;}
}
checkSession();
