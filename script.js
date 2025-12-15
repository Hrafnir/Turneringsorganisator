/* Version: #18 */

// =============================================================
// 1. GLOBAL STATE
// =============================================================
window.data = {
    title: "Skoleturnering",
    classes: ["10A", "10B", "10C", "10D"],
    students: [],
    courts: [
        { id: 1, name: "Bane 1", type: "Volleyball" },
        { id: 2, name: "Bane 2", type: "Volleyball" },
        { id: 3, name: "Bane 3", type: "Stikkball" }
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

// Timer State
let timerInterval = null;
let timerSeconds = 15 * 60;
let isTimerRunning = false;

// Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Drag & Drop State
let draggedMemberId = null;
let draggedFromTeamId = null;

// =============================================================
// 2. INITIALIZATION
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
    loadLocal();
    renderClassButtons();
    renderStudentList();
    renderCourts();
    
    if(window.data.teams.length > 0) renderTeams();
    if(window.data.matches.length > 0) renderSchedule();
    updateLeaderboard();
    
    // Init timer display
    updateTimerDisplay();
});

// =============================================================
// 3. PERSISTENCE & CORE UTILS
// =============================================================
window.saveLocal = function() {
    localStorage.setItem('ts_v18_data', JSON.stringify(window.data));
};

function loadLocal() {
    const json = localStorage.getItem('ts_v18_data');
    if(json) {
        try {
            const parsed = JSON.parse(json);
            window.data = { ...window.data, ...parsed };
        } catch(e) { console.error("Data load fail", e); }
    }
    // Update inputs
    document.getElementById('displayTitle').innerText = window.data.title;
    document.getElementById('tournamentTitleInput').value = window.data.title;
    document.getElementById('printTitle').innerText = window.data.title;
    if(document.getElementById('printTitleTeams')) document.getElementById('printTitleTeams').innerText = window.data.title;
    
    ['startTime','finalsTime','matchDuration','breakDuration'].forEach(k => {
        const el = document.getElementById(k);
        if(el) el.value = window.data.settings[k];
    });
}

window.updateTitle = function(val) {
    window.data.title = val;
    document.getElementById('displayTitle').innerText = val;
    document.getElementById('printTitle').innerText = val;
    if(document.getElementById('printTitleTeams')) document.getElementById('printTitleTeams').innerText = val;
    saveLocal();
};

window.genId = function() { 
    return Math.random().toString(36).substr(2, 9); 
};

window.confirmReset = function() {
    if(confirm("Er du sikker på at du vil slette ALT?")) {
        localStorage.removeItem('ts_v18_data');
        location.reload();
    }
};

window.showTab = function(id) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tabs-bar button').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    const btns = document.querySelectorAll('.tabs-bar button');
    const map = {'setup':0,'arena':1,'draw':2,'schedule':3,'control':4,'finals':5};
    if(map[id] !== undefined) btns[map[id]].classList.add('active');
};

// =============================================================
// 4. SETUP
// =============================================================
let selectedClass = "";

window.renderClassButtons = function() {
    const d = document.getElementById('classButtons');
    d.innerHTML = '';
    window.data.classes.forEach(c => {
        const btn = document.createElement('span');
        btn.className = `class-btn ${selectedClass === c ? 'selected' : ''}`;
        btn.innerHTML = `${c} <i class="fas fa-times del-cls" onclick="delClass('${c}', event)"></i>`;
        btn.onclick = () => { selectedClass = c; renderClassButtons(); };
        d.appendChild(btn);
    });
    if(!selectedClass && window.data.classes.length > 0) {
        selectedClass = window.data.classes[0];
        renderClassButtons();
    }
    renderCustomMixCheckboxes();
};

window.addClass = function() {
    const val = document.getElementById('newClassInput').value.trim().toUpperCase();
    if(val && !window.data.classes.includes(val)) {
        window.data.classes.push(val);
        window.data.classes.sort();
        saveLocal();
        renderClassButtons();
    }
};

