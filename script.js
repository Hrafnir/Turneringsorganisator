// --- DATA MODEL ---
let data = {
    classes: ["8A","8B","8C","8D","9A","9B","9C","9D","10A","10B","10C","10D"],
    students: [],
    courts: [
        {id: 1, name: "Bane 1", type: "Volleyball"},
        {id: 2, name: "Bane 2", type: "Volleyball"},
        {id: 3, name: "Bane 3", type: "Stikkball"}
    ],
    teams: [],
    matches: [],
    finals: [],
    settings: {
        startTime: "10:15",
        finalsTime: "14:00",
        matchDuration: 15,
        breakDuration: 5
    },
    teamsLocked: false
};

// --- INIT ---
window.onload = function() {
    loadLocal();
    renderClassButtons();
    renderStudentList();
    renderCourts();
    if(data.teams.length) renderTeams();
    if(data.matches.length) renderSchedule();
    if(data.finals.length) renderFinals();
    updateTimerDisplay(data.settings.matchDuration * 60);
};

// --- STORAGE ---
function saveLocal() { localStorage.setItem('ts_v4', JSON.stringify(data)); }
function loadLocal() {
    const json = localStorage.getItem('ts_v4');
    if(json) {
        const parsed = JSON.parse(json);
        data = { ...data, ...parsed };
        updateInputs();
    }
}
function updateInputs() {
    document.getElementById('startTime').value = data.settings.startTime;
    document.getElementById('finalsTime').value = data.settings.finalsTime;
    document.getElementById('matchDuration').value = data.settings.matchDuration;
    document.getElementById('breakDuration').value = data.settings.breakDuration;
}

function saveToFile() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `turnering_v4_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
}
function loadFromFile() {
    const file = document.getElementById('fileInput').files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try { data = JSON.parse(e.target.result); saveLocal(); location.reload(); }
        catch(err) { alert("Feil filformat"); }
    };
    reader.readAsText(file);
}
function confirmReset() { if(confirm("Slett ALT?")) { localStorage.removeItem('ts_v4'); location.reload(); } }

// --- TABS ---
function showTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// --- CLASSES & STUDENTS ---
let selectedClass = "";
function renderClassButtons() {
    const div = document.getElementById('classButtons');
    div.innerHTML = '';
    data.classes.forEach(c => {
        const btn = document.createElement('span');
        btn.className = `class-btn ${selectedClass === c ? 'selected' : ''}`;
        btn.innerHTML = `${c} <i class="fas fa-times del-cls" onclick="event.stopPropagation(); removeClass('${c}')"></i>`;
        btn.onclick = () => { selectedClass = c; renderClassButtons(); };
        div.appendChild(btn);
    });
    if(!selectedClass && data.classes.length) { selectedClass = data.classes[0]; renderClassButtons(); }
}
function addClass() {
    const val = document.getElementById('newClassInput').value.trim().toUpperCase();
    if(val && !data.classes.includes(val)) { data.classes.push(val); data.classes.sort(); saveLocal(); renderClassButtons(); }
}
function removeClass(c) {
    if(confirm(`Slett ${c}?`)) { data.classes = data.classes.filter(x=>x!==c); saveLocal(); renderClassButtons(); }
}
function addStudents() {
    if(!selectedClass) return alert("Velg klasse");
    const txt = document.getElementById('pasteArea').value;
    txt.split('\n').forEach(l => {
        const n = l.trim();
        if(n) data.students.push({ id: genId(), name: n, class: selectedClass, present: true });
    });
    document.getElementById('pasteArea').value = ""; saveLocal(); renderStudentList();
}
function renderStudentList() {
    const list = document.getElementById('studentList');
    list.innerHTML = '';
    document.getElementById('studentCount').innerText = data.students.length;
    data.students.sort((a,b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name));
    data.students.forEach(s => {
        const div = document.createElement('div');
        div.className = `student-item ${s.present?'':'absent'}`;
        div.innerHTML = `<span><b>${s.class}</b> ${s.name}</span><input type="checkbox" ${s.present?'checked':''} onchange="togglePres('${s.id}')">`;
        list.appendChild(div);
    });
}
function togglePres(id) { const s = data.students.find(x=>x.id==id); if(s) { s.present=!s.present; saveLocal(); renderStudentList(); } }
function clearStudents() { if(confirm("Slett alle?")) { data.students=[]; saveLocal(); renderStudentList(); } }

// --- ARENA ---
function renderCourts() {
    const list = document.getElementById('courtList'); list.innerHTML='';
    data.courts.forEach((c,i) => {
        const d = document.createElement('div'); d.className='court-item';
        d.innerHTML = `<span>#${i+1}</span><input value="${c.name}" onchange="updCourt(${i},'name',this.value)"><input value="${c.type}" onchange="updCourt(${i},'type',this.value)"><button class="btn-small-red" onclick="delCourt(${i})">X</button>`;
        list.appendChild(d);
    });
}
function addCourt() { data.courts.push({id:Date.now(), name:`Bane ${data.courts.length+1}`, type:"Volleyball"}); saveLocal(); renderCourts(); }
function updCourt(i,f,v) { data.courts[i][f]=v; saveLocal(); }
function delCourt(i) { data.courts.splice(i,1); saveLocal(); renderCourts(); }
['startTime','finalsTime','matchDuration','breakDuration'].forEach(id=>{
    document.getElementById(id).addEventListener('change', e=>{ data.settings[id]=e.target.value; saveLocal(); });
});

