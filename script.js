/* Version: #12 */

// =============================================================
// GLOBAL DATA & STATE
// =============================================================
let data = {
    title: "Turnering",
    classes: ["10A","10B","10C","10D"],
    students: [],
    courts: [
        {id:1, name:"Bane 1", type:"Volleyball"}, 
        {id:2, name:"Bane 2", type:"Volleyball"}, 
        {id:3, name:"Bane 3", type:"Stikkball"}
    ],
    teams: [],
    matches: [],
    settings: { 
        startTime: "10:15", 
        finalsTime: "14:00", 
        matchDuration: 15, 
        breakDuration: 5 
    },
    teamsLocked: false,
    finalState: { 
        active: false, 
        t1: "Lag A", 
        t2: "Lag B", 
        s1: 0, 
        s2: 0, 
        title: "FINALE", 
        act: "Volleyball" 
    }
};

// Audio & System
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let soundEnabled = true;
let wakeLock = null;

// Timer State (Shared logic, driven by Admin)
let timerInterval = null;
let timerSeconds = 900; // 15 min default
let isTimerRunning = false;

// Drag & Drop State
let draggedMemberId = null;
let draggedFromTeamId = null;

// Dashboard UI State
let dashFontSizeVW = 18;

// =============================================================
// INITIALIZATION
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
    // Detect mode based on URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'dashboard') {
        initDashboard();
    } else {
        initAdmin();
    }
});

// =============================================================
// ADMIN LOGIC
// =============================================================

function initAdmin() {
    // Setup UI for Admin
    const adminView = document.getElementById('adminView');
    const dashView = document.getElementById('dashboardView');
    if(adminView) adminView.style.display = 'block';
    if(dashView) dashView.classList.add('hidden');
    
    // Load Data
    loadLocal();
    
    // Render UI Components
    renderClassButtons();
    renderStudentList();
    renderCourts();
    
    // Restore state if data exists
    if(data.teams.length > 0) renderTeams();
    if(data.matches.length > 0) renderSchedule();
    updateLeaderboard();
    
    // Start System Clock Loop (Admin drives the sync)
    setInterval(adminSystemTick, 1000);
}

// --- PERSISTENCE ---
function saveLocal() { 
    localStorage.setItem('ts_v12_data', JSON.stringify(data));
    localStorage.setItem('ts_v12_update_trigger', Date.now()); // Signal update
}

function loadLocal() {
    const json = localStorage.getItem('ts_v12_data');
    if(json) { 
        try {
            const parsed = JSON.parse(json);
            data = {...data, ...parsed}; 
        } catch(e) {
            console.error("Data load error", e);
        }
    }
    updateInputs();
    updateTitleUI();
}

function updateInputs() {
    ['startTime','finalsTime','matchDuration','breakDuration'].forEach(k => {
        const el = document.getElementById(k);
        if(el) el.value = data.settings[k];
    });
}

function updateTitleUI() {
    const disp = document.getElementById('displayTitle');
    const inp = document.getElementById('tournamentTitleInput');
    const prt = document.getElementById('printTitle');
    if(disp) disp.innerText = data.title;
    if(inp) inp.value = data.title;
    if(prt) prt.innerText = data.title;
}

// --- SETUP TAB FUNCTIONS ---
let selectedClass = "";

window.renderClassButtons = function() {
    const d = document.getElementById('classButtons'); 
    if(!d) return;
    d.innerHTML = '';
    data.classes.forEach(c => {
        const b = document.createElement('span');
        b.className = `class-btn ${selectedClass===c?'selected':''}`;
        b.innerHTML = `${c} <i class="fas fa-times del-cls" onclick="delClass('${c}', event)"></i>`;
        b.onclick = () => { selectedClass = c; renderClassButtons(); };
        d.appendChild(b);
    });
    if(!selectedClass && data.classes.length > 0) { 
        selectedClass = data.classes[0]; 
        if(d.children.length > 0) d.children[0].classList.add('selected');
    }
    renderCustomMixCheckboxes();
};

window.addClass = function() {
    const v = document.getElementById('newClassInput').value.trim().toUpperCase();
    if(v && !data.classes.includes(v)) { 
        data.classes.push(v); 
        data.classes.sort(); 
        saveLocal(); 
        renderClassButtons(); 
    }
};

window.delClass = function(c, e) {
    e.stopPropagation();
    if(confirm("Slett klasse?")) { 
        data.classes = data.classes.filter(x=>x!==c); 
        saveLocal(); 
        renderClassButtons(); 
    }
};

window.addStudents = function() {
    if(!selectedClass) return alert("Velg klasse først.");
    const txt = document.getElementById('pasteArea').value;
    const lines = txt.split('\n');
    lines.forEach(l => {
        const n = l.trim(); 
        if(n) data.students.push({ id:genId(), name:n, class:selectedClass, present:true });
    });
    document.getElementById('pasteArea').value = ""; 
    saveLocal(); 
    renderStudentList();
};

