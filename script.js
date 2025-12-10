// --- DATA STORE ---
let data = {
    classes: ["10A","10B","10C","10D"],
    students: [],
    courts: [{id:1, name:"Bane 1", type:"Volleyball"}, {id:2, name:"Bane 2", type:"Volleyball"}, {id:3, name:"Bane 3", type:"Stikkball"}],
    teams: [],
    matches: [], // Flat list, but will be grouped in UI
    settings: { startTime: "10:15", finalsTime: "14:00", matchDuration: 15, breakDuration: 5 },
    teamsLocked: false,
    finalState: { t1:"", t2:"", type:"", act:"", s1:0, s2:0 }
};

let soundEnabled = true;

window.onload = function() {
    loadLocal();
    renderClassButtons();
    renderStudentList();
    renderCourts();
    if(data.teams.length) renderTeams();
    if(data.matches.length) renderSchedule();
    updateLeaderboard();
    
    // Start System Clock Loop
    setInterval(checkSystemTime, 1000);
};

// --- CORE UTILS ---
function saveLocal() { localStorage.setItem('ts_v5', JSON.stringify(data)); }
function loadLocal() {
    const json = localStorage.getItem('ts_v5');
    if(json) { data = {...data, ...JSON.parse(json)}; updateInputs(); }
}
function updateInputs() {
    ['startTime','finalsTime','matchDuration','breakDuration'].forEach(k => {
        const el = document.getElementById(k);
        if(el) el.value = data.settings[k];
    });
}
function genId() { return Math.random().toString(36).substr(2,9); }
function toggleSound() { 
    soundEnabled = !soundEnabled; 
    document.getElementById('soundToggleBtn').innerText = soundEnabled ? "🔊 Lyd PÅ" : "🔇 Lyd AV";
}

// --- SETUP ---
let selectedClass = "";
function renderClassButtons() {
    const d = document.getElementById('classButtons'); d.innerHTML = '';
    data.classes.forEach(c => {
        const b = document.createElement('span');
        b.className = `class-btn ${selectedClass===c?'selected':''}`;
        b.innerHTML = `${c} <i class="fas fa-times del-cls" onclick="delClass('${c}', event)"></i>`;
        b.onclick = () => { selectedClass = c; renderClassButtons(); };
        d.appendChild(b);
    });
    if(!selectedClass && data.classes.length) { selectedClass = data.classes[0]; renderClassButtons(); }
    renderCustomMixCheckboxes();
}
function addClass() {
    const v = document.getElementById('newClassInput').value.trim().toUpperCase();
    if(v && !data.classes.includes(v)) { data.classes.push(v); data.classes.sort(); saveLocal(); renderClassButtons(); }
}
function delClass(c, e) {
    e.stopPropagation();
    if(confirm("Slett klasse?")) { data.classes = data.classes.filter(x=>x!==c); saveLocal(); renderClassButtons(); }
}
function addStudents() {
    if(!selectedClass) return alert("Velg klasse");
    const txt = document.getElementById('pasteArea').value;
    txt.split('\n').forEach(l => {
        const n = l.trim(); 
        if(n) data.students.push({ id:genId(), name:n, class:selectedClass, present:true });
    });
    document.getElementById('pasteArea').value = ""; saveLocal(); renderStudentList();
}
function renderStudentList() {
    const l = document.getElementById('studentList'); l.innerHTML = '';
    document.getElementById('studentCount').innerText = data.students.length;
    data.students.sort((a,b)=>a.class.localeCompare(b.class)||a.name.localeCompare(b.name));
    data.students.forEach(s => {
        const d = document.createElement('div');
        d.className = `student-item ${s.present?'':'absent'}`;
        d.innerHTML = `<span><b>${s.class}</b> ${s.name}</span><input type="checkbox" ${s.present?'checked':''} onchange="togglePres('${s.id}')">`;
        l.appendChild(d);
    });
}
function togglePres(id) { const s = data.students.find(x=>x.id==id); if(s){s.present=!s.present; saveLocal(); renderStudentList();} }
function clearStudents() { if(confirm("Slett alle?")) { data.students=[]; saveLocal(); renderStudentList(); } }

