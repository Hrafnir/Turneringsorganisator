// --- DATA STORE ---
let data = {
    title: "Turnering",
    classes: ["10A","10B","10C","10D"],
    students: [],
    courts: [{id:1, name:"Bane 1", type:"Volleyball"}, {id:2, name:"Bane 2", type:"Volleyball"}, {id:3, name:"Bane 3", type:"Stikkball"}],
    teams: [],
    matches: [],
    settings: { startTime: "10:15", finalsTime: "14:00", matchDuration: 15, breakDuration: 5 },
    teamsLocked: false
};

let soundEnabled = true;
let wakeLock = null;

// --- INIT (DOMContentLoaded ensures HTML is ready) ---
document.addEventListener("DOMContentLoaded", function() {
    loadLocal();
    renderClassButtons();
    renderStudentList();
    renderCourts();
    if(data.teams.length) renderTeams();
    if(data.matches.length) renderSchedule();
    updateLeaderboard();
    setInterval(checkSystemTime, 1000);
});

// --- CORE UTILS ---
function saveLocal() { localStorage.setItem('ts_v6', JSON.stringify(data)); }
function loadLocal() {
    const json = localStorage.getItem('ts_v6');
    if(json) { data = {...data, ...JSON.parse(json)}; updateInputs(); }
    document.getElementById('displayTitle').innerText = data.title;
    document.getElementById('tournamentTitleInput').value = data.title;
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
function updateTitle(val) {
    data.title = val;
    document.getElementById('displayTitle').innerText = val;
    saveLocal();
}

// --- WAKE LOCK (No Sleep) ---
async function toggleWakeLock() {
    const btn = document.getElementById('wakeLockBtn');
    if(wakeLock !== null) {
        wakeLock.release().then(() => { wakeLock = null; btn.classList.remove('active'); btn.innerHTML='<i class="fas fa-eye"></i> Skjerm: Auto'; });
    } else {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            btn.classList.add('active');
            btn.innerHTML='<i class="fas fa-eye"></i> Skjerm: PÅ (Låst)';
        } catch(err) {
            alert("Nettleseren din støtter kanskje ikke Wake Lock, eller du må ha HTTPS.");
        }
    }
}

// --- TABS ---
window.showTab = function(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Highlight active button logic
    const btns = document.querySelectorAll('.tabs button');
    if(id === 'setup') btns[0].classList.add('active');
    if(id === 'arena') btns[1].classList.add('active');
    if(id === 'draw') btns[2].classList.add('active');
    if(id === 'matches') btns[3].classList.add('active');
    if(id === 'finals') btns[4].classList.add('active');
};

// --- SETUP ---
let selectedClass = "";
window.renderClassButtons = function() {
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
};
window.addClass = function() {
    const v = document.getElementById('newClassInput').value.trim().toUpperCase();
    if(v && !data.classes.includes(v)) { data.classes.push(v); data.classes.sort(); saveLocal(); renderClassButtons(); }
};
window.delClass = function(c, e) {
    e.stopPropagation();
    if(confirm("Slett klasse?")) { data.classes = data.classes.filter(x=>x!==c); saveLocal(); renderClassButtons(); }
};
window.addStudents = function() {
    if(!selectedClass) return alert("Velg klasse");
    const txt = document.getElementById('pasteArea').value;
    txt.split('\n').forEach(l => {
        const n = l.trim(); 
        if(n) data.students.push({ id:genId(), name:n, class:selectedClass, present:true });
    });
    document.getElementById('pasteArea').value = ""; saveLocal(); renderStudentList();
};
window.renderStudentList = function() {
    const l = document.getElementById('studentList'); l.innerHTML = '';
    const query = document.getElementById('studentSearch').value.toLowerCase();
    
    document.getElementById('studentCount').innerText = data.students.length;
    
    let filtered = data.students.filter(s => s.name.toLowerCase().includes(query) || s.class.toLowerCase().includes(query));
    filtered.sort((a,b)=>a.class.localeCompare(b.class)||a.name.localeCompare(b.name));
    
    filtered.forEach(s => {
        const d = document.createElement('div');
        d.className = `student-item ${s.present?'':'absent'}`;
        d.innerHTML = `<span><b>${s.class}</b> ${s.name}</span><input type="checkbox" ${s.present?'checked':''} onchange="togglePres('${s.id}')">`;
        l.appendChild(d);
    });
};
window.togglePres = function(id) { const s = data.students.find(x=>x.id==id); if(s){s.present=!s.present; saveLocal(); renderStudentList();} };
window.clearStudents = function() { if(confirm("Slett alle?")) { data.students=[]; saveLocal(); renderStudentList(); } };

