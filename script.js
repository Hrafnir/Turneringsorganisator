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

// --- INIT & PERSISTENCE ---
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

function saveLocal() {
    localStorage.setItem('ts3_ultimate', JSON.stringify(data));
}

function loadLocal() {
    const json = localStorage.getItem('ts3_ultimate');
    if(json) {
        const parsed = JSON.parse(json);
        // Merge for compatibility if new fields added later
        data = { ...data, ...parsed };
        // Update inputs
        document.getElementById('startTime').value = data.settings.startTime;
        document.getElementById('finalsTime').value = data.settings.finalsTime;
        document.getElementById('matchDuration').value = data.settings.matchDuration;
        document.getElementById('breakDuration').value = data.settings.breakDuration;
    }
}

// FILE I/O
function saveToFile() {
    const str = JSON.stringify(data, null, 2);
    const blob = new Blob([str], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turnering_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
}

function loadFromFile() {
    const input = document.getElementById('fileInput');
    if(input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            data = JSON.parse(e.target.result);
            saveLocal();
            location.reload();
        } catch(err) {
            alert("Kunne ikke lese fil. Er det en gyldig JSON?");
        }
    };
    reader.readAsText(file);
}

function confirmReset() {
    if(confirm("Dette sletter ALT (elever, oppsett, resultater). Er du sikker?")) {
        localStorage.removeItem('ts3_ultimate');
        location.reload();
    }
}

// --- TABS ---
function showTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Highlight tab button?
}

// --- CLASS MANAGEMENT ---
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
    // Select first if none
    if(!selectedClass && data.classes.length > 0) {
        selectedClass = data.classes[0];
        renderClassButtons();
    }
}

function addClass() {
    const inp = document.getElementById('newClassInput');
    const val = inp.value.trim().toUpperCase();
    if(val && !data.classes.includes(val)) {
        data.classes.push(val);
        data.classes.sort();
        saveLocal();
        renderClassButtons();
        inp.value = "";
    }
}

function removeClass(c) {
    if(confirm(`Slette klassen ${c}? Elever i klassen vil miste klassetilhørighet.`)) {
        data.classes = data.classes.filter(x => x !== c);
        if(selectedClass === c) selectedClass = "";
        saveLocal();
        renderClassButtons();
    }
}

// --- STUDENTS ---
function addStudents() {
    if(!selectedClass) { alert("Velg en klasse først!"); return; }
    const txt = document.getElementById('pasteArea').value;
    txt.split('\n').forEach(line => {
        const name = line.trim();
        if(name) {
            data.students.push({
                id: Math.random().toString(36).substr(2,9),
                name: name,
                class: selectedClass,
                present: true
            });
        }
    });
    document.getElementById('pasteArea').value = "";
    saveLocal();
    renderStudentList();
}

function renderStudentList() {
    const list = document.getElementById('studentList');
    list.innerHTML = '';
    document.getElementById('studentCount').innerText = data.students.length;
    
    // Sort by Class then Name
    data.students.sort((a,b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name));

    data.students.forEach(s => {
        const div = document.createElement('div');
        div.className = `student-item ${s.present?'':'absent'}`;
        div.innerHTML = `
            <span><b>${s.class}</b> ${s.name}</span>
            <input type="checkbox" ${s.present?'checked':''} onchange="togglePresence('${s.id}')">
        `;
        list.appendChild(div);
    });
}

function togglePresence(id) {
    const s = data.students.find(x => x.id === id);
    if(s) { s.present = !s.present; saveLocal(); renderStudentList(); }
}

function clearStudents() {
    if(confirm("Slette alle elever?")) {
        data.students = [];
        saveLocal();
        renderStudentList();
    }
}

// --- ARENA CONFIG ---
function renderCourts() {
    const list = document.getElementById('courtList');
    list.innerHTML = '';
    data.courts.forEach((c, idx) => {
        const div = document.createElement('div');
        div.className = 'court-item';
        div.innerHTML = `
            <span>#${idx+1}</span>
            <input type="text" value="${c.name}" onchange="updateCourt(${idx}, 'name', this.value)" placeholder="Banenavn">
            <input type="text" value="${c.type}" onchange="updateCourt(${idx}, 'type', this.value)" placeholder="Aktivitet (f.eks Volleyball)">
            <button class="btn-small-red" onclick="removeCourt(${idx})">X</button>
        `;
        list.appendChild(div);
    });
}

