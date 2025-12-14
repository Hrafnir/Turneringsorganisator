/* Version: #8 */

// --- GLOBAL VARIABLES ---
let data = {
    title: "Turnering",
    classes: ["10A","10B","10C","10D"],
    students: [],
    courts: [{id:1, name:"Bane 1", type:"Volleyball"}, {id:2, name:"Bane 2", type:"Volleyball"}, {id:3, name:"Bane 3", type:"Stikkball"}],
    teams: [],
    matches: [],
    settings: { startTime: "10:15", finalsTime: "14:00", matchDuration: 15, breakDuration: 5 },
    teamsLocked: false,
    finalState: { active: false, t1: "Lag A", t2: "Lag B", s1: 0, s2: 0, title: "FINALE", act: "Volleyball" }
};

// Audio context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let soundEnabled = true;
let wakeLock = null;

// Timer vars
let timerInterval = null;
let timerSeconds = 900;
let isTimerRunning = false;

// Drag & Drop vars
let draggedMemberId = null;
let draggedFromTeamId = null;

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    // Sjekk om vi er i Dashboard-modus (Storskjerm)
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
    document.getElementById('adminView').style.display = 'block';
    document.getElementById('dashboardView').classList.add('hidden');
    
    loadLocal();
    renderClassButtons();
    renderStudentList();
    renderCourts();
    if(data.teams.length) renderTeams();
    if(data.matches.length) renderSchedule();
    updateLeaderboard();
    
    // Start system clock loop for Admin UI
    setInterval(adminSystemTick, 1000);
}

// --- DATA PERSISTENCE ---
function saveLocal() { 
    localStorage.setItem('ts_v8_data', JSON.stringify(data));
    // Trigger update for dashboard
    localStorage.setItem('ts_v8_update_trigger', Date.now()); 
}

function loadLocal() {
    const json = localStorage.getItem('ts_v8_data');
    if(json) { 
        data = {...data, ...JSON.parse(json)}; 
        updateInputs();
    }
    document.getElementById('displayTitle').innerText = data.title;
    document.getElementById('tournamentTitleInput').value = data.title;
    document.getElementById('printTitle').innerText = data.title;
}

function updateInputs() {
    ['startTime','finalsTime','matchDuration','breakDuration'].forEach(k => {
        const el = document.getElementById(k);
        if(el) el.value = data.settings[k];
    });
}

// --- DASHBOARD LAUNCHER ---
window.openDashboard = function() {
    const url = window.location.href.split('?')[0] + '?mode=dashboard';
    window.open(url, 'TurneringsDashboard', 'width=1280,height=720');
};

// --- DRAG & DROP IMPLEMENTATION ---
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
    
    // Find references
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
    
    // Cleanup
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    draggedMemberId = null;
    draggedFromTeamId = null;
};

// --- STANDARD ADMIN FUNCTIONS ---

// Classes & Students
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

// Arena
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

// Teams Generation
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

    if(strategy === 'balanced') {
        // Deck of Cards logic
        let buckets = {};
        data.classes.forEach(c => {
            buckets[c] = pool.filter(s => s.class === c);
            shuffle(buckets[c]);
        });
        let deck = [];
        let anyLeft = true;
        while(anyLeft) {
            anyLeft = false;
            data.classes.forEach(c => {
                if(buckets[c] && buckets[c].length > 0) {
                    deck.push(buckets[c].pop());
                    anyLeft = true;
                }
            });
        }
        deck.forEach((student, index) => {
            data.teams[index % count].members.push(student);
        });
    }
    else if(strategy === 'random') {
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
        const card = document.createElement('div'); 
        card.className = 'team-card';
        // Add drop listeners
        card.ondragover = window.handleDragOver;
        card.ondragleave = window.handleDragLeave;
        card.ondrop = (e) => window.handleDrop(e, t.id);

        const mems = t.members.map((m,i) => `
            <div class="team-member" draggable="true" ondragstart="handleDragStart(event, '${m.id}', ${t.id})">
                <span>${i+1}. ${m.name}</span>
                <span class="team-class-badge">${m.class}</span>
            </div>`).join('');
        
        card.innerHTML = `<h3><input value="${t.name}" onchange="renameTeam(${t.id},this.value)"></h3><div>${mems}</div>`;
        d.appendChild(card);
    });
    const l = document.getElementById('lockBtn');
    l.className = data.teamsLocked ? 'btn-small-red' : 'btn-yellow';
    l.innerHTML = data.teamsLocked ? '<i class="fas fa-lock"></i> Låst' : '<i class="fas fa-unlock"></i> Åpen';
};
window.renameTeam = function(id,v) { data.teams.find(t=>t.id==id).name=v; saveLocal(); updateLeaderboard(); };
window.toggleLockTeams = function() { data.teamsLocked = !data.teamsLocked; saveLocal(); renderTeams(); };