window.renderStudentList = function() {
    const l = document.getElementById('studentList');
    if(!l) return;
    l.innerHTML = '';
    
    const query = document.getElementById('studentSearch').value.toLowerCase();
    document.getElementById('studentCount').innerText = data.students.length;
    
    let filtered = data.students.filter(s => 
        s.name.toLowerCase().includes(query) || s.class.toLowerCase().includes(query)
    );
    
    // Sort logic
    filtered.sort((a,b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name));
    
    filtered.forEach(s => {
        const d = document.createElement('div');
        d.className = `student-item ${s.present?'':'absent'}`;
        d.innerHTML = `
            <span><b>${s.class}</b> ${s.name}</span>
            <input type="checkbox" ${s.present?'checked':''} onchange="togglePres('${s.id}')">
        `;
        l.appendChild(d);
    });
};

window.togglePres = function(id) { 
    const s = data.students.find(x=>x.id==id); 
    if(s){ 
        s.present = !s.present; 
        saveLocal(); 
        renderStudentList();
    } 
};

window.clearStudents = function() { 
    if(confirm("Slett alle elever?")) { 
        data.students=[]; 
        saveLocal(); 
        renderStudentList(); 
    } 
};

// --- ARENA TAB FUNCTIONS ---
window.renderCourts = function() {
    const l = document.getElementById('courtList');
    if(!l) return;
    l.innerHTML = '';
    data.courts.forEach((c,i) => {
        const d = document.createElement('div'); 
        d.className = 'court-item';
        d.innerHTML = `
            <span>#${i+1}</span>
            <input value="${c.name}" onchange="updCourt(${i},'name',this.value)">
            <input value="${c.type}" onchange="updCourt(${i},'type',this.value)">
            <button class="btn-small-red" onclick="delCourt(${i})">X</button>
        `;
        l.appendChild(d);
    });
};

window.addCourt = function() { 
    data.courts.push({id:Date.now(), name:`Bane ${data.courts.length+1}`, type:"Volleyball"}); 
    saveLocal(); 
    renderCourts(); 
};

window.updCourt = function(i,f,v) { 
    data.courts[i][f] = v; 
    saveLocal(); 
};

window.delCourt = function(i) { 
    data.courts.splice(i,1); 
    saveLocal(); 
    renderCourts(); 
};

// Settings Listeners
['startTime','finalsTime','matchDuration','breakDuration'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', e => { 
        data.settings[id] = e.target.value; 
        saveLocal(); 
    });
});

// --- TEAMS & DRAW FUNCTIONS ---
window.toggleCustomMix = function() {
    const s = document.getElementById('drawStrategy').value;
    const panel = document.getElementById('customMixPanel');
    if(panel) panel.classList.toggle('hidden', s !== 'custom');
};

window.renderCustomMixCheckboxes = function() {
    const d = document.getElementById('customClassCheckboxes');
    if(!d) return;
    d.innerHTML = '';
    data.classes.forEach(c => {
        d.innerHTML += `<div><input type="checkbox" value="${c}" id="chk_${c}"><label for="chk_${c}">${c}</label></div>`;
    });
};

function shuffle(arr) { 
    for(let i=arr.length-1; i>0; i--){ 
        const j=Math.floor(Math.random()*(i+1)); 
        [arr[i],arr[j]]=[arr[j],arr[i]]; 
    } 
    return arr; 
}