// --- ARENA ---
function renderCourts() {
    const l = document.getElementById('courtList'); l.innerHTML = '';
    data.courts.forEach((c,i) => {
        const d = document.createElement('div'); d.className = 'court-item';
        d.innerHTML = `<span>#${i+1}</span><input value="${c.name}" onchange="updCourt(${i},'name',this.value)"><input value="${c.type}" onchange="updCourt(${i},'type',this.value)"><button class="btn-small-red" onclick="delCourt(${i})">X</button>`;
        l.appendChild(d);
    });
}
function addCourt() { data.courts.push({id:Date.now(), name:`Bane ${data.courts.length+1}`, type:"Volleyball"}); saveLocal(); renderCourts(); }
function updCourt(i,f,v) { data.courts[i][f] = v; saveLocal(); }
function delCourt(i) { data.courts.splice(i,1); saveLocal(); renderCourts(); }
['startTime','finalsTime','matchDuration','breakDuration'].forEach(id => {
    document.getElementById(id).addEventListener('change', e => { data.settings[id] = e.target.value; saveLocal(); });
});

// --- TEAMS GENERATION (THE BRAIN) ---
function toggleCustomMix() {
    const s = document.getElementById('drawStrategy').value;
    document.getElementById('customMixPanel').classList.toggle('hidden', s !== 'custom');
}
function renderCustomMixCheckboxes() {
    const d = document.getElementById('customClassCheckboxes'); d.innerHTML = '';
    data.classes.forEach(c => {
        d.innerHTML += `<div><input type="checkbox" value="${c}" id="chk_${c}"><label for="chk_${c}">${c}</label></div>`;
    });
}
function shuffle(arr) { for(let i=arr.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }

function generateTeams() {
    if(data.teamsLocked) return alert("Lagene er låst.");
    const count = parseInt(document.getElementById('teamCount').value);
    const strategy = document.getElementById('drawStrategy').value;
    const pool = data.students.filter(s => s.present);
    
    data.teams = Array.from({length: count}, (_,i) => ({id:i+1, name:`Lag ${i+1}`, members:[], points:0, stats:{gf:0, ga:0, w:0, d:0, l:0}}));

    if(strategy === 'random') {
        shuffle(pool);
        pool.forEach((s,i) => data.teams[i % count].members.push(s));
    }
    else if(strategy === 'class_based') {
        // Pure class teams. Assign buckets to teams.
        // E.g. 12 teams, 4 classes -> 3 teams per class.
        let byClass = {}; data.classes.forEach(c => byClass[c]=[]);
        pool.forEach(s => { if(byClass[s.class]) byClass[s.class].push(s); });
        
        let tIdx = 0;
        for(let c of data.classes) {
            shuffle(byClass[c]);
            const numTeamsForClass = Math.floor(count / data.classes.length); // approx
            // Simplification: Just fill teams sequentially
            while(byClass[c].length > 0) {
                // Determine which team bucket belongs to this class is hard without strict partitioning.
                // Alternative: Just distribute uniformly but keep class together? 
                // Better: Assign strict slots.
                // Re-implementation: Just fill team T_i entirely with Class C before moving to T_i+1
                data.teams[tIdx].members.push(byClass[c].pop());
                // Only move to next team if this one is "full" or we want to spread?
                // User wants "3 teams pr class". So we need to switch team after N students.
                // Let's rely on simple filling: 
            }
             // Actually, simplest logic for "Pure Class Teams":
             // Create N buckets. Distribute students into buckets matching their class.
        }
        // Retrying Class Based:
        // Group students by class. For each class, divide its students into (Count / NumClasses) teams.
        let teamsPerClass = Math.ceil(count / data.classes.length);
        let currentTeam = 0;
        for(let c of data.classes) {
            shuffle(byClass[c]);
            // Assign these students to the next `teamsPerClass` teams
            let startTeam = currentTeam;
            let endTeam = Math.min(currentTeam + teamsPerClass, count);
            let localTIdx = startTeam;
            while(byClass[c].length > 0) {
                data.teams[localTIdx].members.push(byClass[c].pop());
                localTIdx++;
                if(localTIdx >= endTeam) localTIdx = startTeam;
            }
            currentTeam = endTeam;
        }
    }
    else if(strategy === 'balanced') {
        // Perfect Mix: Team 1 gets [A, B, C, D], Team 2 gets [A, B, C, D]...
        let byClass = {}; data.classes.forEach(c => byClass[c]=[]);
        pool.forEach(s => { if(byClass[s.class]) byClass[s.class].push(s); });
        for(let c in byClass) shuffle(byClass[c]);
        
        let tIdx = 0;
        let anyLeft = true;
        while(anyLeft) {
            anyLeft = false;
            for(let c of data.classes) {
                if(byClass[c].length > 0) {
                    data.teams[tIdx].members.push(byClass[c].pop());
                    anyLeft = true;
                }
            }
            tIdx = (tIdx + 1) % count;
        }
    }
    else {
        // Split Based (AB vs CD or Custom)
        let group1Classes = [];
        if(strategy === 'ab_cd') {
            const mid = Math.ceil(data.classes.length/2);
            group1Classes = data.classes.slice(0, mid);
        } else {
            // Custom
            document.querySelectorAll('#customClassCheckboxes input:checked').forEach(cb => group1Classes.push(cb.value));
        }
        
        const pool1 = pool.filter(s => group1Classes.includes(s.class));
        const pool2 = pool.filter(s => !group1Classes.includes(s.class));
        
        const teams1 = data.teams.slice(0, Math.ceil(count/2));
        const teams2 = data.teams.slice(Math.ceil(count/2));
        
        shuffle(pool1); pool1.forEach((s,i) => teams1[i%teams1.length].members.push(s));
        shuffle(pool2); pool2.forEach((s,i) => teams2[i%teams2.length].members.push(s));
    }
    
    saveLocal(); renderTeams();
}
function renderTeams() {
    const d = document.getElementById('drawDisplay'); d.innerHTML = '';
    data.teams.forEach(t => {
        const card = document.createElement('div'); card.className = 'team-card';
        const mems = t.members.map((m,i) => `<div class="team-member"><span>${i+1}. ${m.name}</span><span class="team-class-badge">${m.class}</span></div>`).join('');
        card.innerHTML = `<h3><input value="${t.name}" onchange="renameTeam(${t.id},this.value)" style="background:none;border:none;color:inherit;text-align:center;width:100%;font-weight:bold;"></h3><div>${mems}</div>`;
        d.appendChild(card);
    });
    const l = document.getElementById('lockBtn');
    l.className = data.teamsLocked ? 'btn-small-red' : 'btn-yellow';
    l.innerHTML = data.teamsLocked ? '<i class="fas fa-lock"></i> Låst' : '<i class="fas fa-unlock"></i> Åpen';
}
function renameTeam(id,v) { data.teams.find(t=>t.id==id).name=v; saveLocal(); updateLeaderboard(); }
function toggleLockTeams() { data.teamsLocked = !data.teamsLocked; saveLocal(); renderTeams(); }

// --- SCHEDULE ---
function generateSchedule() {
    if(!data.teamsLocked) toggleLockTeams();
    if(data.courts.length === 0) return alert("Ingen baner!");
    
    data.matches = [];
    let time = new Date(`2000-01-01T${data.settings.startTime}`);
    const endTime = new Date(`2000-01-01T${data.settings.finalsTime}`);
    const slotDur = parseInt(data.settings.matchDuration) + parseInt(data.settings.breakDuration);
    
    // Simple Round Robin pairing
    let tIds = data.teams.map(t=>t.id);
    if(tIds.length % 2 !== 0) tIds.push(null);
    let pairs = [];
    for(let r=0; r < tIds.length-1; r++) {
        for(let i=0; i<tIds.length/2; i++) {
            const a = tIds[i], b = tIds[tIds.length-1-i];
            if(a && b) pairs.push({t1:a, t2:b});
        }
        tIds.splice(1, 0, tIds.pop());
    }
    
    // Assign to slots
    while(time < endTime && pairs.length > 0) {
        let active = [];
        data.courts.forEach(c => {
            if(pairs.length) {
                // Find pair not playing
                const idx = pairs.findIndex(p => !active.some(a => a.t1==p.t1 || a.t2==p.t1 || a.t1==p.t2 || a.t2==p.t2));
                if(idx > -1) {
                    const p = pairs.splice(idx,1)[0];
                    active.push({...p, c:c.name, type:c.type});
                }
            }
        });
        
        const timeStr = time.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'});
        active.forEach(m => {
            data.matches.push({id:genId(), time:timeStr, t1:m.t1, t2:m.t2, court:m.c, type:m.type, s1:null, s2:null, done:false});
        });
        
        time.setMinutes(time.getMinutes() + slotDur);
    }
    saveLocal(); renderSchedule();
}

function renderSchedule() {
    const c = document.getElementById('scheduleContainer'); c.innerHTML = '';
    // Group by time
    const groups = {};
    data.matches.sort((a,b)=>a.time.localeCompare(b.time));
    data.matches.forEach(m => { if(!groups[m.time]) groups[m.time]=[]; groups[m.time].push(m); });
    
    for(let time in groups) {
        const blk = document.createElement('div'); blk.className = 'match-block';
        blk.innerHTML = `
            <div class="block-header">
                <span class="block-time">Kl ${time}</span>
                <div>
                    <button class="shift-btn" onclick="shiftSchedule('${time}')">Forskyv herfra</button>
                    <button class="btn-text-red" onclick="delBlock('${time}')">Slett bolk</button>
                </div>
            </div>
        `;
        groups[time].forEach(m => {
            const t1 = data.teams.find(t=>t.id==m.t1);
            const t2 = data.teams.find(t=>t.id==m.t2);
            if(!t1 || !t2) return;
            const row = document.createElement('div'); row.className = 'match-row';
            row.innerHTML = `
                <div class="match-court-badge">${m.court}<br><small>${m.type}</small></div>
                <div class="match-teams">${t1.name} vs ${t2.name}</div>
                <div class="match-score">
                    <input type="number" value="${m.s1??''}" onchange="updScore('${m.id}','s1',this.value)"> - 
                    <input type="number" value="${m.s2??''}" onchange="updScore('${m.id}','s2',this.value)">
                </div>
            `;
            blk.appendChild(row);
        });
        c.appendChild(blk);
    }
}
function updScore(id,f,v) { 
    const m = data.matches.find(x=>x.id==id); m[f]=v===''?null:parseInt(v); 
    m.done = (m.s1!==null && m.s2!==null); saveLocal(); updateLeaderboard(); 
}
function delBlock(time) { if(confirm("Slett alle kamper kl " + time +"?")) { data.matches=data.matches.filter(m=>m.time!==time); saveLocal(); renderSchedule(); } }
function addManualMatch() {
    if(!data.teams.length) return;
    const t = data.teams[0];
    data.matches.push({id:genId(), time:"12:00", t1:t.id, t2:t.id, court:"Manuell", type:"Ekstra", s1:null, s2:null, done:false});
    saveLocal(); renderSchedule();
}
function clearSchedule() { if(confirm("Slett alt?")) { data.matches=[]; saveLocal(); renderSchedule(); updateLeaderboard(); } }
function shiftSchedule(fromTime) {
    const min = prompt("Antall minutter forskyvning?", "5");
    if(!min) return;
    const offset = parseInt(min);
    data.matches.forEach(m => {
        if(m.time >= fromTime) {
            let [h,m_] = m.time.split(':').map(Number);
            let d = new Date(); d.setHours(h, m_+offset);
            m.time = d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        }
    });
    saveLocal(); renderSchedule();
}

// --- LEADERBOARD ---
function updateLeaderboard() {
    data.teams.forEach(t => { t.points=0; t.stats={gf:0, ga:0, w:0, d:0, l:0}; });
    data.matches.forEach(m => {
        if(m.done) {
            const t1 = data.teams.find(t=>t.id==m.t1);
            const t2 = data.teams.find(t=>t.id==m.t2);
            if(t1&&t2) {
                t1.stats.gf+=m.s1; t1.stats.ga+=m.s2;
                t2.stats.gf+=m.s2; t2.stats.ga+=m.s1;
                if(m.s1>m.s2) { t1.points+=3; t1.stats.w++; }
                else if(m.s2>m.s1) { t2.points+=3; t2.stats.w++; }
                else { t1.points+=1; t2.points+=1; t1.stats.d++; t2.stats.d++; }
            }
        }
    });
    data.teams.sort((a,b) => b.points-a.points || (b.stats.gf-b.stats.ga)-(a.stats.gf-a.stats.ga));
    
    // Update Final Selects
    const s1 = document.getElementById('finalTeam1');
    const s2 = document.getElementById('finalTeam2');
    const html = data.teams.map((t,i) => `<option value="${t.id}">${i+1}. ${t.name} (${t.points}p)</option>`).join('');
    if(s1) s1.innerHTML = html; 
    if(s2) s2.innerHTML = html;
    if(data.teams.length>1 && s2) s2.selectedIndex = 1;

    // Mini Leaderboard
    const mb = document.getElementById('miniLeaderboard');
    if(mb) {
        mb.innerHTML = data.teams.slice(0, 8).map((t,i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.points}</td></tr>`).join('');
    }
}

// --- SYSTEM CLOCK & ALERTS ---
let lastAlertTime = "";
const audioCtx = new (window.AudioContext||window.webkitAudioContext)();

function checkSystemTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    document.getElementById('realTimeClock').innerText = timeStr;
    
    // Find next match time
    const shortTime = timeStr.substr(0,5); // HH:MM
    const nextMatch = data.matches.find(m => m.time > shortTime);
    
    const info = document.getElementById('nextEventInfo');
    if(nextMatch) {
        info.innerText = `Neste kamp: Kl ${nextMatch.time}`;
        
        // CHECK 1 MIN WARNING
        // Calculate diff
        const [h, m] = nextMatch.time.split(':').map(Number);
        const matchDate = new Date(); matchDate.setHours(h, m, 0);
        const diffMs = matchDate - now;
        
        // Alert if between 59s and 61s left (to trigger once)
        if(diffMs > 59000 && diffMs < 61000 && lastAlertTime !== nextMatch.time) {
            lastAlertTime = nextMatch.time;
            if(soundEnabled) playHighAlert();
        }
    } else {
        info.innerText = "Ingen flere kamper";
    }
}

function playHighAlert() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(1500, audioCtx.currentTime + 0.5);
    osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 1.0);
    g.gain.setValueAtTime(0.5, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 1.5);
}

// --- FINALS LOGIC ---
let finalTimer = null;
let finalSec = 900;

function setActiveFinal() {
    const t1 = data.teams.find(t=>t.id==document.getElementById('finalTeam1').value);
    const t2 = data.teams.find(t=>t.id==document.getElementById('finalTeam2').value);
    document.getElementById('stageTitle').innerText = document.getElementById('finalType').value;
    document.getElementById('stageActivity').innerText = document.getElementById('finalAct').value;
    document.getElementById('stageT1').innerText = t1.name;
    document.getElementById('stageT2').innerText = t2.name;
    
    // Reset scores & timer
    document.getElementById('stageS1').value = 0;
    document.getElementById('stageS2').value = 0;
    resetFinalTimer();
}

function updateStageScore() {
    // Just visual unless we want to store it as a "Special Match"
}

function startFinalTimer() {
    if(finalTimer) return;
    if(audioCtx.state==='suspended') audioCtx.resume();
    playHorn();
    finalTimer = setInterval(() => {
        finalSec--;
        const m=Math.floor(finalSec/60).toString().padStart(2,'0');
        const s=(finalSec%60).toString().padStart(2,'0');
        document.getElementById('finalTimerDisplay').innerText = `${m}:${s}`;
        if(finalSec<=0) { pauseFinalTimer(); playHorn(); }
    }, 1000);
}
function pauseFinalTimer() { clearInterval(finalTimer); finalTimer=null; }
function resetFinalTimer() { pauseFinalTimer(); finalSec = parseInt(data.settings.matchDuration)*60; document.getElementById('finalTimerDisplay').innerText = "15:00"; }
function playHorn() {
    // Deep Horn
    const osc = audioCtx.createOscillator(); osc.type='sawtooth'; osc.frequency.value=150;
    const osc2 = audioCtx.createOscillator(); osc2.type='square'; osc2.frequency.value=148;
    const g = audioCtx.createGain();
    osc.connect(g); osc2.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(1, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime+2.5);
    osc.start(); osc2.start(); osc.stop(audioCtx.currentTime+2.5); osc2.stop(audioCtx.currentTime+2.5);
}

function endTournament() {
    const s1 = parseInt(document.getElementById('stageS1').value);
    const s2 = parseInt(document.getElementById('stageS2').value);
    const t1 = document.getElementById('stageT1').innerText;
    const t2 = document.getElementById('stageT2').innerText;
    
    let w = "UAVGJORT";
    if(s1 > s2) w = t1;
    if(s2 > s1) w = t2;
    
    document.getElementById('winnerText').innerText = w;
    document.getElementById('winnerOverlay').classList.remove('hidden');
    
    // Confetti CSS effect
    createConfetti();
    playFanfare();
}
function closeWinner() { document.getElementById('winnerOverlay').classList.add('hidden'); }

function createConfetti() {
    const c = document.querySelector('.confetti'); c.innerHTML='';
    for(let i=0; i<50; i++) {
        const p = document.createElement('div');
        p.style.left = Math.random()*100 + '%';
        p.style.animationDelay = Math.random()*2 + 's';
        p.style.backgroundColor = `hsl(${Math.random()*360}, 100%, 50%)`;
        c.appendChild(p);
    }
}
function playFanfare() {
    // Simple Arpeggio
    const now = audioCtx.currentTime;
    [0, 0.2, 0.4, 0.8].forEach((t, i) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.frequency.value = [523.25, 659.25, 783.99, 1046.50][i]; // C Major
        osc.connect(g); g.connect(audioCtx.destination);
        g.gain.exponentialRampToValueAtTime(0.01, now + t + 1);
        osc.start(now + t); osc.stop(now + t + 1);
    });
}