// --- TEAM DRAW V4.0 ---
// Fisher-Yates Shuffle
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function generateTeamsAnimated() {
    if(data.teamsLocked) return alert("Lås opp lagene først.");
    const count = parseInt(document.getElementById('teamCount').value);
    const strategy = document.getElementById('drawStrategy').value;
    const pool = data.students.filter(s => s.present);
    
    // Init Teams
    data.teams = Array.from({length: count}, (_,i) => ({
        id: i+1, name: `Lag ${i+1}`, members: [], points:0, stats:{p:0,w:0,d:0,l:0,gf:0,ga:0}
    }));

    if(strategy === 'random') {
        shuffle(pool);
        pool.forEach((s, i) => data.teams[i % count].members.push(s));
    } 
    else if (strategy === 'balanced') {
        // Group by class, shuffle each class, then round-robin
        let byClass = {};
        data.classes.forEach(c => byClass[c] = []);
        pool.forEach(s => { if(!byClass[s.class]) byClass[s.class]=[]; byClass[s.class].push(s); });
        
        let tIdx = 0;
        let active = true;
        while(active) {
            active = false;
            for(let c in byClass) {
                if(byClass[c].length) {
                    shuffle(byClass[c]);
                    data.teams[tIdx].members.push(byClass[c].pop());
                    tIdx = (tIdx + 1) % count;
                    active = true;
                }
            }
        }
    }
    else if (strategy === 'ab_cd') {
        // Half teams get A+B, Half teams get C+D (Simplified Grouping)
        // Group classes into 2 super-groups
        const mid = Math.ceil(data.classes.length / 2);
        const group1Classes = data.classes.slice(0, mid);
        
        const pool1 = pool.filter(s => group1Classes.includes(s.class));
        const pool2 = pool.filter(s => !group1Classes.includes(s.class));
        
        const teams1 = data.teams.slice(0, Math.ceil(count/2));
        const teams2 = data.teams.slice(Math.ceil(count/2));
        
        // Distribute pool1 to teams1
        shuffle(pool1);
        pool1.forEach((s, i) => teams1[i % teams1.length].members.push(s));
        
        // Distribute pool2 to teams2
        shuffle(pool2);
        pool2.forEach((s, i) => teams2[i % teams2.length].members.push(s));
    }

    saveLocal();
    renderTeams();
}