// Schedule
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
    saveLocal(); renderSchedule();
};

window.renderSchedule = function() {
    const c = document.getElementById('scheduleContainer'); c.innerHTML = '';
    const groups = {};
    data.matches.sort((a,b)=>a.time.localeCompare(b.time));
    data.matches.forEach(m => { if(!groups[m.time]) groups[m.time]=[]; groups[m.time].push(m); });
    for(let time in groups) {
        const blk = document.createElement('div'); blk.className = 'match-block';
        blk.innerHTML = `<div class="block-header"><span class="block-time">Kl ${time}</span><button class="btn-text-red" onclick="delBlock('${time}')">Slett bolk</button></div>`;
        groups[time].forEach(m => {
            const t1 = data.teams.find(t=>t.id==m.t1);
            const t2 = data.teams.find(t=>t.id==m.t2);
            if(!t1 || !t2) return;
            const row = document.createElement('div'); row.className = 'match-row';
            row.innerHTML = `
                <div class="match-court-badge">${m.court}<br><small>${m.type}</small></div>
                <div class="match-teams">${t1.name} vs ${t2.name}</div>
                <div class="match-score"><input type="number" value="${m.s1??''}" onchange="updScore('${m.id}','s1',this.value)"> - <input type="number" value="${m.s2??''}" onchange="updScore('${m.id}','s2',this.value)"></div>
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
window.delBlock = function(time) { if(confirm("Slett?")) { data.matches=data.matches.filter(m=>m.time!==time); saveLocal(); renderSchedule(); } };
window.addManualMatch = function() {
    if(!data.teams.length) return;
    const t = data.teams[0];
    data.matches.push({id:genId(), time:"12:00", t1:t.id, t2:t.id, court:"Manuell", type:"Ekstra", s1:null, s2:null, done:false});
    saveLocal(); renderSchedule();
};
window.clearSchedule = function() { if(confirm("Slett alt?")) { data.matches=[]; saveLocal(); renderSchedule(); updateLeaderboard(); } };

// Leaderboard
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
    
    // Update Final Selects
    const s1 = document.getElementById('finalTeam1');
    const s2 = document.getElementById('finalTeam2');
    if(s1 && s2) {
        const html = data.teams.map((t,i) => `<option value="${t.id}">${i+1}. ${t.name} (${t.points}p)</option>`).join('');
        if(!s1.innerHTML || s1.innerHTML !== html) {
             const v1 = s1.value; const v2 = s2.value;
             s1.innerHTML = html; s2.innerHTML = html;
             if(v1) s1.value = v1; 
             if(v2) s2.value = v2; else if(data.teams.length>1) s2.selectedIndex = 1;
        }
    }
    // Update Mini Leaderboard
    const mb = document.getElementById('miniLeaderboard');
    if(mb) mb.innerHTML = data.teams.slice(0, 8).map((t,i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.points}</td></tr>`).join('');
};

// --- TIMER & SYNC LOGIC ---

// This runs on Admin to update clock and broadcast timer state
function adminSystemTick() {
    // Update Realtime Clock
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    document.getElementById('adminRealTime').innerText = timeStr;
    
    // Broadcast Timer State (Seconds remaining, Running status, Current Matches Info)
    // We do this via a separate localStorage key to avoid heavy data reload
    const activeMatches = getMatchesAtTime(timeStr.substr(0,5));
    const nextMatches = getNextMatches(timeStr.substr(0,5));

    const syncObj = {
        timer: timerSeconds,
        running: isTimerRunning,
        activeMatches: activeMatches,
        nextMatches: nextMatches,
        finalMode: data.finalState.active,
        finalState: data.finalState,
        title: data.title
    };
    
    localStorage.setItem('ts_v8_dashboard_sync', JSON.stringify(syncObj));
}

function getMatchesAtTime(shortTime) {
    // Find matches starting at the closest previous block or current block
    // Simplified: Find matches starting exactly at this time, OR if none, 
    // find matches that started recently?
    // Let's stick to: matches starting at the scheduled time.
    // Better UX: Show matches belonging to the "Current Slot".
    // We find the block with time <= current time.
    // Sorting matches by time
    const sorted = [...data.matches].sort((a,b) => a.time.localeCompare(b.time));
    // Find the latest start time that is <= current time
    let currentBlockTime = null;
    for(let m of sorted) {
        if(m.time <= shortTime) currentBlockTime = m.time;
        else break;
    }
    
    // If currentBlockTime is very old (e.g. > 30 mins ago), maybe don't show?
    // For now, show matches from currentBlockTime
    if(!currentBlockTime) return [];
    
    return sorted.filter(m => m.time === currentBlockTime).map(m => {
        const t1 = data.teams.find(t=>t.id==m.t1);
        const t2 = data.teams.find(t=>t.id==m.t2);
        return {
            court: m.court, type: m.type,
            t1: t1?t1.name:'?', t2: t2?t2.name:'?',
            s1: m.s1, s2: m.s2
        };
    });
}

function getNextMatches(shortTime) {
    // Find matches > current time
    const sorted = [...data.matches].sort((a,b) => a.time.localeCompare(b.time));
    const future = sorted.filter(m => m.time > shortTime);
    if(future.length === 0) return [];
    const nextBlockTime = future[0].time;
    return future.filter(m => m.time === nextBlockTime).map(m => {
        const t1 = data.teams.find(t=>t.id==m.t1);
        const t2 = data.teams.find(t=>t.id==m.t2);
        return {
            time: m.time, court: m.court,
            t1: t1?t1.name:'?', t2: t2?t2.name:'?'
        };
    });
}

// Timer Controls (Admin)
window.startTimer = function() {
    if(isTimerRunning) return;
    if(audioCtx.state==='suspended') audioCtx.resume();
    playHorn();
    isTimerRunning = true;
    timerInterval = setInterval(() => {
        timerSeconds--;
        updateAdminTimerUI();
        if(timerSeconds <= 0) {
            pauseTimer();
            playHorn();
            isTimerRunning = false;
        }
    }, 1000);
};
window.pauseTimer = function() {
    clearInterval(timerInterval);
    isTimerRunning = false;
};
window.resetTimer = function() {
    pauseTimer();
    timerSeconds = parseInt(data.settings.matchDuration) * 60;
    updateAdminTimerUI();
};
function updateAdminTimerUI() {
    const m = Math.floor(timerSeconds/60).toString().padStart(2,'0');
    const s = (timerSeconds%60).toString().padStart(2,'0');
    document.getElementById('adminTimerDisplay').innerText = `${m}:${s}`;
    if(data.finalState.active) {
        // Also update final panel inputs/display if needed
    }
}
window.playHorn = function() {
    const osc = audioCtx.createOscillator(); osc.type='sawtooth'; osc.frequency.value=150;
    const osc2 = audioCtx.createOscillator(); osc2.type='square'; osc2.frequency.value=148;
    const g = audioCtx.createGain();
    osc.connect(g); osc2.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(1, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime+2.5);
    osc.start(); osc2.start(); osc.stop(audioCtx.currentTime+2.5); osc2.stop(audioCtx.currentTime+2.5);
};

// Finals Admin
window.activateFinalMode = function() {
    const t1 = data.teams.find(t=>t.id==document.getElementById('finalTeam1').value);
    const t2 = data.teams.find(t=>t.id==document.getElementById('finalTeam2').value);
    
    data.finalState.active = true;
    data.finalState.t1 = t1.name;
    data.finalState.t2 = t2.name;
    data.finalState.title = document.getElementById('finalType').value;
    data.finalState.act = document.getElementById('finalAct').value;
    data.finalState.s1 = 0;
    data.finalState.s2 = 0;
    
    // Reset timer for final
    resetTimer();

    // Update Admin UI
    document.getElementById('adminStageT1').innerText = t1.name;
    document.getElementById('adminStageT2').innerText = t2.name;
    document.getElementById('adminStageS1').value = 0;
    document.getElementById('adminStageS2').value = 0;
    
    saveLocal(); // Syncs to dashboard
};
window.exitFinalMode = function() {
    data.finalState.active = false;
    saveLocal();
};
window.syncFinalScore = function() {
    data.finalState.s1 = parseInt(document.getElementById('adminStageS1').value);
    data.finalState.s2 = parseInt(document.getElementById('adminStageS2').value);
    saveLocal();
};
window.endTournament = function() {
    const s1 = data.finalState.s1;
    const s2 = data.finalState.s2;
    let w = "UAVGJORT";
    if(s1 > s2) w = data.finalState.t1;
    if(s2 > s1) w = data.finalState.t2;
    document.getElementById('winnerText').innerText = w;
    document.getElementById('winnerOverlay').classList.remove('hidden');
    // Also trigger on dashboard via LS? Not implemented, but Dashboard sees score.
};
window.closeWinner = function() { document.getElementById('winnerOverlay').classList.add('hidden'); };

// =============================================================
// DASHBOARD LOGIC (STORSKJERM)
// =============================================================

function initDashboard() {
    document.getElementById('adminView').classList.add('hidden'); // Hide admin completely
    document.getElementById('adminView').style.display = 'none';
    document.getElementById('dashboardView').classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // No scroll on dashboard

    // Listen for data updates (reloads schedule etc)
    window.addEventListener('storage', (e) => {
        if(e.key === 'ts_v8_update_trigger') {
            // Reload data silently? Or just rely on sync object?
            // If teams change names etc, we might need full reload.
            // For now, we trust the sync object for live match data.
        }
    });

    // High frequency update loop
    setInterval(dashboardTick, 200);
}

function dashboardTick() {
    const json = localStorage.getItem('ts_v8_dashboard_sync');
    if(!json) return;
    const sync = JSON.parse(json);

    // Update Clock
    const now = new Date();
    document.getElementById('dashClock').innerText = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    document.getElementById('dashTitle').innerText = sync.title || "TURNERING";

    // Mode Switch
    if (sync.finalMode) {
        document.getElementById('dashSeriesMode').classList.add('hidden');
        document.getElementById('dashFinalMode').classList.remove('hidden');
        
        // Update Final UI
        const fs = sync.finalState;
        document.getElementById('dashFinalTitle').innerText = fs.title;
        document.getElementById('dashFinalAct').innerText = fs.act;
        document.getElementById('dashFinalT1').innerText = fs.t1;
        document.getElementById('dashFinalT2').innerText = fs.t2;
        document.getElementById('dashFinalS1').innerText = fs.s1;
        document.getElementById('dashFinalS2').innerText = fs.s2;
        
        // Timer
        const m = Math.floor(sync.timer/60).toString().padStart(2,'0');
        const s = (sync.timer%60).toString().padStart(2,'0');
        document.getElementById('dashFinalTimer').innerText = `${m}:${s}`;
        document.getElementById('dashFinalTimer').style.color = sync.running ? '#4caf50' : '#f44336';
        
    } else {
        document.getElementById('dashFinalMode').classList.add('hidden');
        document.getElementById('dashSeriesMode').classList.remove('hidden');

        // Update Timer
        const m = Math.floor(sync.timer/60).toString().padStart(2,'0');
        const s = (sync.timer%60).toString().padStart(2,'0');
        const dTimer = document.getElementById('dashTimer');
        dTimer.innerText = `${m}:${s}`;
        
        const dStatus = document.getElementById('dashStatus');
        if(sync.running) {
            dTimer.style.color = '#4caf50'; // Green
            dStatus.innerText = "KAMP PÅGÅR";
            dStatus.style.background = "#1b5e20";
        } else if (sync.timer === 0) {
            dTimer.style.color = '#f44336'; // Red
            dStatus.innerText = "TIDEN ER UTE";
            dStatus.style.background = "#b71c1c";
        } else {
            dTimer.style.color = '#ff9800'; // Orange
            dStatus.innerText = "PAUSE / KLAR";
            dStatus.style.background = "#333";
        }

        // Update Active Matches
        const amBox = document.getElementById('dashActiveMatches');
        if (sync.activeMatches.length === 0) {
            amBox.innerHTML = '<div class="dash-placeholder" style="color:#666; font-size:2vh; text-align:center; padding:20px;">Ingen kamper i denne tidsluken</div>';
        } else {
            amBox.innerHTML = sync.activeMatches.map(m => `
                <div class="dash-match-card">
                    <div class="dm-court">${m.court}<br><small style="font-size:0.7em">${m.type}</small></div>
                    <div class="dm-teams">${m.t1} vs ${m.t2}</div>
                    <div class="dm-score">${m.s1!=null?m.s1:'-'} - ${m.s2!=null?m.s2:'-'}</div>
                </div>
            `).join('');
        }

        // Update Next Matches
        const nmBox = document.getElementById('dashNextMatches');
        if (sync.nextMatches.length === 0) {
            nmBox.innerHTML = '<div style="text-align:center; color:#555;">Ingen flere kamper planlagt</div>';
        } else {
            nmBox.innerHTML = sync.nextMatches.map(m => `
                <div class="dash-next-card">
                    <span class="dnm-time">${m.time}</span>
                    <span>${m.court}: ${m.t1} vs ${m.t2}</span>
                </div>
            `).join('');
        }
    }
}

// --- UTILS ---
window.genId = function() { return Math.random().toString(36).substr(2,9); };
window.updateTitle = function(val) {
    data.title = val;
    document.getElementById('displayTitle').innerText = val;
    document.getElementById('printTitle').innerText = val;
    saveLocal();
};
window.toggleWakeLock = async function() {
    const btn = document.getElementById('wakeLockBtn');
    if(wakeLock !== null) {
        wakeLock.release().then(() => { wakeLock = null; btn.classList.remove('active'); btn.innerHTML='<i class="fas fa-eye"></i> Skjerm: Auto'; });
    } else {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            btn.classList.add('active');
            btn.innerHTML='<i class="fas fa-eye"></i> Skjerm: PÅ (Låst)';
        } catch(err) { alert("Wake Lock feilet (krever HTTPS?)"); }
    }
};
window.saveToFile = function() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `turnering_v8_${new Date().toISOString().slice(0,10)}.json`;
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
window.confirmReset = function() { if(confirm("Slett ALT?")) { localStorage.removeItem('ts_v8_data'); location.reload(); } };
window.showTab = function(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const map = {'setup':0,'arena':1,'draw':2,'matches':3,'finals':4};
    if(map[id] !== undefined) document.querySelectorAll('.tabs button')[map[id]].classList.add('active');
};