window.delClass = function(c, e) {
    e.stopPropagation();
    if(confirm(`Slette klassen ${c}?`)) {
        window.data.classes = window.data.classes.filter(x => x !== c);
        if(selectedClass === c) selectedClass = "";
        saveLocal();
        renderClassButtons();
    }
};

window.addStudents = function() {
    if(!selectedClass) return alert("Velg en klasse først.");
    const txt = document.getElementById('pasteArea').value;
    const lines = txt.split('\n');
    lines.forEach(line => {
        const name = line.trim();
        if(name) {
            window.data.students.push({
                id: genId(),
                name: name,
                class: selectedClass,
                present: true
            });
        }
    });
    document.getElementById('pasteArea').value = "";
    saveLocal();
    renderStudentList();
};

window.renderStudentList = function() {
    const container = document.getElementById('studentList');
    container.innerHTML = '';
    const search = document.getElementById('studentSearch').value.toLowerCase();
    
    document.getElementById('studentCount').innerText = window.data.students.length;
    
    window.data.students.sort((a,b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name));
    
    window.data.students.forEach(s => {
        if(s.name.toLowerCase().includes(search) || s.class.toLowerCase().includes(search)) {
            const div = document.createElement('div');
            div.className = `student-item ${s.present ? '' : 'absent'}`;
            div.innerHTML = `
                <span><b>${s.class}</b> ${s.name}</span>
                <input type="checkbox" ${s.present ? 'checked' : ''} onchange="toggleStudent('${s.id}')">
            `;
            container.appendChild(div);
        }
    });
};

window.toggleStudent = function(id) {
    const s = window.data.students.find(x => x.id === id);
    if(s) { s.present = !s.present; saveLocal(); renderStudentList(); }
};

window.clearStudents = function() {
    if(confirm("Slette ALLE elever?")) {
        window.data.students = [];
        saveLocal();
        renderStudentList();
    }
};

// =============================================================
// 5. ARENA
// =============================================================
window.renderCourts = function() {
    const d = document.getElementById('courtList');
    d.innerHTML = '';
    window.data.courts.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = 'court-item';
        div.innerHTML = `
            <input value="${c.name}" onchange="updCourt(${i},'name',this.value)" style="width:40%">
            <input value="${c.type}" onchange="updCourt(${i},'type',this.value)" style="width:40%">
            <button class="btn-small-red" onclick="delCourt(${i})">X</button>
        `;
        d.appendChild(div);
    });
};

window.addCourt = function() {
    window.data.courts.push({ id: Date.now(), name: `Bane ${window.data.courts.length+1}`, type: "Aktivitet" });
    saveLocal(); renderCourts();
};
window.updCourt = function(i, f, v) { window.data.courts[i][f] = v; saveLocal(); };
window.delCourt = function(i) { window.data.courts.splice(i, 1); saveLocal(); renderCourts(); };

['startTime', 'finalsTime', 'matchDuration', 'breakDuration'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
        window.data.settings[id] = e.target.value;
        saveLocal();
    });
});

// =============================================================
// 6. TEAM GENERATION
// =============================================================
window.toggleCustomMix = function() {
    const s = document.getElementById('drawStrategy').value;
    document.getElementById('customMixPanel').classList.toggle('hidden', s !== 'custom');
};

window.renderCustomMixCheckboxes = function() {
    const d = document.getElementById('customClassCheckboxes');
    d.innerHTML = '';
    window.data.classes.forEach(c => {
        d.innerHTML += `<label style="background:#333;padding:5px;border-radius:4px;display:flex;align-items:center;gap:5px;"><input type="checkbox" value="${c}">${c}</label>`;
    });
};

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