function deleteTeam(id) {
    if(data.teamsLocked) return alert("Lås opp først");
    if(!confirm("Slett lag? Spillerne vil bli fordelt på de andre lagene.")) return;
    
    const teamToRemove = data.teams.find(t => t.id === id);
    if(!teamToRemove) return;
    const orphans = teamToRemove.members;
    
    // Remove team
    data.teams = data.teams.filter(t => t.id !== id);
    
    // Redistribute orphans to smallest teams
    shuffle(orphans);
    orphans.forEach(s => {
        // Sort teams by size
        data.teams.sort((a,b) => a.members.length - b.members.length);
        data.teams[0].members.push(s);
    });
    
    // Renumber teams IDs logically or keep them? Keeping IDs is safer for existing logic, 
    // but names might be weird. Let's just update view.
    saveLocal();
    renderTeams();
}

function renderTeams() {
    const box = document.getElementById('drawDisplay'); box.innerHTML='';
    data.teams.forEach(t => {
        const div = document.createElement('div');
        div.className = 'team-card';
        div.ondragover=e=>e.preventDefault(); div.ondrop=e=>handleDrop(e,t.id);
        
        const mems = t.members.map((m, i) => `
            <div class="team-member" draggable="${!data.teamsLocked}" ondragstart="drag(event,'${m.id}',${t.id})">
                <span><span class="team-num">${i+1}.</span> ${m.name} <small>(${m.class})</small></span>
            </div>`).join('');
            
        div.innerHTML = `
            <h3><input value="${t.name}" onchange="renameTeam(${t.id},this.value)" style="background:none;border:none;color:inherit;text-align:center;font-weight:bold;width:80%;"></h3>
            ${!data.teamsLocked ? `<button class="team-delete" onclick="deleteTeam(${t.id})"><i class="fas fa-times"></i></button>` : ''}
            <div>${mems}</div>
        `;
        box.appendChild(div);
    });
    updateLockBtn();
}

// Drag & Drop
let dragSrc = null;
function drag(e,mId,tId){ dragSrc={mId,tId}; }
function handleDrop(e,tId){
    e.preventDefault();
    if(data.teamsLocked || !dragSrc || dragSrc.tId===tId) return;
    const sT = data.teams.find(t=>t.id===dragSrc.tId);
    const tT = data.teams.find(t=>t.id===tId);
    const mIdx = sT.members.findIndex(m=>m.id==dragSrc.mId);
    if(mIdx>-1) { tT.members.push(sT.members.splice(mIdx,1)[0]); saveLocal(); renderTeams(); }
}
function renameTeam(id,v){ data.teams.find(t=>t.id===id).name=v; saveLocal(); }
function toggleLockTeams(){ data.teamsLocked=!data.teamsLocked; saveLocal(); renderTeams(); }
function updateLockBtn(){ 
    const b=document.getElementById('lockBtn'); 
    b.className=data.teamsLocked?'btn-small-red':'btn-yellow';
    b.innerHTML=data.teamsLocked?'<i class="fas fa-lock"></i> Låst':'<i class="fas fa-unlock"></i> Åpen'; 
}