function addCourt() {
    data.courts.push({id: Date.now(), name: `Bane ${data.courts.length+1}`, type: "Aktivitet"});
    saveLocal();
    renderCourts();
}

function updateCourt(idx, field, val) {
    data.courts[idx][field] = val;
    saveLocal();
}

function removeCourt(idx) {
    data.courts.splice(idx, 1);
    saveLocal();
    renderCourts();
}

// Inputs listeners
['startTime','finalsTime','matchDuration','breakDuration'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
        data.settings[id] = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
        saveLocal();
    });
});

// --- TEAM DRAW ---
function generateTeamsAnimated() {
    if(data.teamsLocked) { alert("Lås opp lagene først."); return; }
    
    const count = parseInt(document.getElementById('teamCount').value);
    const presentStudents = data.students.filter(s => s.present);
    
    // Sort students by class to distribute evenly
    const byClass = {};
    data.classes.forEach(c => byClass[c] = []);
    // Also catch students with deleted classes
    presentStudents.forEach(s => {
        if(!byClass[s.class]) byClass[s.class] = [];
        byClass[s.class].push(s);
    });

    // Shuffle each class
    for(let c in byClass) byClass[c].sort(() => Math.random() - 0.5);

    data.teams = Array.from({length: count}, (_, i) => ({
        id: i+1, name: `Lag ${i+1}`, members: [], points:0, stats:{p:0, w:0, d:0, l:0, gf:0, ga:0}
    }));

    // Round robin deal
    let teamIdx = 0;
    let anyLeft = true;
    while(anyLeft) {
        anyLeft = false;
        for(let c in byClass) {
            if(byClass[c].length > 0) {
                data.teams[teamIdx].members.push(byClass[c].pop());
                teamIdx = (teamIdx + 1) % count;
                anyLeft = true;
            }
        }
    }
    
    saveLocal();
    renderTeams();
}

function renderTeams() {
    const container = document.getElementById('drawDisplay');
    container.innerHTML = '';
    data.teams.forEach(t => {
        const div = document.createElement('div');
        div.className = 'team-card';
        div.ondragover = e => e.preventDefault();
        div.ondrop = e => handleDrop(e, t.id);

        const mems = t.members.map(m => `
            <div class="team-member" draggable="${!data.teamsLocked}" ondragstart="handleDrag(event, '${m.id}', ${t.id})">
                ${m.name} <small>(${m.class})</small>
            </div>
        `).join('');
        
        div.innerHTML = `<h3><input value="${t.name}" onchange="renameTeam(${t.id}, this.value)" style="background:none;border:none;color:inherit;text-align:center;font-weight:bold;width:100%;"></h3><div>${mems}</div>`;
        container.appendChild(div);
    });
    updateLockBtn();
}

function renameTeam(id, val) {
    const t = data.teams.find(x => x.id === id);
    if(t) t.name = val;
    saveLocal();
}

// Drag Drop Logic
let dragSrc = null;
function handleDrag(e, mId, tId) { dragSrc = {mId, tId}; e.target.classList.add('dragging'); }
function handleDrop(e, targetTid) {
    e.preventDefault();
    if(data.teamsLocked || !dragSrc) return;
    if(dragSrc.tId === targetTid) return;
    
    const srcTeam = data.teams.find(t => t.id === dragSrc.tId);
    const tgtTeam = data.teams.find(t => t.id === targetTid);
    const mIdx = srcTeam.members.findIndex(m => m.id === dragSrc.mId);
    
    if(mIdx > -1) {
        tgtTeam.members.push(srcTeam.members.splice(mIdx, 1)[0]);
        saveLocal();
        renderTeams();
    }
    dragSrc = null;
}

function toggleLockTeams() {
    data.teamsLocked = !data.teamsLocked;
    saveLocal();
    renderTeams();
}
function updateLockBtn() {
    const btn = document.getElementById('lockBtn');
    btn.innerHTML = data.teamsLocked ? '<i class="fas fa-lock"></i> Låst' : '<i class="fas fa-unlock"></i> Åpen';
    btn.className = data.teamsLocked ? 'btn-small-red' : 'btn-yellow';
}