// --- ARENA ---
window.renderCourts = function() {
    const l = document.getElementById('courtList'); l.innerHTML = '';
    data.courts.forEach((c,i) => {
        const d = document.createElement('div'); d.className = 'court-item';
        d.innerHTML = `<span>#${i+1}</span><input value="${c.name}" onchange="updCourt(${i},'name',this.value)"><input value="${c.type}" onchange="updCourt(${i},'type',this.value)"><button class="btn-small-red" onclick="delCourt(${i})">X</button>`;
        l.appendChild(d);
    });
};
window.addCourt = function() { data.courts.push({id:Date.now(), name:`Bane ${data.courts.length+1}`, type:"Volleyball"}); saveLocal(); renderCourts(); };
window.updCourt = function(i,f,v) { data.courts[i][f] = v; saveLocal(); };
window.delCourt = function(i) { data.courts.splice(i,1); saveLocal(); renderCourts(); };
['startTime','finalsTime','matchDuration','breakDuration'].forEach(id => {
    document.getElementById(id).addEventListener('change', e => { data.settings[id] = e.target.value; saveLocal(); });
});

// --- TIME RECALCULATION ---
window.recalcFutureSchedule = function() {
    if(data.matches.length === 0) return alert("Ingen kamper å oppdatere.");
    
    // Find all distinct times currently in schedule
    let times = [...new Set(data.matches.map(m => m.time))].sort();
    
    // Ask user where to start update
    // Simple logic: Find first match not marked done? Or just update ALL future times based on NOW?
    // Let's check the current system time
    const now = new Date();
    const curTimeStr = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    
    // Filter times that are in the future
    let futureTimes = times.filter(t => t >= curTimeStr);
    
    if(futureTimes.length === 0) return alert("Ingen fremtidige kamp-bolker funnet (basert på klokkeslett).");
    
    if(!confirm(`Vil du oppdatere tidene for ${futureTimes.length} kommende kamp-bolker basert på ${data.settings.matchDuration} min kamp + ${data.settings.breakDuration} min pause?`)) return;

    const matchDur = parseInt(data.settings.matchDuration);
    const breakDur = parseInt(data.settings.breakDuration);
    const slotDur = matchDur + breakDur;

    // Start calculation from the FIRST future time slot found
    let [h, m] = futureTimes[0].split(':').map(Number);
    let baseDate = new Date(); baseDate.setHours(h, m, 0);

    // Update matches block by block
    futureTimes.forEach(oldTime => {
        const newTimeStr = baseDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        
        // Find matches with oldTime and update
        data.matches.forEach(match => {
            if(match.time === oldTime) match.time = newTimeStr;
        });

        // Increment baseDate for next block
        baseDate.setMinutes(baseDate.getMinutes() + slotDur);
    });

    saveLocal();
    renderSchedule();
    alert("Tider oppdatert!");
};

