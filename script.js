/* Version: #13 */

// =============================================================
// 1. GLOBAL DATA & STATE
// =============================================================
window.data = {
    title: "Turnering",
    classes: ["10A", "10B", "10C", "10D"],
    students: [],
    courts: [
        { id: 1, name: "Bane 1", type: "Volleyball" },
        { id: 2, name: "Bane 2", type: "Volleyball" },
        { id: 3, name: "Bane 3", type: "Stikkball" }
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

// Audio context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let soundEnabled = true;
let wakeLock = null;

// Timer State
let timerInterval = null;
let timerSeconds = 900; // 15 min default
let isTimerRunning = false;

// Drag & Drop State
let draggedMemberId = null;
let draggedFromTeamId = null;

// Dashboard UI State
let dashFontSizeVW = 18;

// =============================================================
// 2. INITIALIZATION
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
// 3. ADMIN LOGIC
// =============================================================

function initAdmin() {
    const adminView = document.getElementById('adminView');
    const dashView = document.getElementById('dashboardView');
    
    if (adminView) adminView.style.display = 'block';
    if (dashView) dashView.classList.add('hidden');

    loadLocal();
    renderClassButtons();
    renderStudentList();
    renderCourts();

    if (window.data.teams.length > 0) renderTeams();
    if (window.data.matches.length > 0) renderSchedule();
    updateLeaderboard();

    // Start System Clock Loop (Admin drives the sync)
    setInterval(adminSystemTick, 1000);
}

// --- PERSISTENCE ---
window.saveLocal = function() {
    localStorage.setItem('ts_v13_data', JSON.stringify(window.data));
    localStorage.setItem('ts_v13_update_trigger', Date.now());
};

function loadLocal() {
    const json = localStorage.getItem('ts_v13_data');
    if (json) {
        try {
            const parsed = JSON.parse(json);
            window.data = { ...window.data, ...parsed };
        } catch (e) {
            console.error("Data load error", e);
        }
    }
    updateInputs();
    updateTitleUI();
}

function updateInputs() {
    ['startTime', 'finalsTime', 'matchDuration', 'breakDuration'].forEach(k => {
        const el = document.getElementById(k);
        if (el) el.value = window.data.settings[k];
    });
}

function updateTitleUI() {
    const disp = document.getElementById('displayTitle');
    const inp = document.getElementById('tournamentTitleInput');
    const prt = document.getElementById('printTitle');
    if (disp) disp.innerText = window.data.title;
    if (inp) inp.value = window.data.title;
    if (prt) prt.innerText = window.data.title;
}

// --- SETUP TAB FUNCTIONS ---
let selectedClass = "";

window.renderClassButtons = function() {
    const d = document.getElementById('classButtons');
    if (!d) return;
    d.innerHTML = '';
    window.data.classes.forEach(c => {
        const b = document.createElement('span');
        b.className = `class-btn ${selectedClass === c ? 'selected' : ''}`;
        b.innerHTML = `${c} <i class="fas fa-times del-cls" onclick="delClass('${c}', event)"></i>`;
        b.onclick = () => { selectedClass = c; renderClassButtons(); };
        d.appendChild(b);
    });
    if (!selectedClass && window.data.classes.length > 0) {
        selectedClass = window.data.classes[0];
        if (d.children.length > 0) d.children[0].classList.add('selected');
    }
    renderCustomMixCheckboxes();
};

window.addClass = function() {
    const v = document.getElementById('newClassInput').value.trim().toUpperCase();
    if (v && !window.data.classes.includes(v)) {
        window.data.classes.push(v);
        window.data.classes.sort();
        saveLocal();
        renderClassButtons();
    }
};

window.delClass = function(c, e) {
    e.stopPropagation();
    if (confirm("Slett klasse?")) {
        window.data.classes = window.data.classes.filter(x => x !== c);
        saveLocal();
        renderClassButtons();
    }
};

window.addStudents = function() {
    if (!selectedClass) return alert("Velg klasse først.");
    const txt = document.getElementById('pasteArea').value;
    const lines = txt.split('\n');
    lines.forEach(l => {
        const n = l.trim();
        if (n) window.data.students.push({ id: genId(), name: n, class: selectedClass, present: true });
    });
    document.getElementById('pasteArea').value = "";
    saveLocal();
    renderStudentList();
};

window.renderStudentList = function() {
    const l = document.getElementById('studentList');
    if (!l) return;
    l.innerHTML = '';

    const query = document.getElementById('studentSearch').value.toLowerCase();
    document.getElementById('studentCount').innerText = window.data.students.length;

    let filtered = window.data.students.filter(s =>
        s.name.toLowerCase().includes(query) || s.class.toLowerCase().includes(query)
    );

    filtered.sort((a, b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name));

    filtered.forEach(s => {
        const d = document.createElement('div');
        d.className = `student-item ${s.present ? '' : 'absent'}`;
        d.innerHTML = `
            <span><b>${s.class}</b> ${s.name}</span>
            <input type="checkbox" ${s.present ? 'checked' : ''} onchange="togglePres('${s.id}')">
        `;
        l.appendChild(d);
    });
};

window.togglePres = function(id) {
    const s = window.data.students.find(x => x.id == id);
    if (s) {
        s.present = !s.present;
        saveLocal();
        renderStudentList();
    }
};

window.clearStudents = function() {
    if (confirm("Slett alle elever?")) {
        window.data.students = [];
        saveLocal();
        renderStudentList();
    }
};

// --- ARENA TAB FUNCTIONS ---
window.renderCourts = function() {
    const l = document.getElementById('courtList');
    if (!l) return;
    l.innerHTML = '';
    window.data.courts.forEach((c, i) => {
        const d = document.createElement('div');
        d.className = 'court-item';
        d.innerHTML = `
            <span>#${i + 1}</span>
            <input value="${c.name}" onchange="updCourt(${i},'name',this.value)">
            <input value="${c.type}" onchange="updCourt(${i},'type',this.value)">
            <button class="btn-small-red" onclick="delCourt(${i})">X</button>
        `;
        l.appendChild(d);
    });
};

window.addCourt = function() {
    window.data.courts.push({ id: Date.now(), name: `Bane ${window.data.courts.length + 1}`, type: "Volleyball" });
    saveLocal();
    renderCourts();
};

window.updCourt = function(i, f, v) { window.data.courts[i][f] = v; saveLocal(); };
window.delCourt = function(i) { window.data.courts.splice(i, 1); saveLocal(); renderCourts(); };

// Settings Listeners
['startTime', 'finalsTime', 'matchDuration', 'breakDuration'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', e => {
        window.data.settings[id] = e.target.value;
        saveLocal();
    });
});