window.generateTeams = function() {
    if(window.data.teamsLocked) return alert("Lagene er låst. Lås opp først.");
    
    const count = parseInt(document.getElementById('teamCount').value);
    const strategy = document.getElementById('drawStrategy').value;
    const presentStudents = window.data.students.filter(s => s.present);
    
    window.data.teams = Array.from({length: count}, (_, i) => ({
        id: i+1,
        name: `Lag ${i+1}`,
        members: [],
        points: 0,
        stats: { played:0, w:0, d:0, l:0, gf:0, ga:0 }
    }));

    if(strategy === 'balanced') {
        // PERFEKT MIKS: Sort by class, distribute round robin
        let buckets = {};
        window.data.classes.forEach(c => {
            buckets[c] = presentStudents.filter(s => s.class === c);
            shuffle(buckets[c]);
        });
        
        let deck = [];
        let anyLeft = true;
        // Interleave classes: A, B, C, D, A, B, C, D...
        while(anyLeft) {
            anyLeft = false;
            window.data.classes.forEach(c => {
                if(buckets[c] && buckets[c].length > 0) {
                    deck.push(buckets[c].pop());
                    anyLeft = true;
                }
            });
        }
        
        // Deal deck to teams
        deck.forEach((s, i) => {
            window.data.teams[i % count].members.push(s);
        });
    }
    
    else if(strategy === 'class_based') {
        let teamsPerClass = Math.ceil(count / window.data.classes.length);
        let currentTeamIdx = 0;
        
        window.data.classes.forEach(c => {
            let classStudents = presentStudents.filter(s => s.class === c);
            shuffle(classStudents);
            let startTeam = currentTeamIdx;
            let endTeam = Math.min(startTeam + teamsPerClass, count);
            let localIdx = startTeam;
            
            while(classStudents.length > 0) {
                if(localIdx >= endTeam) localIdx = startTeam;
                if(localIdx < count) {
                    window.data.teams[localIdx].members.push(classStudents.pop());
                } else {
                    window.data.teams[0].members.push(classStudents.pop());
                }
                localIdx++;
            }
            currentTeamIdx = endTeam;
        });
    }
    else if(strategy === 'random') {
        let pool = [...presentStudents];
        shuffle(pool);
        pool.forEach((s, i) => {
            window.data.teams[i % count].members.push(s);
        });
    }
    else {
        // Split (AB vs CD or Custom)
        let group1Classes = [];
        if(strategy === 'ab_cd') {
            const mid = Math.ceil(window.data.classes.length / 2);
            group1Classes = window.data.classes.slice(0, mid);
        } else {
            document.querySelectorAll('#customClassCheckboxes input:checked').forEach(cb => group1Classes.push(cb.value));
        }
        const pool1 = presentStudents.filter(s => group1Classes.includes(s.class));
        const pool2 = presentStudents.filter(s => !group1Classes.includes(s.class));
        const teams1 = window.data.teams.slice(0, Math.ceil(count/2));
        const teams2 = window.data.teams.slice(Math.ceil(count/2));
        shuffle(pool1); pool1.forEach((s, i) => teams1[i % teams1.length].members.push(s));
        shuffle(pool2); pool2.forEach((s, i) => teams2[i % teams2.length].members.push(s));
    }
    
    saveLocal();
    renderTeams();
};

window.handleDragStart = function(e, mId, tId) {
    if(window.data.teamsLocked) { e.preventDefault(); return; }
    draggedMemberId = mId;
    draggedFromTeamId = tId;
    e.dataTransfer.effectAllowed = 'move';
    e.target.classList.add('dragging');
};
window.handleDragOver = function(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); };
window.handleDragLeave = function(e) { e.currentTarget.classList.remove('drag-over'); };
window.handleDrop = function(e, tId) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const source = window.data.teams.find(t => t.id === draggedFromTeamId);
    const target = window.data.teams.find(t => t.id === tId);
    if(source && target && source !== target) {
        const idx = source.members.findIndex(m => m.id === draggedMemberId);
        if(idx > -1) {
            target.members.push(source.members.splice(idx, 1)[0]);
            saveLocal();
            renderTeams();
        }
    }
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
};

