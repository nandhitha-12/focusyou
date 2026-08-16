// ── SIDEBAR ──
document.getElementById("menuToggle").onclick=()=>{document.getElementById("sidebar").classList.toggle("open");document.getElementById("overlay").classList.toggle("open");};
document.getElementById("overlay").onclick=()=>{document.getElementById("sidebar").classList.remove("open");document.getElementById("overlay").classList.remove("open");};

// ── TOAST ──
function toast(msg,emoji){emoji=emoji||"✨";const c=document.getElementById("toastContainer"),t=document.createElement("div");t.className="toast";t.innerHTML=emoji+" "+msg;c.appendChild(t);setTimeout(()=>t.remove(),4000);}

// ── TAB SWITCH ──
function switchTab(tab,btn){
  ["todo","calendar","syllabus","exams"].forEach(t=>document.getElementById("tab-"+t).style.display=t===tab?"block":"none");
  document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  if(tab==="calendar")renderCalendar();
}

// ────────────────────────────────────
//  DATA LAYER (localStorage)
// ────────────────────────────────────
function loadTodos(){return JSON.parse(localStorage.getItem("fy_todos")||"[]");}
function saveTodos(t){localStorage.setItem("fy_todos",JSON.stringify(t));}
function loadExams(){return JSON.parse(localStorage.getItem("fy_exams")||"[]");}
function saveExams(e){localStorage.setItem("fy_exams",JSON.stringify(e));}
function loadTopics(){return JSON.parse(localStorage.getItem("fy_topics")||"[]");}
function saveTopics(t){localStorage.setItem("fy_topics",JSON.stringify(t));}

function cleanSyllabusLine(line){
  return line.replace(/^\s*(?:[\-*•▪‣–—]|\d+[\)\.\:-]|[A-Za-z][\)\.\:-])\s*/," ").replace(/\s+/g," ").trim();
}