// --- TEAMS & DRAW FUNCTIONS ---
window.toggleCustomMix = function() {
    const s = document.getElementById('drawStrategy').value;
    const panel = document.getElementById('customMixPanel');
    if (panel) panel.classList.toggle('hidden', s !== 'custom');
};

window.renderCustomMixCheckboxes = function() {
    const d = document.getElementById('customClassCheckboxes');
    if (!d) return;
    d.innerHTML = '';
    window.data.classes.forEach(c => {
        d.innerHTML += `<div><input type="checkbox" value="${c}" id="chk_${c}"><label for="chk_${c}">${c}</label></div>`;
    });
};

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

window.generateTeams = function() {
    if (window.data.teamsLocked) return alert("Lagene er låst. Lås opp først.");

    const count = parseInt(document.getElementById('teamCount').value);
    const strategy = document.getElementById('drawStrategy').value;
    const pool = window.data.students.filter(s => s.present);

    window.data.teams = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `Lag ${i + 1}`,
        members: [],
        points: 0,
        stats: { gf: 0, ga: 0, w: 0, d: 0, l: 0 }
    }));

    if (strategy === 'balanced') {
        let buckets = {};
        window.data.classes.forEach(c => {
            buckets[c] = pool.filter(s => s.class === c);
            shuffle(buckets[c]);
        });

        let deck = [];
        let active = true;
        while (active) {
            active = false;
            window.data.classes.forEach(c => {
                if (buckets[c] && buckets[c].length > 0) {
                    deck.push(buckets[c].pop());
                    active = true;
                }
            });
        }
        deck.forEach((student, index) => {
            window.data.teams[index % count].members.push(student);
        });
    } else if (strategy === 'class_based') {
        let byClass = {};
        window.data.classes.forEach(c => byClass[c] = []);
        pool.forEach(s => { if (byClass[s.class]) byClass[s.class].push(s); });

        let teamsPerClass = Math.ceil(count / window.data.classes.length);
        let currentTeam = 0;

        for (let c of window.data.classes) {
            shuffle(byClass[c]);
            let startTeam = currentTeam;
            let endTeam = Math.min(currentTeam + teamsPerClass, count);
            let localTIdx = startTeam;

            while (byClass[c].length > 0) {
                window.data.teams[localTIdx].members.push(byClass[c].pop());
                localTIdx++;
                if (localTIdx >= endTeam) localTIdx = startTeam;
            }
            currentTeam = endTeam;
        }
    } else if (strategy === 'random') {
        shuffle(pool);
        pool.forEach((s, i) => window.data.teams[i % count].members.push(s));
    } else {
        let group1Classes = [];
        if (strategy === 'ab_cd') {
            const mid = Math.ceil(window.data.classes.length / 2);
            group1Classes = window.data.classes.slice(0, mid);
        } else {
            document.querySelectorAll('#customClassCheckboxes input:checked').forEach(cb => group1Classes.push(cb.value));
        }

        const pool1 = pool.filter(s => group1Classes.includes(s.class));
        const pool2 = pool.filter(s => !group1Classes.includes(s.class));

        const teams1 = window.data.teams.slice(0, Math.ceil(count / 2));
        const teams2 = window.data.teams.slice(Math.ceil(count / 2));

        shuffle(pool1); pool1.forEach((s, i) => teams1[i % teams1.length].members.push(s));
        shuffle(pool2); pool2.forEach((s, i) => teams2[i % teams2.length].members.push(s));
    }

    saveLocal();
    renderTeams();
};