window.renderTeams = function() {
    const d = document.getElementById('drawDisplay');
    d.innerHTML = '';
    window.data.teams.forEach(t => {
        const card = document.createElement('div');
        card.className = 'team-card';
        card.ondragover = window.handleDragOver;
        card.ondragleave = window.handleDragLeave;
        card.ondrop = (e) => window.handleDrop(e, t.id);
        
        let membersHtml = t.members.map((m, i) => `
            <div class="team-member" draggable="true" ondragstart="handleDragStart(event, '${m.id}', ${t.id})">
                <span>${i+1}. ${m.name}</span>
                <span class="team-class-badge">${m.class}</span>
            </div>
        `).join('');
        
        card.innerHTML = `<h3><input value="${t.name}" onchange="renameTeam(${t.id}, this.value)"></h3><div>${membersHtml}</div>`;
        d.appendChild(card);
    });
    const btn = document.getElementById('lockBtn');
    btn.className = window.data.teamsLocked ? 'btn-small-red' : 'btn-yellow';
    btn.innerText = window.data.teamsLocked ? '🔒 Låst' : '🔓 Åpen';
};

window.renameTeam = function(id, val) {
    const t = window.data.teams.find(t => t.id == id);
    if(t) { t.name = val; saveLocal(); updateLeaderboard(); }
};

window.toggleLockTeams = function() {
    window.data.teamsLocked = !window.data.teamsLocked;
    saveLocal();
    renderTeams();
};

// =============================================================
// 7. SCHEDULE
// =============================================================
window.generateSchedule = function() {
    if(!window.data.teamsLocked) {
        if(!confirm("Lagene er ikke låst. Låse dem?")) return;
        window.toggleLockTeams();
    }
    if(window.data.courts.length === 0) return alert("Ingen baner!");
    
    window.data.matches = [];
    let currentTime = new Date();
    const [sh, sm] = window.data.settings.startTime.split(':');
    currentTime.setHours(sh, sm, 0);
    const slotDuration = parseInt(window.data.settings.matchDuration) + parseInt(window.data.settings.breakDuration);
    
    let tIds = window.data.teams.map(t => t.id);
    if(tIds.length % 2 !== 0) tIds.push(null);
    
    let rounds = [];
    for (let r = 0; r < tIds.length - 1; r++) {
        let roundPairs = [];
        for (let i = 0; i < tIds.length / 2; i++) {
            const t1 = tIds[i];
            const t2 = tIds[tIds.length - 1 - i];
            if (t1 !== null && t2 !== null) { roundPairs.push({ t1, t2 }); }
        }
        rounds.push(roundPairs);
        tIds.splice(1, 0, tIds.pop());
    }
    
    let allMatches = rounds.flat();
    while(allMatches.length > 0) {
        let activeMatches = [];
        window.data.courts.forEach(court => {
            if(allMatches.length > 0) {
                const matchIdx = allMatches.findIndex(m => 
                    !activeMatches.some(am => am.t1 == m.t1 || am.t2 == m.t1 || am.t1 == m.t2 || am.t2 == m.t2)
                );
                if(matchIdx > -1) {
                    const match = allMatches.splice(matchIdx, 1)[0];
                    activeMatches.push({ ...match, court: court.name, type: court.type });
                }
            }
        });
        if(activeMatches.length === 0) break;
        const timeStr = currentTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        activeMatches.forEach(am => {
            window.data.matches.push({
                id: genId(), time: timeStr, t1: am.t1, t2: am.t2,
                court: am.court, type: am.type, s1: null, s2: null, done: false
            });
        });
        currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
    }
    saveLocal(); renderSchedule(); showTab('schedule');
};