function looksLikeTopicLine(line){
  const cleaned=cleanSyllabusLine(line);
  if(!cleaned)return false;
  const lower=cleaned.toLowerCase();
  if(/^(page|table of contents|contents|index|references?|bibliography|appendix|acknowledg\w*)\b/.test(lower))return false;
  if(/^\d+(\s*[-–—]\s*\d+)?$/.test(cleaned))return false;
  if(cleaned.length>120)return false;
  const words=cleaned.split(/\s+/);
  if(words.length>14)return false;
  if(/^[ivxlcdm]+$/i.test(cleaned))return false;
  if(/^(chapter|unit|module|lesson|topic|part|section)\b/i.test(cleaned))return true;
  if(/\b(chapter|unit|module|lesson|topic|part|section)\s*\d+/i.test(cleaned))return true;
  if(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,7}$/.test(cleaned)&&words.length<=8)return true;
  if(/[:\-–—]/.test(cleaned)&&words.length<=12)return true;
  if(cleaned===cleaned.toUpperCase()&&words.length<=10)return true;
  if(words.length<=6&&/^[A-Za-z][A-Za-z0-9&(),/'"-]*(\s+[A-Za-z][A-Za-z0-9&(),/'"-]*)*$/.test(cleaned))return true;
  return false;
}

function extractTopicCandidates(text){
  const seen=new Set();
  return text.split(/[\n\r]+/).map(cleanSyllabusLine).filter(line=>line.length>0&&looksLikeTopicLine(line)).filter(line=>{const key=line.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
}

async function analyzeUploadedSyllabus(text,fileName,area,zone){
  try{
    const response=await fetch("/api/analyze_syllabus",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({text,filename:fileName})
    });
    const data=await response.json();
    const topics=Array.isArray(data.topics)?data.topics.filter(Boolean):[];
    if(topics.length){
      area.value=topics.join("\n");
      resetUploadZone(fileName);
      toast((data.warning?"Syllabus analyzed with fallback: ":"AI found ")+topics.length+" topics! Click Parse Topics 📋","📄");
      return;
    }
    throw new Error(data.error||"No topics returned");
  }catch(err){
    const fallback=extractTopicCandidates(text);
    area.value=fallback.length?fallback.join("\n"):text.split(/[\n\r]+/).map(cleanSyllabusLine).filter(line=>line.length>0&&line.length<=80).slice(0,20).join("\n");
    resetUploadZone(fileName);
    toast("Upload read, but analysis was limited — refine topics if needed ⚠️","❌");
    console.error(err);
  }
}

function todayStr(){return new Date().toISOString().split("T")[0];}

// Set default date inputs to today
document.getElementById("todoDate").value=todayStr();
document.getElementById("filterDate").value=todayStr();
document.getElementById("startDate").value=todayStr();

// ────────────────────────────────────
//  TO-DO LIST
// ────────────────────────────────────
function addTodo(){
  const text=document.getElementById("todoText").value.trim();
  if(!text){toast("Enter a task name!","⚠️");return;}
  const todos=loadTodos();
  todos.push({
    id:Date.now(),
    text,
    date:document.getElementById("todoDate").value||todayStr(),
    time:document.getElementById("todoTime").value||"",
    priority:document.getElementById("todoPriority").value,
    category:document.getElementById("todoCategory").value,
    done:false
  });
  saveTodos(todos);
  document.getElementById("todoText").value="";
  renderTodos();
  toast("Task added! 📋","✅");
  if(typeof FocusVoice !== 'undefined') FocusVoice.speakTaskSet(text);
}

function renderTodos(){
  const filterDate=document.getElementById("filterDate").value||todayStr();
  document.getElementById("listDateLabel").textContent=filterDate===todayStr()?"Today":filterDate;
  const todos=loadTodos().filter(t=>t.date===filterDate);
  const list=document.getElementById("todoList");
  if(!todos.length){
    list.innerHTML=`<div class="empty-state"><div class="es-icon">🌸</div><p>No tasks for this day — enjoy the peace! Or add one above ☝️</p></div>`;
    updateSummary([]);return;
  }
  // Sort: undone first, then by priority, then by time
  const pOrder={high:0,med:1,low:2};
  todos.sort((a,b)=>{
    if(a.done!==b.done)return a.done?1:-1;
    if(pOrder[a.priority]!==pOrder[b.priority])return pOrder[a.priority]-pOrder[b.priority];
    return (a.time||"99:99").localeCompare(b.time||"99:99");
  });
  const catEmoji={study:"📚",revision:"🔁",exam:"🎯",break:"☕",other:"📌"};
  list.innerHTML=todos.map(t=>`
    <div class="todo-item ${t.done?'done':''}" id="ti-${t.id}">
      <div class="priority-dot p-${t.priority}"></div>
      <div class="todo-check ${t.done?'checked':''}" onclick="toggleTodo(${t.id})"></div>
      <span class="todo-text">${catEmoji[t.category]||"📌"} ${t.text}</span>
      <span class="todo-meta">${t.time||""}</span>
      <button onclick="deleteTodo(${t.id})" style="background:none;border:none;cursor:pointer;font-size:1rem;opacity:.5;padding:2px 4px;" title="Delete">✕</button>
    </div>`).join("");
  updateSummary(todos);
}

function toggleTodo(id){
  const todos=loadTodos();
  const t=todos.find(t=>t.id===id);
  if(t){
    t.done=!t.done;
    saveTodos(todos);
    if(t.done){
      // Award XP when task is marked done
      const xpAmount = fyXPForPriority(t.priority);
      fyAddXP(xpAmount, t.text.slice(0,30) + (t.text.length>30?"…":""));
    } else {
      // Remove XP when task is unchecked
      const xpAmount = fyXPForPriority(t.priority);
      fyRemoveXP(xpAmount);
    }
    renderTodos();
    refreshPlannerStats();
  }
}
function deleteTodo(id){
  saveTodos(loadTodos().filter(t=>t.id!==id));
  renderTodos();
}
function clearDone(){
  const filterDate=document.getElementById("filterDate").value||todayStr();
  saveTodos(loadTodos().filter(t=>!(t.done&&t.date===filterDate)));
  renderTodos();toast("Cleared completed tasks!","🗑");
}
function updateSummary(todos){
  const total=todos.length,done=todos.filter(t=>t.done).length,left=total-done;
  const rate=total>0?Math.round(done/total*100):0;
  document.getElementById("sumTotal").textContent=total;
  document.getElementById("sumDone").textContent=done;
  document.getElementById("sumLeft").textContent=left;
  document.getElementById("sumRate").textContent=total>0?rate+"%":"—";
  document.getElementById("sumBar").style.width=rate+"%";
}

renderTodos();

// ────────────────────────────────────
//  CALENDAR
// ────────────────────────────────────
let calYear=new Date().getFullYear(),calMonth=new Date().getMonth();
let selectedDate=todayStr();

function calNav(dir){calMonth+=dir;if(calMonth>11){calMonth=0;calYear++;}if(calMonth<0){calMonth=11;calYear--;}renderCalendar();}

function renderCalendar(){
  const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
  document.getElementById("calMonth").textContent=months[calMonth]+" "+calYear;
  const grid=document.getElementById("calGrid");
  const todos=loadTodos();
  const exams=loadExams();
  const today=todayStr();

  // Day name headers
  let html=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>`<div class="cal-day-name">${d}</div>`).join("");

  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const prevDays=new Date(calYear,calMonth,0).getDate();

  // Prev month padding
  for(let i=firstDay-1;i>=0;i--){
    html+=`<div class="cal-day other-month">${prevDays-i}</div>`;
  }

  for(let d=1;d<=daysInMonth;d++){
    const dateStr=calYear+"-"+String(calMonth+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    const hasTasks=todos.some(t=>t.date===dateStr);
    const hasExam=exams.some(e=>e.date===dateStr);
    const isToday=dateStr===today;
    const isSel=dateStr===selectedDate;
    let cls="cal-day";
    if(isToday)cls+=" today";
    else if(isSel)cls+=" selected";
    if(hasExam)cls+=" exam-day has-exam";
    else if(hasTasks)cls+=" has-tasks";
    html+=`<div class="${cls}" onclick="selectDate('${dateStr}')">${d}</div>`;
  }

  // Next month padding
  const total=firstDay+daysInMonth;
  const remaining=total%7===0?0:7-(total%7);
  for(let d=1;d<=remaining;d++){
    html+=`<div class="cal-day other-month">${d}</div>`;
  }

  grid.innerHTML=html;
  if(selectedDate)renderDayDetail(selectedDate);
}

function selectDate(dateStr){
  selectedDate=dateStr;
  renderCalendar();
  renderDayDetail(dateStr);
}

function renderDayDetail(dateStr){
  document.getElementById("selectedDayLabel").textContent=new Date(dateStr+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const todos=loadTodos().filter(t=>t.date===dateStr);
  const exams=loadExams().filter(e=>e.date===dateStr);
  const catEmoji={study:"📚",revision:"🔁",exam:"🎯",break:"☕",other:"📌"};
  const pColors={high:"#e74c3c",med:"#f39c12",low:"#2ecc71"};
  let html="";

  if(exams.length){
    html+=`<div style="margin-bottom:12px;padding:12px 14px;background:linear-gradient(135deg,#FFE0EA,#FFD6A5);border-radius:var(--radius-sm);border:1.5px solid var(--pink);">`;
    exams.forEach(e=>{
      html+=`<div style="font-weight:800;font-size:.9rem;color:#c0392b;">🎯 EXAM: ${e.subject}</div>`;
      html+=`<div style="font-size:.78rem;color:var(--text-soft);font-weight:600;">${e.time||""}</div>`;
    });
    html+=`</div>`;
  }

  if(todos.length){
    todos.forEach(t=>{
      html+=`<div class="todo-item ${t.done?'done':''}" style="margin-bottom:6px;">
        <div class="priority-dot p-${t.priority}"></div>
        <div class="todo-check ${t.done?'checked':''}" onclick="toggleTodo(${t.id});renderCalendar();"></div>
        <span class="todo-text">${catEmoji[t.category]||"📌"} ${t.text}</span>
        <span class="todo-meta">${t.time||""}</span>
      </div>`;
    });
  }else if(!exams.length){
    html=`<div class="empty-state"><div class="es-icon">🌿</div><p>No tasks on this day</p></div>`;
  }

  document.getElementById("dayDetail").innerHTML=html;
}

renderCalendar();

// ────────────────────────────────────
//  SYLLABUS ANALYSER
// ────────────────────────────────────
let parsedTopics=loadTopics();




// ── SYLLABUS FILE UPLOAD ──
function loadPDFJS(cb){
  if(window.pdfjsLib){cb();return;}
  const s=document.createElement("script");
  s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  s.onload=()=>{
    window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    cb();
  };
  document.head.appendChild(s);
}

function resetUploadZone(filename){
  const zone=document.querySelector(".upload-zone");
  zone.innerHTML='<input type="file" id="syllabusFile" accept=".txt,.pdf,.docx" onchange="handleSyllabusUpload(this)" style="display:none;"/>'
    +'<div class="uz-icon">✅</div>'
    +'<div class="uz-text">'+filename+' loaded!</div>'
    +'<div class="uz-sub">Click to upload a different file</div>';
  zone.onclick=()=>document.getElementById("syllabusFile").click();
}

function handleSyllabusUpload(input){
  const file=input.files[0];if(!file)return;
  const name=file.name.toLowerCase();
  const area=document.getElementById("syllabusText");
  const zone=document.querySelector(".upload-zone");
  zone.innerHTML='<div class="uz-icon">⏳</div><div class="uz-text">Reading '+file.name+'…</div><div class="uz-sub">Please wait</div>';

  if(name.endsWith(".txt")){
    const reader=new FileReader();
    reader.onload=e=>{analyzeUploadedSyllabus(e.target.result,file.name,area,zone);};
    reader.readAsText(file);

  }else if(name.endsWith(".pdf")){
    loadPDFJS(()=>{
      const reader=new FileReader();
      reader.onload=async e=>{
        try{
          const arr=new Uint8Array(e.target.result);
          const pdf=await pdfjsLib.getDocument({data:arr}).promise;
          let text="";
          for(let i=1;i<=pdf.numPages;i++){
            const page=await pdf.getPage(i);
            const content=await page.getTextContent();
            text+=content.items.map(x=>x.str).join(" ")+"\n";
          }
          analyzeUploadedSyllabus(text,file.name,area,zone);
        }catch(err){resetUploadZone(file.name);toast("PDF read failed — try copy-paste below ⚠️","❌");console.error(err);}
      };
      reader.readAsArrayBuffer(file);
    });

  }else if(name.endsWith(".docx")){
    function runMammoth(){
      const reader=new FileReader();
      reader.onload=async e=>{
        try{
          const result=await mammoth.extractRawText({arrayBuffer:e.target.result});
          analyzeUploadedSyllabus(result.value,file.name,area,zone);
        }catch(err){resetUploadZone(file.name);toast("DOCX read failed — try copy-paste ⚠️","❌");}
      };
      reader.readAsArrayBuffer(file);
    }
    if(window.mammoth){runMammoth();}
    else{
      const s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
      s.onload=runMammoth;document.head.appendChild(s);
    }

  }else{
    resetUploadZone("file");
    toast("Use .txt, .pdf or .docx only","⚠️");
  }
}

function parseSyllabus(){
  const raw=document.getElementById("syllabusText").value.trim();
  if(!raw){toast("Paste or upload your syllabus first!","⚠️");return;}
  const lines=raw.split("\n").map(l=>l.replace(/^\s*[\d\.\-\*\•]+\s*/,"").trim()).filter(l=>l.length>2);
  // Deduplicate
  parsedTopics=[...new Set(lines)].map((t,i)=>({id:i+1,text:t,done:false}));
  saveTopics(parsedTopics);
  renderTopics();
  toast(`Found ${parsedTopics.length} topics! 📚`,"✅");
}

function renderTopics(){
  const el=document.getElementById("topicsList");
  document.getElementById("topicCount").textContent=parsedTopics.length;
  if(!parsedTopics.length){
    el.innerHTML=`<div class="empty-state"><div class="es-icon">📝</div><p>Parse your syllabus to see topics here</p></div>`;
    return;
  }
  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px;">`+
    parsedTopics.map(t=>`
      <div class="todo-item ${t.done?'done':''}" style="margin-bottom:0; display:flex; align-items:center;">
        <div class="todo-check ${t.done?'checked':''}" onclick="toggleTopic(${t.id})"></div>
        <span class="todo-text" style="flex:1; cursor:pointer;" onclick="toggleTopic(${t.id})" title="${t.text}">${t.text}</span>
        <button onclick="removeTopic(${t.id})" style="background:none;border:none;cursor:pointer;font-size:1rem;opacity:.5;padding:2px 4px;" title="Delete">✕</button>
      </div>`).join("")+`</div>`;
}

function toggleTopic(id){
  const topic = parsedTopics.find(t=>t.id===id);
  if(topic){
    topic.done = !topic.done;
    if(topic.done){
      fyAddXP(5, "Topic: " + topic.text.slice(0,20) + (topic.text.length>20?"…":""));
      toast("Topic complete! +5 XP 🎉", "📚");
    } else {
      fyRemoveXP(5);
    }
    saveTopics(parsedTopics);
    renderTopics();
    if(typeof refreshPlannerStats === "function") refreshPlannerStats();
  }
}
function removeTopic(id){
  parsedTopics=parsedTopics.filter(t=>t.id!==id);
  saveTopics(parsedTopics);renderTopics();
}
function clearTopics(){parsedTopics=[];saveTopics([]);renderTopics();}

renderTopics();

async function generateAIPlan(){
  const subject=document.getElementById("examSubject").value.trim();
  const examDate=document.getElementById("examDateInput").value;
  const startDate=document.getElementById("startDate").value;
  const dailyHours=parseInt(document.getElementById("dailyHours").value)||4;

  if(!parsedTopics.length){toast("Add topics from syllabus first!","⚠️");return;}
  if(!examDate){toast("Set an exam date!","⚠️");return;}
  if(!startDate){toast("Set a start date!","⚠️");return;}

  const btn=document.getElementById("generateBtn");
  btn.innerHTML=`<span class="spinner"></span>Generating AI Plan…`;btn.disabled=true;

  const undoneTopics=parsedTopics.filter(t=>!t.done).map(t=>t.text);
  const totalTopics=undoneTopics.length;

  // Calculate days available
  const start=new Date(startDate),exam=new Date(examDate);
  const diffDays=Math.max(1,Math.round((exam-start)/(1000*60*60*24)));

  const prompt=`You are a study planner AI. Create a detailed day-by-day study schedule.

Subject: ${subject||"General Studies"}
Topics to cover (${totalTopics}): ${undoneTopics.join(", ")}
Start date: ${startDate}
Exam date: ${examDate}
Days available: ${diffDays}
Daily study hours: ${dailyHours}

Create a schedule that:
1. Distributes topics evenly across available days
2. Puts complex topics earlier
3. Leaves last 2 days for revision
4. Includes short breaks
5. Groups related topics together

Format EXACTLY as JSON (no markdown):
{
  "plan": [
    {
      "date": "YYYY-MM-DD",
      "day": "Day 1 - Monday",
      "topics": ["Topic 1", "Topic 2"],
      "hours": 4,
      "type": "study",
      "note": "Focus on fundamentals"
    }
  ],
  "summary": "Brief overall strategy"
}`;

  try{
    const res=await fetch("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:prompt})});
    const data=await res.json();
    let raw=data.reply;
    // Strip markdown code blocks if present
    raw=raw.replace(/```json/g,"").replace(/```/g,"").trim();
    let plan;
    try{plan=JSON.parse(raw);}
    catch(e){
      // If JSON parse fails, show raw response
      document.getElementById("aiPlanOutput").innerHTML=`<div style="font-size:.85rem;line-height:1.8;color:var(--text-soft);white-space:pre-wrap;">${data.reply}</div>`;
      btn.innerHTML="🤖 Generate AI Study Plan";btn.disabled=false;return;
    }
    renderAIPlan(plan);
    // Save plan to todos
    if(plan.plan){
      const todos=loadTodos();
      let added=0;
      plan.plan.forEach(day=>{
        day.topics.forEach(topic=>{
          if(!todos.some(t=>t.date===day.date&&t.text===topic)){
            todos.push({id:Date.now()+Math.random(),text:topic,date:day.date,time:"",priority:"med",category:"study",done:false});
            added++;
          }
        });
      });
      if(added>0){saveTodos(todos);toast(`Added ${added} study tasks to your planner! 📅`,"✅");}
    }
  }catch(e){
    document.getElementById("aiPlanOutput").innerHTML=`<div style="color:#e74c3c;font-size:.88rem;">❌ Error generating plan. Check your connection and try again.</div>`;
  }
  btn.innerHTML="🤖 Generate AI Study Plan";btn.disabled=false;
}

function renderAIPlan(plan){
  if(!plan.plan||!plan.plan.length){
    document.getElementById("aiPlanOutput").innerHTML=`<div class="empty-state"><div class="es-icon">😕</div><p>Could not parse the plan. Try again!</p></div>`;
    return;
  }
  const typeEmoji={study:"📚",revision:"🔁",break:"☕",exam:"🎯"};
  const typeTag={study:"tag-study",revision:"tag-revision",break:"tag-break",exam:"tag-exam"};
  let html=`<div style="margin-bottom:12px;padding:12px 14px;background:var(--purple-light);border-radius:var(--radius-sm);font-size:.82rem;font-weight:600;color:var(--purple-deep);">💡 ${plan.summary||""}</div>`;

  plan.plan.forEach(day=>{
    const dayDate=new Date(day.date+"T12:00:00");
    const dayLabel=dayDate.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
    html+=`<div class="plan-day">
      <div class="plan-day-header">
        <span class="plan-day-date">${dayLabel}</span>
        <span class="plan-day-badge">${day.hours}h · ${typeEmoji[day.type]||"📚"} <span class="tag ${typeTag[day.type]||"tag-study"}">${day.type}</span></span>
      </div>`;
    day.topics.forEach(t=>{
      html+=`<div class="plan-topic-row"><span class="pt-icon">${typeEmoji[day.type]||"📚"}</span>${t}<span class="pt-time">~${Math.round(day.hours/day.topics.length*60)}min</span></div>`;
    });
    if(day.note)html+=`<div style="font-size:.75rem;color:var(--text-muted);font-weight:600;padding:4px 8px;">💡 ${day.note}</div>`;
    html+=`</div>`;
  });

  document.getElementById("aiPlanOutput").innerHTML=html;
}

// ────────────────────────────────────
//  EXAM COUNTDOWN
// ────────────────────────────────────
function addExam(){
  const name=document.getElementById("examName").value.trim();
  const date=document.getElementById("examDate").value;
  if(!name||!date){toast("Fill exam name and date!","⚠️");return;}
  const exams=loadExams();
  exams.push({
    id:Date.now(),
    subject:name,
    date,
    time:document.getElementById("examTime").value||"09:00",
    coverage:parseInt(document.getElementById("examCoverage").value)||0
  });
  saveExams(exams);
  document.getElementById("examName").value="";
  renderExams();
  toast("Exam added! 🎯","📅");
  // Also add to calendar by refreshing calendar if visible
}

function renderExams(){
  const exams=loadExams();
  const today=new Date();
  const el=document.getElementById("examList");
  let urgentHtml="";

  if(!exams.length){
    el.innerHTML=`<div class="empty-state"><div class="es-icon">🎯</div><p>Add your exams to start the countdown!</p></div>`;
    document.getElementById("urgencyBanner").style.display="none";
    return;
  }

  // Sort by date
  exams.sort((a,b)=>new Date(a.date)-new Date(b.date));
  let hasUrgent=false;

  el.innerHTML=exams.map(e=>{
    const examD=new Date(e.date+"T"+e.time);
    const diff=Math.ceil((examD-today)/(1000*60*60*24));
    const isUrgent=diff<=7&&diff>=0;
    if(isUrgent){hasUrgent=true;urgentHtml+=`<strong>${e.subject}</strong> is in <strong>${diff===0?"TODAY":diff+" days"}</strong> — ${100-e.coverage}% syllabus remaining! Start revising NOW! 📚<br>`;}
    const isPast=diff<0;
    return `<div class="exam-item">
      <div>
        <div style="font-weight:800;font-size:.9rem;">${e.subject}</div>
        <div style="font-size:.75rem;color:var(--text-muted);font-weight:600;">${new Date(e.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} at ${e.time}</div>
        <div style="margin-top:4px;background:var(--border);border-radius:99px;height:6px;width:120px;overflow:hidden;">
          <div style="height:100%;border-radius:99px;background:linear-gradient(90deg,var(--purple-deep),var(--mint));width:${e.coverage}%;"></div>
        </div>
        <div style="font-size:.68rem;color:var(--text-muted);font-weight:600;margin-top:2px;">${e.coverage}% syllabus covered</div>
      </div>
      <div style="margin-left:auto;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div class="days-left ${isUrgent?'urgent':''}">${isPast?"Done ✅":diff===0?"TODAY!":diff+" days"}</div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-outline" onclick="updateCoverage(${e.id})" title="Update syllabus %">📊</button>
          <button class="btn btn-sm btn-danger" onclick="deleteExam(${e.id})">✕</button>
        </div>
      </div>
    </div>`;
  }).join("");

  if(hasUrgent){
    document.getElementById("urgencyBanner").style.display="block";
    document.getElementById("urgencyText").innerHTML=urgentHtml;
  }else{
    document.getElementById("urgencyBanner").style.display="none";
  }
}

function deleteExam(id){
  saveExams(loadExams().filter(e=>e.id!==id));
  renderExams();toast("Exam removed","🗑");
}

function updateCoverage(id){
  const pct=prompt("Enter syllabus coverage % (0-100):");
  if(pct===null)return;
  const val=Math.max(0,Math.min(100,parseInt(pct)||0));
  const exams=loadExams();
  const e=exams.find(e=>e.id===id);
  if(e){e.coverage=val;saveExams(exams);renderExams();toast("Coverage updated!","📊");}
}

function refreshPlannerStats(){
  const stats=fyLoadStats();
  const grade=fyGetGrade(stats.xp);
  const next=fyGetNextGrade(stats.xp);
  const pct=next?Math.min(100,Math.round((stats.xp-grade.min)/(next.min-grade.min)*100)):100;
  const s=id=>document.getElementById(id);
  if(s("plannerStreak"))s("plannerStreak").textContent=stats.streak||0;
  if(s("plannerXP"))    s("plannerXP").textContent    =stats.xp||0;
  if(s("plannerGrade")) s("plannerGrade").textContent =grade.name;
  if(s("plannerXPBar")) s("plannerXPBar").style.width =pct+"%";
  if(s("plannerXPNext"))s("plannerXPNext").textContent=next?(next.min-stats.xp)+" XP to "+next.name:"MAX! 🏅";
  if(s("plannerDone"))  s("plannerDone").textContent  =stats.totalDone||0;
}

renderExams();

// ── Countdown ticker (updates every minute) ──
setInterval(renderExams,60000);

fyCheckStreak();
  refreshPlannerStats();
  setInterval(refreshPlannerStats,2000);
  window.addEventListener("storage",function(e){
    if(e.key==="fy_stats"||e.key==="fy_stats_updated")refreshPlannerStats();
  });