// --- TEAMS GENERATION ---
window.toggleCustomMix = function() {
    const s = document.getElementById('drawStrategy').value;
    document.getElementById('customMixPanel').classList.toggle('hidden', s !== 'custom');
};
window.renderCustomMixCheckboxes = function() {
    const d = document.getElementById('customClassCheckboxes'); d.innerHTML = '';
    data.classes.forEach(c => {
        d.innerHTML += `<div><input type="checkbox" value="${c}" id="chk_${c}"><label for="chk_${c}">${c}</label></div>`;
    });
};
function shuffle(arr) { for(let i=arr.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }

window.generateTeams = function() {
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
        let byClass = {}; data.classes.forEach(c => byClass[c]=[]);
        pool.forEach(s => { if(byClass[s.class]) byClass[s.class].push(s); });
        let teamsPerClass = Math.ceil(count / data.classes.length);
        let currentTeam = 0;
        for(let c of data.classes) {
            shuffle(byClass[c]);
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
        let byClass = {}; data.classes.forEach(c => byClass[c]=[]);
        pool.forEach(s => { if(byClass[s.class]) byClass[s.class].push(s); });
        for(let c in byClass) shuffle(byClass[c]);
        let tIdx = 0; let anyLeft = true;
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
        let group1Classes = [];
        if(strategy === 'ab_cd') {
            const mid = Math.ceil(data.classes.length/2);
            group1Classes = data.classes.slice(0, mid);
        } else {
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
};
window.renderTeams = function() {
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
};
window.renameTeam = function(id,v) { data.teams.find(t=>t.id==id).name=v; saveLocal(); updateLeaderboard(); };
window.toggleLockTeams = function() { data.teamsLocked = !data.teamsLocked; saveLocal(); renderTeams(); };

// --- SCHEDULE ---
window.generateSchedule = function() {
    if(!data.teamsLocked) toggleLockTeams();
    if(data.courts.length === 0) return alert("Ingen baner!");
    
    data.matches = [];
    let time = new Date(`2000-01-01T${data.settings.startTime}`);
    const endTime = new Date(`2000-01-01T${data.settings.finalsTime}`);
    const slotDur = parseInt(data.settings.matchDuration) + parseInt(data.settings.breakDuration);
    
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
    
    while(time < endTime && pairs.length > 0) {
        let active = [];
        data.courts.forEach(c => {
            if(pairs.length) {
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
};

window.renderSchedule = function() {
    const c = document.getElementById('scheduleContainer'); c.innerHTML = '';
    const groups = {};
    data.matches.sort((a,b)=>a.time.localeCompare(b.time));
    data.matches.forEach(m => { if(!groups[m.time]) groups[m.time]=[]; groups[m.time].push(m); });
    
    for(let time in groups) {
        const blk = document.createElement('div'); blk.className = 'match-block';
        blk.innerHTML = `
            <div class="block-header">
                <span class="block-time">Kl ${time}</span>
                <button class="btn-text-red" onclick="delBlock('${time}')">Slett bolk</button>
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
};
window.updScore = function(id,f,v) { 
    const m = data.matches.find(x=>x.id==id); m[f]=v===''?null:parseInt(v); 
    m.done = (m.s1!==null && m.s2!==null); saveLocal(); updateLeaderboard(); 
};
window.delBlock = function(time) { if(confirm("Slett alle kamper kl " + time +"?")) { data.matches=data.matches.filter(m=>m.time!==time); saveLocal(); renderSchedule(); } };
window.addManualMatch = function() {
    if(!data.teams.length) return;
    const t = data.teams[0];
    data.matches.push({id:genId(), time:"12:00", t1:t.id, t2:t.id, court:"Manuell", type:"Ekstra", s1:null, s2:null, done:false});
    saveLocal(); renderSchedule();
};
window.clearSchedule = function() { if(confirm("Slett alt?")) { data.matches=[]; saveLocal(); renderSchedule(); updateLeaderboard(); } };

// --- LEADERBOARD ---
window.updateLeaderboard = function() {
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
    
    const s1 = document.getElementById('finalTeam1');
    const s2 = document.getElementById('finalTeam2');
    if(s1 && s2) {
        const html = data.teams.map((t,i) => `<option value="${t.id}">${i+1}. ${t.name} (${t.points}p)</option>`).join('');
        if(!s1.innerHTML || s1.innerHTML !== html) {
             // Keep selection if possible
             const v1 = s1.value; const v2 = s2.value;
             s1.innerHTML = html; s2.innerHTML = html;
             if(v1) s1.value = v1; 
             if(v2) s2.value = v2; else if(data.teams.length>1) s2.selectedIndex = 1;
        }
    }
    const mb = document.getElementById('miniLeaderboard');
    if(mb) mb.innerHTML = data.teams.slice(0, 8).map((t,i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.points}</td></tr>`).join('');
};

// --- SYSTEM CLOCK & ALERTS ---
let lastAlertTime = "";
const audioCtx = new (window.AudioContext||window.webkitAudioContext)();

window.checkSystemTime = function() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    const el = document.getElementById('realTimeClock');
    if(el) el.innerText = timeStr;
    
    const shortTime = timeStr.substr(0,5);
    const nextMatch = data.matches.find(m => m.time > shortTime);
    const info = document.getElementById('nextEventInfo');
    
    if(nextMatch && info) {
        info.innerText = `Neste: Kl ${nextMatch.time}`;
        const [h, m] = nextMatch.time.split(':').map(Number);
        const matchDate = new Date(); matchDate.setHours(h, m, 0);
        const diffMs = matchDate - now;
        if(diffMs > 59000 && diffMs < 61000 && lastAlertTime !== nextMatch.time) {
            lastAlertTime = nextMatch.time;
            if(soundEnabled) playHighAlert();
        }
    } else if(info) {
        info.innerText = "Ingen flere kamper";
    }
};

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
window.setActiveFinal = function() {
    const t1 = data.teams.find(t=>t.id==document.getElementById('finalTeam1').value);
    const t2 = data.teams.find(t=>t.id==document.getElementById('finalTeam2').value);
    document.getElementById('stageTitle').innerText = document.getElementById('finalType').value;
    document.getElementById('stageActivity').innerText = document.getElementById('finalAct').value;
    document.getElementById('stageT1').innerText = t1.name;
    document.getElementById('stageT2').innerText = t2.name;
    document.getElementById('stageS1').value = 0;
    document.getElementById('stageS2').value = 0;
    resetFinalTimer();
};
window.startFinalTimer = function() {
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
};
window.pauseFinalTimer = function() { clearInterval(finalTimer); finalTimer=null; };
window.resetFinalTimer = function() { pauseFinalTimer(); finalSec = parseInt(data.settings.matchDuration)*60; document.getElementById('finalTimerDisplay').innerText = "15:00"; };
window.playHorn = function() {
    const osc = audioCtx.createOscillator(); osc.type='sawtooth'; osc.frequency.value=150;
    const osc2 = audioCtx.createOscillator(); osc2.type='square'; osc2.frequency.value=148;
    const g = audioCtx.createGain();
    osc.connect(g); osc2.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(1, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime+2.5);
    osc.start(); osc2.start(); osc.stop(audioCtx.currentTime+2.5); osc2.stop(audioCtx.currentTime+2.5);
};
window.endTournament = function() {
    const s1 = parseInt(document.getElementById('stageS1').value);
    const s2 = parseInt(document.getElementById('stageS2').value);
    const t1 = document.getElementById('stageT1').innerText;
    const t2 = document.getElementById('stageT2').innerText;
    let w = "UAVGJORT";
    if(s1 > s2) w = t1;
    if(s2 > s1) w = t2;
    document.getElementById('winnerText').innerText = w;
    document.getElementById('winnerOverlay').classList.remove('hidden');
    createConfetti(); playFanfare();
};
window.closeWinner = function() { document.getElementById('winnerOverlay').classList.add('hidden'); };
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
    const now = audioCtx.currentTime;
    [0, 0.2, 0.4, 0.8].forEach((t, i) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.frequency.value = [523.25, 659.25, 783.99, 1046.50][i];
        osc.connect(g); g.connect(audioCtx.destination);
        g.gain.exponentialRampToValueAtTime(0.01, now + t + 1);
        osc.start(now + t); osc.stop(now + t + 1);
    });
}
window.saveToFile = function() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `turnering_v6_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
};
window.loadFromFile = function() {
    const file = document.getElementById('fileInput').files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try { data = JSON.parse(e.target.result); saveLocal(); location.reload(); }
        catch(err) { alert("Feil filformat"); }
    };
    reader.readAsText(file);
};
window.confirmReset = function() { if(confirm("Slett ALT?")) { localStorage.removeItem('ts_v6'); location.reload(); } };