window.renderSchedule = function() {
    const c = document.getElementById('scheduleContainer');
    c.innerHTML = '';
    let groups = {};
    window.data.matches.sort((a,b) => a.time.localeCompare(b.time));
    window.data.matches.forEach(m => { if(!groups[m.time]) groups[m.time] = []; groups[m.time].push(m); });
    
    for(let time in groups) {
        const block = document.createElement('div');
        block.className = 'match-round-block';
        block.innerHTML = `<div class="match-round-header">Kl ${time}</div>`;
        groups[time].forEach(m => {
            const t1 = window.data.teams.find(t => t.id == m.t1);
            const t2 = window.data.teams.find(t => t.id == m.t2);
            if(!t1 || !t2) return;
            const row = document.createElement('div');
            row.className = 'match-item';
            row.innerHTML = `
                <div class="match-court">${m.court}<br><small>${m.type}</small></div>
                <div class="match-teams">${t1.name} vs ${t2.name}</div>
                <div class="match-inputs">
                    <input type="number" value="${m.s1 ?? ''}" onchange="updScore('${m.id}', 's1', this.value)" placeholder="0">
                    -
                    <input type="number" value="${m.s2 ?? ''}" onchange="updScore('${m.id}', 's2', this.value)" placeholder="0">
                </div>
            `;
            block.appendChild(row);
        });
        c.appendChild(block);
    }
};

window.updScore = function(id, field, val) {
    const m = window.data.matches.find(x => x.id === id);
    if(m) {
        m[field] = val === '' ? null : parseInt(val);
        m.done = (m.s1 !== null && m.s2 !== null);
        saveLocal(); updateLeaderboard();
    }
};

window.addManualMatch = function() {
    if(window.data.teams.length === 0) return;
    window.data.matches.push({
        id: genId(), time: "12:00", t1: window.data.teams[0].id, t2: window.data.teams[0].id,
        court: "Manuell", type: "Ekstra", s1: null, s2: null, done: false
    });
    saveLocal(); renderSchedule();
};

window.clearSchedule = function() {
    if(confirm("Slette kampoppsettet?")) {
        window.data.matches = []; window.data.finals = [];
        saveLocal(); renderSchedule(); updateLeaderboard();
    }
};

// =============================================================
// 8. CONTROL (TIMER)
// =============================================================
window.timerStart = function() {
    if(isTimerRunning) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    window.playHornShort();
    isTimerRunning = true;
    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();
        if(timerSeconds <= 0) { window.timerPause(); window.playHornLong(); }
    }, 1000);
};
window.timerPause = function() { clearInterval(timerInterval); isTimerRunning = false; };
window.timerReset = function() { window.timerPause(); timerSeconds = parseInt(window.data.settings.matchDuration) * 60; updateTimerDisplay(); };
window.adjustTimer = function(min) { timerSeconds += (min * 60); if(timerSeconds < 0) timerSeconds = 0; updateTimerDisplay(); };
function updateTimerDisplay() {
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const s = (timerSeconds % 60).toString().padStart(2, '0');
    document.getElementById('mainTimer').innerText = `${m}:${s}`;
}
window.playHornShort = function() { playSound(600, 0.3, 'sine'); };
window.playHornLong = function() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const g = audioCtx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = 150; osc.connect(g); g.connect(audioCtx.destination);
    const now = audioCtx.currentTime; g.gain.setValueAtTime(1, now); g.gain.linearRampToValueAtTime(0, now + 3);
    osc.start(); osc.stop(now + 3);
};
function playSound(freq, dur, type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const g = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq; osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + dur);
}

// =============================================================
// 9. LEADERBOARD
// =============================================================
window.updateLeaderboard = function() {
    window.data.teams.forEach(t => { t.points = 0; t.stats = { played:0, w:0, d:0, l:0, gf:0, ga:0 }; });
    window.data.matches.forEach(m => {
        if(m.done) {
            const t1 = window.data.teams.find(t => t.id == m.t1);
            const t2 = window.data.teams.find(t => t.id == m.t2);
            if(t1 && t2) {
                t1.stats.played++; t2.stats.played++;
                t1.stats.gf += m.s1; t1.stats.ga += m.s2;
                t2.stats.gf += m.s2; t2.stats.ga += m.s1;
                if(m.s1 > m.s2) { t1.points += 3; t1.stats.w++; t2.stats.l++; }
                else if(m.s2 > m.s1) { t2.points += 3; t2.stats.w++; t1.stats.l++; }
                else { t1.points += 1; t2.points += 1; t1.stats.d++; t2.stats.d++; }
            }
        }
    });
    window.data.teams.sort((a,b) => b.points - a.points || (b.stats.gf - b.stats.ga) - (a.stats.gf - a.stats.ga));
    
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '';
    window.data.teams.forEach((t, i) => {
        tbody.innerHTML += `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.stats.played}</td><td>${t.stats.w}</td><td>${t.stats.d}</td><td>${t.stats.l}</td><td>${t.stats.gf - t.stats.ga}</td><td><strong>${t.points}</strong></td></tr>`;
    });
    
    const s1 = document.getElementById('finalTeam1');
    const s2 = document.getElementById('finalTeam2');
    if(s1 && s2) {
        const html = window.data.teams.map(t => `<option value="${t.id}">${t.name} (${t.points}p)</option>`).join('');
        const v1 = s1.value; const v2 = s2.value;
        s1.innerHTML = html; s2.innerHTML = html;
        if(v1) s1.value = v1; if(v2) s2.value = v2; else if(window.data.teams.length > 1) s2.selectedIndex = 1;
    }
    renderFinalsList();
};