// --- SCHEDULER (THE BRAIN) ---
function generateSchedule() {
    if(data.courts.length === 0) { alert("Du må definere minst én bane i 'Arena' fanen."); return; }
    if(!data.teamsLocked) toggleLockTeams();
    
    data.matches = [];
    
    // Time Setup
    let time = new Date();
    const [sh, sm] = data.settings.startTime.split(':');
    time.setHours(sh, sm, 0);
    
    const [fh, fm] = data.settings.finalsTime.split(':');
    let finalsTime = new Date();
    finalsTime.setHours(fh, fm, 0);

    const matchMin = data.settings.matchDuration;
    const breakMin = data.settings.breakDuration;
    const roundDuration = matchMin + breakMin;

    // Available minutes
    const totalMinutes = (finalsTime - time) / 60000;
    const maxRounds = Math.floor(totalMinutes / roundDuration);
    
    // Round Robin Generator
    let teamIds = data.teams.map(t => t.id);
    if(teamIds.length % 2 !== 0) teamIds.push(null); // Bye
    
    const rounds = [];
    const numTeams = teamIds.length;
    
    // Generate all unique pairings (Circle Method)
    // We need enough matches to fill the time. 
    // Standard RR: numTeams - 1 rounds.
    // If maxRounds > RR rounds, we repeat.
    
    let currentRotation = [...teamIds];
    
    for(let r=0; r < maxRounds; r++) {
        let roundMatches = [];
        
        // Pairings for this rotation
        for(let i=0; i<numTeams/2; i++) {
            const t1 = currentRotation[i];
            const t2 = currentRotation[numTeams - 1 - i];
            if(t1 !== null && t2 !== null) {
                roundMatches.push({t1, t2});
            }
        }
        
        // Rotate array
        currentRotation.splice(1, 0, currentRotation.pop());
        
        rounds.push(roundMatches);
    }
    
    // ASSIGN TO COURTS
    // For each round slot in time:
    // Take the top X matches from the generated round matches where X is num courts.
    // Wait, standard RR puts all teams in play at once. 
    // If we have 12 teams (6 matches) but only 3 courts, we have to split the "RR Round" into 2 "Time Rounds".
    
    // Flatten all pairings from the Loop logic
    let allPairingsQueue = rounds.flat(); // This is just a stream of matches to be played
    
    // Create Time Slots
    let roundCounter = 1;
    let currentTime = new Date(time);
    
    while(currentTime < finalsTime && allPairingsQueue.length > 0) {
        let activeMatches = [];
        
        // Fill Courts
        data.courts.forEach(court => {
            if(allPairingsQueue.length > 0) {
                // To avoid teams playing twice in same timeslot?
                // The queue comes from RR rounds, so usually distinct teams. 
                // But if we split an RR round across time slots, we are fine.
                // PROBLEM: If we take match 1 (Team A vs B) and match 2 (Team C vs A) -> A plays twice.
                // SOLUTION: Check if teams are already playing in this timeslot.
                
                let matchIndex = -1;
                for(let i=0; i < allPairingsQueue.length; i++) {
                    const pair = allPairingsQueue[i];
                    const t1Busy = activeMatches.some(m => m.t1 === pair.t1 || m.t2 === pair.t1);
                    const t2Busy = activeMatches.some(m => m.t1 === pair.t2 || m.t2 === pair.t2);
                    
                    if(!t1Busy && !t2Busy) {
                        matchIndex = i;
                        break;
                    }
                }
                
                if(matchIndex > -1) {
                    const pair = allPairingsQueue.splice(matchIndex, 1)[0];
                    activeMatches.push({
                        ...pair,
                        courtName: court.name,
                        courtType: court.type
                    });
                }
            }
        });
        
        if(activeMatches.length === 0) break; // No valid matches found
        
        // Add to schedule
        const timeStr = currentTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        activeMatches.forEach(m => {
            data.matches.push({
                id: Math.random().toString(36).substr(2,9),
                time: timeStr,
                round: roundCounter,
                t1: m.t1, t2: m.t2,
                court: m.courtName, type: m.courtType,
                s1: null, s2: null, done: false
            });
        });
        
        currentTime.setMinutes(currentTime.getMinutes() + roundDuration);
        roundCounter++;
    }
    
    saveLocal();
    renderSchedule();
    showTab('matches');
}