window.renderTeams = function() {
    const d = document.getElementById('drawDisplay');
    if (!d) return;
    d.innerHTML = '';

    window.data.teams.forEach(t => {
        const card = document.createElement('div');
        card.className = 'team-card';
        card.ondragover = window.handleDragOver;
        card.ondragleave = window.handleDragLeave;
        card.ondrop = (e) => window.handleDrop(e, t.id);

        const mems = t.members.map((m, i) => `
            <div class="team-member" draggable="true" ondragstart="handleDragStart(event, '${m.id}', ${t.id})">
                <span>${i + 1}. ${m.name}</span>
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
    if (l) {
        l.className = window.data.teamsLocked ? 'btn-small-red' : 'btn-yellow';
        l.innerHTML = window.data.teamsLocked ? '<i class="fas fa-lock"></i> Låst' : '<i class="fas fa-unlock"></i> Åpen';
    }
};

window.renameTeam = function(id, v) {
    const t = window.data.teams.find(t => t.id == id);
    if (t) { t.name = v; saveLocal(); updateLeaderboard(); }
};

window.toggleLockTeams = function() {
    window.data.teamsLocked = !window.data.teamsLocked;
    saveLocal();
    renderTeams();
};

// --- DRAG & DROP LOGIC ---
window.handleDragStart = function(e, memberId, teamId) {
    if (window.data.teamsLocked) { e.preventDefault(); return; }
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

    const sourceTeam = window.data.teams.find(t => t.id === draggedFromTeamId);
    const targetTeam = window.data.teams.find(t => t.id === targetTeamId);

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
    if (!window.data.teamsLocked) toggleLockTeams();
    if (window.data.courts.length === 0) return alert("Ingen baner definert i 'Arena'.");

    window.data.matches = [];
    let time = new Date(`2000-01-01T${window.data.settings.startTime}`);
    const endTime = new Date(`2000-01-01T${window.data.settings.finalsTime}`);
    const slotDur = parseInt(window.data.settings.matchDuration) + parseInt(window.data.settings.breakDuration);

    let tIds = window.data.teams.map(t => t.id);
    if (tIds.length % 2 !== 0) tIds.push(null);

    let pairs = [];
    for (let r = 0; r < tIds.length - 1; r++) {
        for (let i = 0; i < tIds.length / 2; i++) {
            const a = tIds[i];
            const b = tIds[tIds.length - 1 - i];
            if (a && b) pairs.push({ t1: a, t2: b });
        }
        tIds.splice(1, 0, tIds.pop());
    }

    while (time < endTime && pairs.length > 0) {
        let active = [];
        window.data.courts.forEach(c => {
            if (pairs.length > 0) {
                const idx = pairs.findIndex(p => !active.some(a => a.t1 == p.t1 || a.t2 == p.t1 || a.t1 == p.t2 || a.t2 == p.t2));
                if (idx > -1) {
                    const p = pairs.splice(idx, 1)[0];
                    active.push({ ...p, c: c.name, type: c.type });
                }
            }
        });

        const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        active.forEach(m => {
            window.data.matches.push({
                id: genId(),
                time: timeStr,
                t1: m.t1,
                t2: m.t2,
                court: m.c,
                type: m.type,
                s1: null,
                s2: null,
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
    if (!c) return;
    c.innerHTML = '';

    const groups = {};
    window.data.matches.sort((a, b) => a.time.localeCompare(b.time));
    window.data.matches.forEach(m => {
        if (!groups[m.time]) groups[m.time] = [];
        groups[m.time].push(m);
    });

    for (let time in groups) {
        const blk = document.createElement('div');
        blk.className = 'match-block';
        blk.innerHTML = `
            <div class="block-header">
                <span class="block-time">Kl ${time}</span>
                <button class="btn-text-red" onclick="delBlock('${time}')">Slett bolk</button>
            </div>
        `;
        groups[time].forEach(m => {
            const t1 = window.data.teams.find(t => t.id == m.t1);
            const t2 = window.data.teams.find(t => t.id == m.t2);
            if (!t1 || !t2) return;
            const row = document.createElement('div');
            row.className = 'match-row';
            row.innerHTML = `
                <div class="match-court-badge">${m.court}<br><small>${m.type}</small></div>
                <div class="match-teams">${t1.name} vs ${t2.name}</div>
                <div class="match-score">
                    <input type="number" value="${m.s1 ?? ''}" onchange="updScore('${m.id}','s1',this.value)"> - 
                    <input type="number" value="${m.s2 ?? ''}" onchange="updScore('${m.id}','s2',this.value)">
                </div>
            `;
            blk.appendChild(row);
        });
        c.appendChild(blk);
    }
};

window.updScore = function(id, f, v) {
    const m = window.data.matches.find(x => x.id == id);
    m[f] = v === '' ? null : parseInt(v);
    m.done = (m.s1 !== null && m.s2 !== null);
    saveLocal();
    updateLeaderboard();
};

window.delBlock = function(time) {
    if (confirm("Slett alle kamper kl " + time + "?")) {
        window.data.matches = window.data.matches.filter(m => m.time !== time);
        saveLocal();
        renderSchedule();
    }
};

window.addManualMatch = function() {
    if (window.data.teams.length === 0) return;
    const t = window.data.teams[0];
    window.data.matches.push({
        id: genId(),
        time: "12:00",
        t1: t.id,
        t2: t.id,
        court: "Manuell",
        type: "Ekstra",
        s1: null,
        s2: null,
        done: false
    });
    saveLocal();
    renderSchedule();
};

window.clearSchedule = function() {
    if (confirm("Slett alle kamper?")) {
        window.data.matches = [];
        saveLocal();
        renderSchedule();
        updateLeaderboard();
    }
};

// --- DRIFTSKONTROLL (TIME MANAGEMENT) ---
window.recalcFutureSchedule = function() {
    if (window.data.matches.length === 0) return alert("Ingen kamper.");
    let times = [...new Set(window.data.matches.map(m => m.time))].sort();
    const now = new Date();
    const curTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let futureTimes = times.filter(t => t >= curTimeStr);

    if (futureTimes.length === 0) return alert("Ingen fremtidige kamper.");
    if (!confirm(`Oppdater tider for ${futureTimes.length} bolker?`)) return;

    const slotDur = parseInt(window.data.settings.matchDuration) + parseInt(window.data.settings.breakDuration);
    let [h, m] = futureTimes[0].split(':').map(Number);
    let baseDate = new Date(); baseDate.setHours(h, m, 0);

    futureTimes.forEach(oldTime => {
        const newTimeStr = baseDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        window.data.matches.forEach(match => { if (match.time === oldTime) match.time = newTimeStr; });
        baseDate.setMinutes(baseDate.getMinutes() + slotDur);
    });
    saveLocal();
    renderSchedule();
};

window.startNextRoundNow = function() {
    const remainingMatches = window.data.matches.filter(m => !m.done).sort((a, b) => a.time.localeCompare(b.time));
    if (remainingMatches.length === 0) return alert("Ingen gjenstående kamper.");

    const nextBlockTime = remainingMatches[0].time;
    const now = new Date();
    now.setMinutes(now.getMinutes() + 2);
    const newStartStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!confirm(`Flytt runde ${nextBlockTime} til ${newStartStr}?`)) return;

    const [h1, m1] = nextBlockTime.split(':').map(Number);
    const [h2, m2] = newStartStr.split(':').map(Number);
    const oldDate = new Date(); oldDate.setHours(h1, m1, 0);
    const newDate = new Date(); newDate.setHours(h2, m2, 0);
    const diffMs = newDate - oldDate;
    const diffMins = Math.round(diffMs / 60000);

    shiftSchedule(diffMins);
};

window.shiftSchedule = function(minutes) {
    if (window.data.matches.length === 0) return;

    const remainingMatches = window.data.matches.filter(m => !m.done).sort((a, b) => a.time.localeCompare(b.time));
    if (remainingMatches.length === 0) return alert("Ingen kamper å flytte.");

    const firstTime = remainingMatches[0].time;
    let distinctTimes = [...new Set(window.data.matches.map(m => m.time))].sort();
    let timesToShift = distinctTimes.filter(t => t >= firstTime);

    timesToShift.forEach(oldTime => {
        let [h, m] = oldTime.split(':').map(Number);
        let d = new Date(); d.setHours(h, m + minutes, 0);
        let newTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        window.data.matches.forEach(match => {
            if (match.time === oldTime) match.time = newTime;
        });
    });

    saveLocal();
    renderSchedule();
    alert(`Tidsplan justert med ${minutes} minutter.`);
};

// --- LEADERBOARD & FINALS ---
window.updateLeaderboard = function() {
    window.data.teams.forEach(t => { t.points = 0; t.stats = { gf: 0, ga: 0, w: 0, d: 0, l: 0 }; });

    window.data.matches.forEach(m => {
        if (m.done) {
            const t1 = window.data.teams.find(t => t.id == m.t1);
            const t2 = window.data.teams.find(t => t.id == m.t2);
            if (t1 && t2) {
                t1.stats.gf += m.s1; t1.stats.ga += m.s2;
                t2.stats.gf += m.s2; t2.stats.ga += m.s1;

                if (m.s1 > m.s2) { t1.points += 3; t1.stats.w++; }
                else if (m.s2 > m.s1) { t2.points += 3; t2.stats.w++; }
                else { t1.points += 1; t2.points += 1; t1.stats.d++; t2.stats.d++; }
            }
        }
    });

    window.data.teams.sort((a, b) => b.points - a.points || (b.stats.gf - b.stats.ga) - (a.stats.gf - a.stats.ga));

    const s1 = document.getElementById('finalTeam1');
    const s2 = document.getElementById('finalTeam2');
    if (s1 && s2) {
        const html = window.data.teams.map((t, i) => `<option value="${t.id}">${i + 1}. ${t.name} (${t.points}p)</option>`).join('');
        const v1 = s1.value; const v2 = s2.value;
        s1.innerHTML = html; s2.innerHTML = html;
        if (v1) s1.value = v1;
        if (v2) s2.value = v2; else if (window.data.teams.length > 1) s2.selectedIndex = 1;
    }

    const mb = document.getElementById('miniLeaderboard');
    if (mb) mb.innerHTML = window.data.teams.slice(0, 8).map((t, i) => `<tr><td>${i + 1}</td><td>${t.name}</td><td>${t.points}</td></tr>`).join('');
};

window.activateFinalMode = function() {
    const t1 = window.data.teams.find(t => t.id == document.getElementById('finalTeam1').value);
    const t2 = window.data.teams.find(t => t.id == document.getElementById('finalTeam2').value);

    window.data.finalState.active = true;
    window.data.finalState.t1 = t1.name;
    window.data.finalState.t2 = t2.name;
    window.data.finalState.title = document.getElementById('finalType').value;
    window.data.finalState.act = document.getElementById('finalAct').value;
    window.data.finalState.s1 = 0;
    window.data.finalState.s2 = 0;

    resetTimer();
    document.getElementById('adminStageT1').innerText = t1.name;
    document.getElementById('adminStageT2').innerText = t2.name;
    document.getElementById('adminStageS1').value = 0;
    document.getElementById('adminStageS2').value = 0;
    saveLocal();
};

window.exitFinalMode = function() {
    window.data.finalState.active = false;
    saveLocal();
};

window.syncFinalScore = function() {
    window.data.finalState.s1 = parseInt(document.getElementById('adminStageS1').value);
    window.data.finalState.s2 = parseInt(document.getElementById('adminStageS2').value);
    saveLocal();
};

window.endTournament = function() {
    const s1 = window.data.finalState.s1;
    const s2 = window.data.finalState.s2;
    let w = "UAVGJORT";
    if (s1 > s2) w = window.data.finalState.t1;
    if (s2 > s1) w = window.data.finalState.t2;

    document.getElementById('winnerText').innerText = w;
    document.getElementById('winnerOverlay').classList.remove('hidden');
};

window.closeWinner = function() {
    document.getElementById('winnerOverlay').classList.add('hidden');
};

// --- SYSTEM SYNC & TIMERS ---
function adminSystemTick() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const el = document.getElementById('adminRealTime');
    if (el) el.innerText = timeStr;

    const shortTime = timeStr.substr(0, 5);
    const activeMatches = getMatchesAtTime(shortTime);
    const nextMatches = getNextMatches(shortTime);

    let startTimeDisplay = "--:--";
    if (activeMatches.length > 0) {
        const mObj = window.data.matches.find(m => m.t1 === activeMatches[0].t1 || m.t2 === activeMatches[0].t1);
        if (mObj) startTimeDisplay = "KAMPSTART: KL " + mObj.time;
    } else if (nextMatches.length > 0) {
        startTimeDisplay = "NESTE KAMP: KL " + nextMatches[0].time;
    }

    const syncObj = {
        timer: timerSeconds,
        running: isTimerRunning,
        activeMatches: activeMatches,
        nextMatches: nextMatches,
        finalMode: window.data.finalState.active,
        finalState: window.data.finalState,
        title: window.data.title,
        startTimeDisplay: startTimeDisplay
    };

    localStorage.setItem('ts_v13_dashboard_sync', JSON.stringify(syncObj));
}

function getMatchesAtTime(shortTime) {
    const sorted = [...window.data.matches].sort((a, b) => a.time.localeCompare(b.time));
    let currentBlockTime = null;
    for (let m of sorted) {
        if (m.time <= shortTime) currentBlockTime = m.time;
        else break;
    }
    if (!currentBlockTime) return [];

    return sorted.filter(m => m.time === currentBlockTime).map(m => {
        const t1 = window.data.teams.find(t => t.id == m.t1);
        const t2 = window.data.teams.find(t => t.id == m.t2);
        return {
            court: m.court, type: m.type,
            t1: t1 ? t1.name : '?', t2: t2 ? t2.name : '?',
            s1: m.s1, s2: m.s2
        };
    });
}

function getNextMatches(shortTime) {
    const sorted = [...window.data.matches].sort((a, b) => a.time.localeCompare(b.time));
    const future = sorted.filter(m => m.time > shortTime);
    if (future.length === 0) return [];
    const nextBlockTime = future[0].time;
    return future.filter(m => m.time === nextBlockTime).map(m => {
        const t1 = window.data.teams.find(t => t.id == m.t1);
        const t2 = window.data.teams.find(t => t.id == m.t2);
        return {
            time: m.time, court: m.court,
            t1: t1 ? t1.name : '?', t2: t2 ? t2.name : '?'
        };
    });
}

// Timer Controls
window.startTimer = function() {
    if (isTimerRunning) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playHorn();
    isTimerRunning = true;
    timerInterval = setInterval(() => {
        timerSeconds--;
        updateAdminTimerUI();
        if (timerSeconds <= 0) {
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
    timerSeconds = parseInt(window.data.settings.matchDuration) * 60;
    updateAdminTimerUI();
};

window.adjustTimer = function(min) {
    timerSeconds += (min * 60);
    if (timerSeconds < 0) timerSeconds = 0;
    updateAdminTimerUI();
};

function updateAdminTimerUI() {
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const s = (timerSeconds % 60).toString().padStart(2, '0');
    const el = document.getElementById('adminTimerDisplay');
    if (el) el.innerText = `${m}:${s}`;
}

window.playHorn = function() {
    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 150;
    const osc2 = audioCtx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 148;
    const g = audioCtx.createGain();
    osc.connect(g); osc2.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(1, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.5);
    osc.start(); osc2.start(); osc.stop(audioCtx.currentTime + 2.5); osc2.stop(audioCtx.currentTime + 2.5);
};

// =============================================================
// 4. DASHBOARD LOGIC
// =============================================================

function initDashboard() {
    document.getElementById('adminView').classList.add('hidden');
    document.getElementById('adminView').style.display = 'none';
    document.getElementById('dashboardView').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setInterval(dashboardTick, 200);
}

// Resizing
window.resizeDashText = function(dir) {
    dashFontSizeVW += dir;
    if (dashFontSizeVW < 5) dashFontSizeVW = 5;
    if (dashFontSizeVW > 40) dashFontSizeVW = 40;
    const el = document.getElementById('dashTimer');
    if (el) el.style.fontSize = dashFontSizeVW + "vw";
};

function dashboardTick() {
    const json = localStorage.getItem('ts_v13_dashboard_sync');
    if (json) {
        const sync = JSON.parse(json);
        updateDashUI(sync);
    }
}

function updateDashUI(sync) {
    const now = new Date();
    document.getElementById('dashClock').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('dashTitle').innerText = sync.title || "TURNERING";

    if (sync.finalMode) {
        document.getElementById('dashSeriesMode').classList.add('hidden');
        document.getElementById('dashFinalMode').classList.remove('hidden');
        const fs = sync.finalState;

        document.getElementById('dashFinalTitle').innerText = fs.title;
        document.getElementById('dashFinalAct').innerText = fs.act;
        document.getElementById('dashFinalT1').innerText = fs.t1;
        document.getElementById('dashFinalT2').innerText = fs.t2;
        document.getElementById('dashFinalS1').innerText = fs.s1;
        document.getElementById('dashFinalS2').innerText = fs.s2;

        const m = Math.floor(sync.timer / 60).toString().padStart(2, '0');
        const s = (sync.timer % 60).toString().padStart(2, '0');
        const el = document.getElementById('dashFinalTimer');
        el.innerText = `${m}:${s}`;
        el.style.color = sync.running ? '#4caf50' : '#f44336';

    } else {
        document.getElementById('dashFinalMode').classList.add('hidden');
        document.getElementById('dashSeriesMode').classList.remove('hidden');

        const m = Math.floor(sync.timer / 60).toString().padStart(2, '0');
        const s = (sync.timer % 60).toString().padStart(2, '0');
        const dTimer = document.getElementById('dashTimer');
        const dStatus = document.getElementById('dashStatus');

        dTimer.innerText = `${m}:${s}`;

        if (sync.running) {
            dTimer.style.color = '#4caf50';
            dStatus.innerText = "KAMP PÅGÅR";
            dStatus.style.background = "#1b5e20";
        } else if (sync.timer === 0) {
            dTimer.style.color = '#f44336';
            dStatus.innerText = "TIDEN ER UTE";
            dStatus.style.background = "#b71c1c";
        } else {
            dTimer.style.color = '#ff9800';
            dStatus.innerText = "KLAR / PAUSE";
            dStatus.style.background = "#333";
        }

        document.getElementById('dashStartTime').innerText = sync.startTimeDisplay || "";

        const amBox = document.getElementById('dashActiveMatches');
        if (sync.activeMatches.length === 0) {
            amBox.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">Ingen aktive kamper</div>';
        } else {
            amBox.innerHTML = sync.activeMatches.map(m => `
                <div class="dash-match-card">
                    <div class="dm-row-top"><span class="dm-court">${m.court}</span><span class="dm-type">${m.type}</span></div>
                    <div class="dm-teams">${m.t1} vs ${m.t2}</div>
                    <div class="dm-score">${m.s1 != null ? m.s1 : '-'} - ${m.s2 != null ? m.s2 : '-'}</div>
                </div>`).join('');
        }

        const nmBox = document.getElementById('dashNextMatches');
        if (sync.nextMatches.length === 0) {
            nmBox.innerHTML = '<div style="text-align:center;color:#555;">Ingen flere kamper</div>';
        } else {
            nmBox.innerHTML = sync.nextMatches.map(m => `
                <div class="dash-next-card">
                    <span class="dnm-time">${m.time}</span>
                    <span>${m.court}: ${m.t1} vs ${m.t2}</span>
                </div>`).join('');
        }
    }
}

// --- 5. UTILS ---
window.genId = function() { return Math.random().toString(36).substr(2, 9); };

window.updateTitle = function(val) {
    window.data.title = val;
    document.getElementById('displayTitle').innerText = val;
    document.getElementById('printTitle').innerText = val;
    saveLocal();
};

window.toggleWakeLock = async function() {
    const btn = document.getElementById('wakeLockBtn');
    if (wakeLock !== null) {
        wakeLock.release().then(() => {
            wakeLock = null;
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fas fa-eye"></i> Skjerm: Auto';
        });
    } else {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-eye"></i> Skjerm: PÅ (Låst)';
        } catch (err) {
            alert("Wake Lock feilet. (Krever HTTPS?)");
        }
    }
};

window.openDashboard = function() {
    const url = window.location.href.split('?')[0] + '?mode=dashboard';
    window.open(url, 'TurneringsDashboard', 'width=1280,height=720');
};

window.saveToFile = function() {
    const blob = new Blob([JSON.stringify(window.data, null, 2)], { type: "application/json" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `turnering_v13_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
};

window.loadFromFile = function() {
    const file = document.getElementById('fileInput').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            window.data = JSON.parse(e.target.result);
            saveLocal();
            location.reload();
        } catch (err) { alert("Feil filformat"); }
    };
    reader.readAsText(file);
};

window.confirmReset = function() {
    if (confirm("Slett ALT? Dette kan ikke angres.")) {
        localStorage.removeItem('ts_v13_data');
        location.reload();
    }
};

window.showTab = function(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    const map = { 'setup': 0, 'arena': 1, 'draw': 2, 'matches': 3, 'finals': 4 };
    if (map[id] !== undefined) {
        document.querySelectorAll('.tabs button')[map[id]].classList.add('active');
    }
};

/* Version: #13 */