window.createFinalMatch = function() {
    const t1Id = document.getElementById('finalTeam1').value;
    const t2Id = document.getElementById('finalTeam2').value;
    const name = document.getElementById('finalName').value;
    const t1 = window.data.teams.find(t => t.id == t1Id);
    const t2 = window.data.teams.find(t => t.id == t2Id);
    if(!window.data.finals) window.data.finals = [];
    window.data.finals.push({ id: genId(), name: name, t1: t1.name, t2: t2.name, s1: null, s2: null, done: false });
    saveLocal(); renderFinalsList();
};

function renderFinalsList() {
    const d = document.getElementById('finalsList');
    d.innerHTML = '';
    if(!window.data.finals) return;
    window.data.finals.forEach((f, i) => {
        const div = document.createElement('div');
        div.className = 'final-match-item';
        div.innerHTML = `
            <div><strong>${f.name}</strong><br>${f.t1} vs ${f.t2}</div>
            <div style="display:flex; gap:5px;">
                <input type="number" value="${f.s1??''}" onchange="updFinal(${i}, 's1', this.value)" style="width:50px">
                -
                <input type="number" value="${f.s2??''}" onchange="updFinal(${i}, 's2', this.value)" style="width:50px">
            </div>
            <button class="btn-text-red" onclick="declareWinner(${i})">🏆</button>
            <button class="btn-text-red" onclick="delFinal(${i})">X</button>
        `;
        d.appendChild(div);
    });
}

window.updFinal = function(idx, f, v) { window.data.finals[idx][f] = parseInt(v); saveLocal(); };
window.delFinal = function(idx) { window.data.finals.splice(idx, 1); saveLocal(); renderFinalsList(); };
window.declareWinner = function(idx) {
    const f = window.data.finals[idx];
    let w = "UAVGJORT"; if(f.s1 > f.s2) w = f.t1; if(f.s2 > f.s1) w = f.t2;
    document.getElementById('winnerText').innerText = w;
    document.getElementById('winnerOverlay').classList.remove('hidden');
    confettiEffect();
};
window.closeWinner = function() { document.getElementById('winnerOverlay').classList.add('hidden'); };

function confettiEffect() {
    const c = document.querySelector('.confetti'); c.innerHTML='';
    for(let i=0; i<50; i++) {
        const p = document.createElement('div');
        p.style.left = Math.random()*100 + '%';
        p.style.animationDelay = Math.random()*2 + 's';
        p.style.backgroundColor = `hsl(${Math.random()*360}, 100%, 50%)`;
        c.appendChild(p);
    }
}

// =============================================================
// 10. FILE IO
// =============================================================
window.saveToFile = function() {
    const blob = new Blob([JSON.stringify(window.data, null, 2)], {type: "application/json"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `turnering_v17.json`;
    a.click();
};
window.loadFromFile = function() {
    const file = document.getElementById('fileInput').files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try { window.data = JSON.parse(e.target.result); saveLocal(); location.reload(); } catch(err) { alert("Filfeil."); }
    };
    reader.readAsText(file);
};

/* Version: #17 */