function renderSchedule() {
    const list = document.getElementById('scheduleContainer');
    list.innerHTML = '';
    
    let lastTime = "";
    data.matches.forEach(m => {
        if(m.time !== lastTime) {
            lastTime = m.time;
            const h = document.createElement('div');
            h.className = 'round-header';
            h.innerHTML = `<span>Kl ${m.time} (Runde ${m.round})</span>`;
            list.appendChild(h);
        }
        
        const t1 = data.teams.find(t => t.id === m.t1);
        const t2 = data.teams.find(t => t.id === m.t2);
        if(!t1 || !t2) return;

        const div = document.createElement('div');
        div.className = 'match-card';
        div.innerHTML = `
            <div class="match-info">
                <span class="match-court">${m.court} - ${m.type}</span>
                <span class="match-teams">${t1.name} vs ${t2.name}</span>
            </div>
            <div class="score-input">
                <input type="number" value="${m.s1===null?'':m.s1}" onchange="updateScore('${m.id}', 's1', this.value)">
                -
                <input type="number" value="${m.s2===null?'':m.s2}" onchange="updateScore('${m.id}', 's2', this.value)">
            </div>
        `;
        list.appendChild(div);
    });
}

function updateScore(mid, field, val) {
    const m = data.matches.find(x => x.id === mid);
    if(m) {
        m[field] = val === '' ? null : parseInt(val);
        m.done = (m.s1 !== null && m.s2 !== null);
        saveLocal();
        calcStandings();
    }
}

function clearSchedule() {
    if(confirm("Slette hele kampoppsettet og resultatene?")) {
        data.matches = [];
        data.finals = [];
        saveLocal();
        renderSchedule();
        calcStandings();
    }
}

function addManualMatch() {
    const t1 = data.teams[0];
    const m = {
        id: Math.random().toString(36),
        time: "12:00",
        round: 99,
        t1: t1.id, t2: t1.id,
        court: "Ekstra", type: "Volleyball",
        s1: null, s2: null, done: false
    };
    data.matches.push(m);
    saveLocal();
    renderSchedule();
}

// --- STANDINGS ---
function calcStandings() {
    data.teams.forEach(t => {
        t.points = 0;
        t.stats = {p:0, w:0, d:0, l:0, gf:0, ga:0};
    });
    
    data.matches.forEach(m => {
        if(m.done) {
            const t1 = data.teams.find(t => t.id === m.t1);
            const t2 = data.teams.find(t => t.id === m.t2);
            if(t1 && t2) {
                t1.stats.p++; t2.stats.p++;
                t1.stats.gf += m.s1; t1.stats.ga += m.s2;
                t2.stats.gf += m.s2; t2.stats.ga += m.s1;
                
                if(m.s1 > m.s2) { t1.points += 3; t1.stats.w++; t2.stats.l++; }
                else if(m.s2 > m.s1) { t2.points += 3; t2.stats.w++; t1.stats.l++; }
                else { t1.points+=1; t2.points+=1; t1.stats.d++; t2.stats.d++; }
            }
        }
    });
    
    // Sort
    data.teams.sort((a,b) => {
        if(b.points !== a.points) return b.points - a.points;
        const diffA = a.stats.gf - a.stats.ga;
        const diffB = b.stats.gf - b.stats.ga;
        if(diffB !== diffA) return diffB - diffA;
        return b.stats.gf - a.stats.gf;
    });
    
    renderStandings();
}