// --- SCHEDULE & PAUSES ---
function generateSchedule() {
    if(data.courts.length===0) return alert("Ingen baner!");
    if(!data.teamsLocked) toggleLockTeams();
    
    data.matches = [];
    let start = new Date(`2000-01-01T${data.settings.startTime}`);
    const end = new Date(`2000-01-01T${data.settings.finalsTime}`);
    const matchMin = parseInt(data.settings.matchDuration);
    const breakMin = parseInt(data.settings.breakDuration);
    const slotDur = matchMin + breakMin;
    
    // Round Robin Logic
    let ids = data.teams.map(t=>t.id);
    if(ids.length%2!==0) ids.push(null);
    let rounds = [];
    for(let r=0; r<ids.length-1; r++){
        let round = [];
        for(let i=0; i<ids.length/2; i++){
            if(ids[i]!==null && ids[ids.length-1-i]!==null) 
                round.push({t1:ids[i], t2:ids[ids.length-1-i]});
        }
        rounds.push(round);
        ids.splice(1,0,ids.pop());
    }
    
    // Assign to time/courts
    let allMatches = rounds.flat();
    let roundNum = 1;
    
    while(start < end && allMatches.length > 0) {
        let active = [];
        data.courts.forEach(c => {
            if(allMatches.length) {
                // Find match where teams aren't busy in this slot
                let mIdx = allMatches.findIndex(m => 
                    !active.some(a => a.t1===m.t1 || a.t2===m.t1 || a.t1===m.t2 || a.t2===m.t2)
                );
                if(mIdx > -1) {
                    let m = allMatches.splice(mIdx, 1)[0];
                    active.push({...m, cName: c.name, cType: c.type});
                }
            }
        });
        
        if(active.length===0) break; // Should not happen often
        
        let timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        active.forEach(m => {
            data.matches.push({
                id: genId(), time: timeStr, round: roundNum,
                t1: m.t1, t2: m.t2, court: m.cName, type: m.cType,
                s1: null, s2: null, done: false
            });
        });
        
        start.setMinutes(start.getMinutes() + slotDur);
        roundNum++;
    }
    saveLocal(); renderSchedule(); showTab('matches');
}

function renderSchedule() {
    const con = document.getElementById('scheduleContainer'); con.innerHTML='';
    let lastTime = "";
    
    // Sorter på tid (viktig hvis vi forskyver)
    data.matches.sort((a,b) => a.time.localeCompare(b.time));

    data.matches.forEach((m, idx) => {
        // Insert "Pause" button before new time block
        if(m.time !== lastTime) {
            lastTime = m.time;
            const pauseBtn = document.createElement('div');
            pauseBtn.innerHTML = `<button class="btn-pause-insert" onclick="insertPause('${m.time}')"><i class="fas fa-clock"></i> Sett inn pause før kl ${m.time} (Forskyv resten)</button>`;
            con.appendChild(pauseBtn);
        }
        
        const t1 = data.teams.find(t=>t.id===m.t1);
        const t2 = data.teams.find(t=>t.id===m.t2);
        if(!t1 || !t2) return;
        
        const div = document.createElement('div');
        div.className = `match-card ${m.done?'match-done':''}`;
        div.innerHTML = `
            <div class="match-info">
                <span class="match-court">${m.court} - ${m.type}</span>
                <span class="match-teams">${t1.name} vs ${t2.name}</span>
            </div>
            <input type="time" class="match-time-input" value="${m.time}" onchange="updateMTime('${m.id}',this.value)">
            <div class="score-input">
                <input type="number" value="${m.s1??''}" onchange="updScore('${m.id}','s1',this.value)"> - 
                <input type="number" value="${m.s2??''}" onchange="updScore('${m.id}','s2',this.value)">
                <button class="btn-text-red" onclick="delMatch('${m.id}')" style="margin-left:5px;">x</button>
            </div>
        `;
        con.appendChild(div);
    });
}

function insertPause(timeStr) {
    const mins = prompt("Hvor mange minutter pause?", "15");
    if(!mins) return;
    const shift = parseInt(mins);
    
    // Find all matches starting at or after timeStr
    let doShift = false;
    let shiftsMade = 0;
    
    // We iterate matches sorted by time. 
    // Matches at the same time must all shift.
    // Logic: Convert all to minutes, shift, convert back.
    
    data.matches.forEach(m => {
        if(m.time >= timeStr) {
            let [h, min] = m.time.split(':').map(Number);
            let d = new Date(); d.setHours(h, min + shift);
            m.time = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            shiftsMade++;
        }
    });
    
    if(shiftsMade > 0) {
        alert(`${shiftsMade} kamper ble forskjøvet med ${shift} minutter.`);
        saveLocal();
        renderSchedule();
    }
}