window.generateTeams = function() {
    if(data.teamsLocked) return alert("Lagene er låst. Lås opp først.");
    
    const count = parseInt(document.getElementById('teamCount').value);
    const strategy = document.getElementById('drawStrategy').value;
    const pool = data.students.filter(s => s.present);
    
    // Reset Teams
    data.teams = Array.from({length: count}, (_,i) => ({
        id: i+1, 
        name: `Lag ${i+1}`, 
        members: [], 
        points: 0, 
        stats: {gf:0, ga:0, w:0, d:0, l:0}
    }));

    // --- STRATEGY LOGIC ---
    if(strategy === 'balanced') {
        // Deck of Cards Logic (Fair distribution)
        let buckets = {};
        data.classes.forEach(c => {
            buckets[c] = pool.filter(s => s.class === c);
            shuffle(buckets[c]);
        });
        
        let deck = [];
        let active = true;
        while(active) {
            active = false;
            data.classes.forEach(c => {
                if(buckets[c] && buckets[c].length > 0) {
                    deck.push(buckets[c].pop());
                    active = true;
                }
            });
        }
        
        // Deal deck to teams
        deck.forEach((student, index) => {
            data.teams[index % count].members.push(student);
        });
    }
    else if(strategy === 'class_based') {
        // Pure class teams
        let byClass = {}; 
        data.classes.forEach(c => byClass[c]=[]);
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
    else if(strategy === 'random') {
        shuffle(pool);
        pool.forEach((s,i) => data.teams[i % count].members.push(s));
    }
    else {
        // Split (AB vs CD or Custom)
        let group1Classes = [];
        if(strategy === 'ab_cd') {
            const mid = Math.ceil(data.classes.length/2);
            group1Classes = data.classes.slice(0, mid);
        } else {
            // Custom selection
            document.querySelectorAll('#customClassCheckboxes input:checked').forEach(cb => group1Classes.push(cb.value));
        }
        
        const pool1 = pool.filter(s => group1Classes.includes(s.class));
        const pool2 = pool.filter(s => !group1Classes.includes(s.class));
        
        const teams1 = data.teams.slice(0, Math.ceil(count/2));
        const teams2 = data.teams.slice(Math.ceil(count/2));
        
        shuffle(pool1); pool1.forEach((s,i) => teams1[i%teams1.length].members.push(s));
        shuffle(pool2); pool2.forEach((s,i) => teams2[i%teams2.length].members.push(s));
    }
    
    saveLocal(); 
    renderTeams();
};

window.renderTeams = function() {
    const d = document.getElementById('drawDisplay');
    if(!d) return;
    d.innerHTML = '';
    
    data.teams.forEach(t => {
        const card = document.createElement('div');
        card.className = 'team-card';
        
        // Drag listeners
        card.ondragover = window.handleDragOver;
        card.ondragleave = window.handleDragLeave;
        card.ondrop = (e) => window.handleDrop(e, t.id);

        const mems = t.members.map((m,i) => `
            <div class="team-member" draggable="true" ondragstart="handleDragStart(event, '${m.id}', ${t.id})">
                <span>${i+1}. ${m.name}</span>
                <span class="team-class-badge">${m.class}</span>
            </div>
        `).join('');
        
        card.innerHTML = `
            <h3><input value="${t.name}" onchange="renameTeam(${t.id},this.value)"></h3>
            <div>${mems}</div>
        `;
        d.appendChild(card);
    });
    
    const l = document.getElementById('lockBtn');
    if(l) {
        l.className = data.teamsLocked ? 'btn-small-red' : 'btn-yellow';
        l.innerHTML = data.teamsLocked ? '<i class="fas fa-lock"></i> Låst' : '<i class="fas fa-unlock"></i> Åpen';
    }
};

window.renameTeam = function(id,v) { 
    const t = data.teams.find(t=>t.id==id);
    if(t) { t.name=v; saveLocal(); updateLeaderboard(); }
};

window.toggleLockTeams = function() { 
    data.teamsLocked = !data.teamsLocked; 
    saveLocal(); 
    renderTeams(); 
};

// --- DRAG & DROP LOGIC ---
window.handleDragStart = function(e, memberId, teamId) {
    if (data.teamsLocked) {
        e.preventDefault();
        return;
    }
    draggedMemberId = memberId;
    draggedFromTeamId = teamId;
    e.dataTransfer.effectAllowed = "move";
    e.target.classList.add('dragging');
};

window.handleDragOver = function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add('drag-over');
};

window.handleDragLeave = function(e) {
    e.currentTarget.classList.remove('drag-over');
};

window.handleDrop = function(e, targetTeamId) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const sourceTeam = data.teams.find(t => t.id === draggedFromTeamId);
    const targetTeam = data.teams.find(t => t.id === targetTeamId);
    
    if (sourceTeam && targetTeam && sourceTeam !== targetTeam) {
        const memberIndex = sourceTeam.members.findIndex(m => m.id === draggedMemberId);
        if (memberIndex > -1) {
            const member = sourceTeam.members.splice(memberIndex, 1)[0];
            targetTeam.members.push(member);
            saveLocal();
            renderTeams();
        }
    }
    
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    draggedMemberId = null;
    draggedFromTeamId = null;
};