function renderStandings() {
    const tb = document.getElementById('leaderboardBody');
    tb.innerHTML = '';
    data.teams.forEach((t, i) => {
        const diff = t.stats.gf - t.stats.ga;
        tb.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td>${t.name}</td>
                <td>${t.stats.p}</td>
                <td>${t.stats.w}</td>
                <td>${t.stats.d}</td>
                <td>${t.stats.l}</td>
                <td>${diff}</td>
                <td><strong>${t.points}</strong></td>
            </tr>
        `;
    });
    
    // Update Final Selectors
    updateFinalSelectors();
}

// --- FINALS ---
function updateFinalSelectors() {
    const s1 = document.getElementById('finalTeam1');
    const s2 = document.getElementById('finalTeam2');
    const opts = data.teams.map((t,i) => `<option value="${t.id}">${i+1}. ${t.name}</option>`).join('');
    // Be smart, don't overwrite if user selected something else, unless empty
    if(s1.innerHTML === '' || s1.innerHTML.includes('1. Plass')) {
        s1.innerHTML = opts;
        s2.innerHTML = opts;
        if(data.teams.length > 1) s2.value = data.teams[1].id;
    }
}

function addFinal() {
    const t1Id = parseInt(document.getElementById('finalTeam1').value);
    const t2Id = parseInt(document.getElementById('finalTeam2').value);
    const act = document.getElementById('finalActivity').value;
    
    const t1 = data.teams.find(t => t.id === t1Id);
    const t2 = data.teams.find(t => t.id === t2Id);
    
    data.finals.push({
        id: Math.random().toString(36),
        t1Name: t1 ? t1.name : "L1",
        t2Name: t2 ? t2.name : "L2",
        activity: act,
        s1: null, s2: null
    });
    saveLocal();
    renderFinals();
}

function renderFinals() {
    const c = document.getElementById('finalsContainer');
    c.innerHTML = '';
    data.finals.forEach((f, idx) => {
        const div = document.createElement('div');
        div.className = 'final-card';
        div.innerHTML = `
            <h4>${f.activity}</h4>
            <div style="font-size:1.5rem; margin:10px;">
                ${f.t1Name} vs ${f.t2Name}
            </div>
            <div class="score-input" style="justify-content:center;">
                <input type="number" placeholder="0"> - <input type="number" placeholder="0">
            </div>
            <button class="btn-small-red" style="margin-top:10px;" onclick="removeFinal(${idx})">Slett</button>
        `;
        c.appendChild(div);
    });
}

function removeFinal(idx) {
    data.finals.splice(idx, 1);
    saveLocal();
    renderFinals();
}

// --- SOUND & TIMER ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let timerInt = null;
let secondsLeft = 0;

function updateTimerDisplay(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2,'0');
    const s = (sec % 60).toString().padStart(2,'0');
    document.getElementById('timerDisplay').innerText = `${m}:${s}`;
}

function startTimer() {
    if(timerInt) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    
    // Check if new start
    const matchSec = data.settings.matchDuration * 60;
    if(secondsLeft === 0 || secondsLeft === matchSec) {
        secondsLeft = matchSec;
        playSiren(2.5); // Start Siren
    } else {
        playTone(600, 0.1, 'sine'); // Resume blip
    }

    timerInt = setInterval(() => {
        secondsLeft--;
        updateTimerDisplay(secondsLeft);
        
        // Next match info logic could go here
        
        // End signals
        if(secondsLeft <= 5 && secondsLeft > 0) playTone(800, 0.2, 'square');
        if(secondsLeft === 0) {
            pauseTimer();
            playSiren(4.0); // END SIREN
            secondsLeft = matchSec; // Ready for next
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInt);
    timerInt = null;
}

function resetTimer() {
    pauseTimer();
    secondsLeft = data.settings.matchDuration * 60;
    updateTimerDisplay(secondsLeft);
}

// LOUD HORN SYNTH
function testSound() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    playSiren(2.0);
}

function playTone(freq, dur, type) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    osc.connect(g); g.connect(audioCtx.destination);
    g.gain.value = 0.2; osc.start(); osc.stop(audioCtx.currentTime + dur);
}

function playSiren(dur) {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator(); // Detuned
    const g = audioCtx.createGain();
    
    osc1.type = 'sawtooth'; osc1.frequency.value = 150;
    osc2.type = 'sawtooth'; osc2.frequency.value = 155; // Dissonance
    
    osc1.connect(g); osc2.connect(g); g.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1.0, now + 0.2); // Attack
    g.gain.setValueAtTime(1.0, now + dur - 0.2);
    g.gain.linearRampToValueAtTime(0, now + dur); // Release
    
    osc1.start(now); osc2.start(now);
    osc1.stop(now + dur); osc2.stop(now + dur);
}