function delMatch(id) {
    if(confirm("Slette kamp?")) {
        data.matches = data.matches.filter(m=>m.id!==id);
        saveLocal(); renderSchedule(); calcStandings();
    }
}
function updScore(id,f,v) {
    const m = data.matches.find(x=>x.id==id);
    m[f] = v===''?null:parseInt(v);
    m.done = (m.s1!==null && m.s2!==null);
    saveLocal(); calcStandings();
}
function updateMTime(id, v) {
    const m = data.matches.find(x=>x.id==id); m.time = v; saveLocal();
}
function addManualMatch() {
    const t = data.teams[0];
    data.matches.push({ id:genId(), time:"12:00", t1:t.id, t2:t.id, court:"Manuell", type:"Ekstra", s1:null, s2:null, done:false });
    saveLocal(); renderSchedule();
}
function clearSchedule() {
    if(confirm("Slett alle kamper?")) { data.matches=[]; data.finals=[]; saveLocal(); renderSchedule(); calcStandings(); }
}

// --- STANDINGS ---
function calcStandings() {
    data.teams.forEach(t=>{ t.points=0; t.stats={p:0,w:0,d:0,l:0,gf:0,ga:0}; });
    data.matches.forEach(m=>{
        if(m.done) {
            const t1 = data.teams.find(t=>t.id==m.t1);
            const t2 = data.teams.find(t=>t.id==m.t2);
            if(t1&&t2){
                t1.stats.p++; t2.stats.p++;
                t1.stats.gf+=m.s1; t1.stats.ga+=m.s2;
                t2.stats.gf+=m.s2; t2.stats.ga+=m.s1;
                if(m.s1>m.s2){ t1.points+=3; t1.stats.w++; t2.stats.l++; }
                else if(m.s2>m.s1){ t2.points+=3; t2.stats.w++; t1.stats.l++; }
                else { t1.points++; t2.points++; t1.stats.d++; t2.stats.d++; }
            }
        }
    });
    data.teams.sort((a,b)=>{
        if(b.points!==a.points) return b.points-a.points;
        const da = a.stats.gf-a.stats.ga; const db = b.stats.gf-b.stats.ga;
        if(da!==db) return db-da;
        return b.stats.gf-a.stats.gf;
    });
    renderStandings(); updateFinalSel();
}
function renderStandings() {
    const b = document.getElementById('leaderboardBody'); b.innerHTML='';
    data.teams.forEach((t,i) => {
        b.innerHTML += `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.stats.p}</td><td>${t.stats.w}</td><td>${t.stats.d}</td><td>${t.stats.l}</td><td>${t.stats.gf-t.stats.ga}</td><td><strong>${t.points}</strong></td></tr>`;
    });
}