// --- SCHEDULE & MATCHES ---
window.generateSchedule = function() {
    if(!data.teamsLocked) toggleLockTeams();
    if(data.courts.length === 0) return alert("Ingen baner definert i 'Arena'.");
    
    data.matches = [];
    let time = new Date(`2000-01-01T${data.settings.startTime}`);
    const endTime = new Date(`2000-01-01T${data.settings.finalsTime}`);
    const slotDur = parseInt(data.settings.matchDuration) + parseInt(data.settings.breakDuration);
    
    // Round Robin Logic
    let tIds = data.teams.map(t=>t.id);
    if(tIds.length % 2 !== 0) tIds.push(null); // Bye
    
    let pairs = [];
    for(let r=0; r < tIds.length-1; r++) {
        for(let i=0; i<tIds.length/2; i++) {
            const a = tIds[i];
            const b = tIds[tIds.length-1-i];
            if(a && b) pairs.push({t1:a, t2:b});
        }
        tIds.splice(1, 0, tIds.pop());
    }
    
    // Fill Slots
    while(time < endTime && pairs.length > 0) {
        let active = [];
        data.courts.forEach(c => {
            if(pairs.length > 0) {
                const idx = pairs.findIndex(p => !active.some(a => a.t1==p.t1 || a.t2==p.t1 || a.t1==p.t2 || a.t2==p.t2));
                if(idx > -1) {
                    const p = pairs.splice(idx,1)[0];
                    active.push({...p, c:c.name, type:c.type});
                }
            }
        });
        
        const timeStr = time.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'});
        active.forEach(m => {
            data.matches.push({
                id: genId(), 
                time: timeStr, 
                t1: m.t1, t2: m.t2, 
                court: m.c, type: m.type, 
                s1: null, s2: null, 
                done: false
            });
        });
        time.setMinutes(time.getMinutes() + slotDur);
    }
    saveLocal(); 
    renderSchedule();
};

window.renderSchedule = function() {
    const c = document.getElementById('scheduleContainer');
    if(!c) return;
    c.innerHTML = '';
    
    // Group by time
    const groups = {};
    data.matches.sort((a,b) => a.time.localeCompare(b.time));
    data.matches.forEach(m => { 
        if(!groups[m.time]) groups[m.time]=[]; 
        groups[m.time].push(m); 
    });
    
    for(let time in groups) {
        const blk = document.createElement('div'); 
        blk.className = 'match-block';
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
    const m = data.matches.find(x=>x.id==id); 
    m[f] = v===''?null:parseInt(v); 
    m.done = (m.s1!==null && m.s2!==null); 
    saveLocal(); 
    updateLeaderboard(); 
};

window.delBlock = function(time) { 
    if(confirm("Slett alle kamper kl " + time +"?")) { 
        data.matches = data.matches.filter(m=>m.time!==time); 
        saveLocal(); 
        renderSchedule(); 
    } 
};

window.addManualMatch = function() {
    if(data.teams.length === 0) return;
    const t = data.teams[0];
    data.matches.push({
        id:genId(), time:"12:00", 
        t1:t.id, t2:t.id, 
        court:"Manuell", type:"Ekstra", 
        s1:null, s2:null, done:false
    });
    saveLocal(); 
    renderSchedule();
};

window.clearSchedule = function() { 
    if(confirm("Slett alle kamper?")) { 
        data.matches=[]; 
        saveLocal(); 
        renderSchedule(); 
        updateLeaderboard(); 
    } 
};

// --- DRIFTSKONTROLL (TIME MANAGEMENT) ---

window.recalcFutureSchedule = function() {
    if(data.matches.length === 0) return alert("Ingen kamper.");
    let times = [...new Set(data.matches.map(m => m.time))].sort();
    const now = new Date();
    const curTimeStr = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    let futureTimes = times.filter(t => t >= curTimeStr);
    
    if(futureTimes.length === 0) return alert("Ingen fremtidige kamper.");
    if(!confirm(`Oppdater tider for ${futureTimes.length} bolker?`)) return;

    const slotDur = parseInt(data.settings.matchDuration) + parseInt(data.settings.breakDuration);
    let [h, m] = futureTimes[0].split(':').map(Number);
    let baseDate = new Date(); baseDate.setHours(h, m, 0);

    futureTimes.forEach(oldTime => {
        const newTimeStr = baseDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        data.matches.forEach(match => { if(match.time === oldTime) match.time = newTimeStr; });
        baseDate.setMinutes(baseDate.getMinutes() + slotDur);
    });
    saveLocal(); 
    renderSchedule();
};

window.startNextRoundNow = function() {
    // 1. Find matches that are not done
    const remainingMatches = data.matches.filter(m => !m.done).sort((a,b) => a.time.localeCompare(b.time));
    if(remainingMatches.length === 0) return alert("Ingen gjenstående kamper.");

    // 2. Identify the next scheduled block time
    const nextBlockTime = remainingMatches[0].time;
    
    // 3. Calculate Target Time (Now + 2 mins)
    const now = new Date();
    now.setMinutes(now.getMinutes() + 2);
    const newStartStr = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    if(!confirm(`Er du sikker? Dette vil flytte runde ${nextBlockTime} (og alle etterfølgende) til å starte kl ${newStartStr}.`)) return;

    // 4. Calculate minute difference
    const [h1, m1] = nextBlockTime.split(':').map(Number);
    const [h2, m2] = newStartStr.split(':').map(Number);
    const oldDate = new Date(); oldDate.setHours(h1, m1, 0);
    const newDate = new Date(); newDate.setHours(h2, m2, 0);
    const diffMs = newDate - oldDate;
    const diffMins = Math.round(diffMs / 60000);

    /