// --- FINALS & CELEBRATION ---
function updateFinalSel() {
    const opt = data.teams.map((t,i)=>`<option value="${t.id}">${i+1}. ${t.name}</option>`).join('');
    ['finalTeam1','finalTeam2'].forEach(id=>{
        const el=document.getElementById(id);
        if(!el.value) el.innerHTML=opt; // Only update if empty to preserve choice
        else {
            // Keep selection but update labels if teams changed rank
             const curr = el.value;
             el.innerHTML = opt;
             el.value = curr;
        }
    });
    if(data.teams.length>1 && document.getElementById('finalTeam2').selectedIndex===0)
        document.getElementById('finalTeam2').selectedIndex = 1;
}
function addFinal() {
    const t1 = data.teams.find(t=>t.id==document.getElementById('finalTeam1').value);
    const t2 = data.teams.find(t=>t.id==document.getElementById('finalTeam2').value);
    data.finals.push({
        id: genId(), t1:t1.id, t2:t2.id, t1Name:t1.name, t2Name:t2.name,
        type: document.getElementById('finalType').value,
        act: document.getElementById('finalActivity').value,
        s1:null, s2:null, done:false
    });
    saveLocal(); renderFinals();
}
function renderFinals() {
    const c = document.getElementById('finalsContainer'); c.innerHTML='';
    data.finals.forEach((f,i) => {
        const cls = f.type==='Finale'?'gold-final':(f.type==='Bronse'?'bronze-final':'');
        const div = document.createElement('div'); div.className = `final-card ${cls}`;
        div.innerHTML = `
            <div class="final-type-badge">${f.type}</div>
            <h4>${f.act}</h4>
            <div style="font-size:1.5rem; margin:10px;">${f.t1Name} vs ${f.t2Name}</div>
            <div class="score-input" style="justify-content:center;">
                <input type="number" value="${f.s1??''}" onchange="updFinal('${f.id}','s1',this.value)"> - 
                <input type="number" value="${f.s2??''}" onchange="updFinal('${f.id}','s2',this.value)">
            </div>
            <button class="btn-text-red" onclick="delFinal(${i})">Slett</button>
        `;
        c.appendChild(div);
    });
}
function updFinal(id, f, v) {
    const fin = data.finals.find(x=>x.id==id);
    fin[f] = v===''?null:parseInt(v);
    fin.done = (fin.s1!==null && fin.s2!==null);
    saveLocal();
    
    // Check for Winner Celebration
    if(fin.done && fin.type === 'Finale') {
        const wName = fin.s1 > fin.s2 ? fin.t1Name : (fin.s2 > fin.s1 ? fin.t2Name : "Uavgjort");
        if(wName !== "Uavgjort") showWinner(wName);
    }
}
function delFinal(i) { data.finals.splice(i,1); saveLocal(); renderFinals(); }

function showWinner(name) {
    document.getElementById('winnerText').innerText = name;
    document.getElementById('winnerOverlay').classList.remove('hidden');
    playSiren(4); // Victory horn
}
function closeWinner() { document.getElementById('winnerOverlay').classList.add('hidden'); }

// --- SOUND / UTILS ---
function genId(){ return Math.random().toString(36).substr(2,9); }
const ac = new (window.AudioContext||window.webkitAudioContext)();
let tmr=null, sec=0;
function updateTimerDisplay(s){
    const m=Math.floor(s/60).toString().padStart(2,'0');
    const ss=(s%60).toString().padStart(2,'0');
    document.getElementById('timerDisplay').innerText=`${m}:${ss}`;
}
function startTimer(){
    if(tmr) return; if(ac.state==='suspended') ac.resume();
    const dur = parseInt(data.settings.matchDuration)*60;
    if(sec===0 || sec===dur) { sec=dur; playSiren(2.5); }
    else playTone(600,0.1,'sine');
    tmr=setInterval(()=>{
        sec--; updateTimerDisplay(sec);
        if(sec<=5 && sec>0) playTone(800,0.2,'square');
        if(sec<=0) { clearInterval(tmr); tmr=null; playSiren(4); sec=dur; }
    },1000);
}
function pauseTimer(){ clearInterval(tmr); tmr=null; }
function resetTimer(){ pauseTimer(); sec=parseInt(data.settings.matchDuration)*60; updateTimerDisplay(sec); }
function testSound(){ if(ac.state==='suspended') ac.resume(); playSiren(2); }
function playTone(f,d,t){
    const o=ac.createOscillator(); const g=ac.createGain();
    o.type=t; o.frequency.value=f; o.connect(g); g.connect(ac.destination);
    g.gain.value=0.2; o.start(); o.stop(ac.currentTime+d);
}
function playSiren(d){
    const o1=ac.createOscillator(), o2=ac.createOscillator(), g=ac.createGain();
    o1.type='sawtooth'; o1.frequency.value=150;
    o2.type='sawtooth'; o2.frequency.value=155;
    o1.connect(g); o2.connect(g); g.connect(ac.destination);
    const n=ac.currentTime;
    g.gain.setValueAtTime(0,n); g.gain.linearRampToValueAtTime(1,n+0.2); g.gain.linearRampToValueAtTime(0,n+d);
    o1.start(n); o2.start(n); o1.stop(n+d); o2.stop(n+d);
}
