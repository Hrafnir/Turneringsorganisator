// --- STATE MANAGEMENT ---
let students = [];
let teams = [];
let matches = [];
let teamsLocked = false;
let settings = {
    classes: ['10A', '10B', '10C', '10D'],
    matchDuration: 15,
    breakDuration: 20 // 20 min pause
};

// AUTO-LOAD ON START
window.onload = function() {
    loadData();
    renderStudentList();
    if(teams.length > 0) renderTeams();
    if(matches.length > 0) renderSchedule();
    recalcLeaderboard();
    
    // Sett riktig tid på klokka hvis ikke kjører
    document.getElementById('timerDisplay').innerText = formatTime(settings.matchDuration * 60);
};

// --- PERSISTENCE ---
function saveData() {
    const data = { students, teams, matches, teamsLocked, settings };
    localStorage.setItem('turneringData_v2', JSON.stringify(data));
    
    const status = document.getElementById('saveStatus');
    status.style.opacity = '1';
    setTimeout(() => status.style.opacity = '0.7', 1000);
}

function loadData() {
    const json = localStorage.getItem('turneringData_v2');
    if (json) {
        const data = JSON.parse(json);
        students = data.students || [];
        teams = data.teams || [];
        matches = data.matches || [];
        teamsLocked = data.teamsLocked || false;
        settings = data.settings || settings;
        
        document.getElementById('matchDuration').value = settings.matchDuration;
        document.getElementById('breakDuration').value = settings.breakDuration;
        
        // Oppdater lås-knapp
        updateLockButton();
    }
}

function hardReset() {
    localStorage.removeItem('turneringData_v2');
    location.reload(); 
}

function closeOverlay() {
    document.getElementById('resetOverlay').classList.add('hidden');
}

// --- TABS ---
function showTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Highlight knapp logic kan legges her
}

// --- STUDENT LOGIC ---
function addStudents() {
    const cls = document.getElementById('classSelect').value;
    const text = document.getElementById('pasteArea').value;
    if (!text.trim()) return;

    text.split('\n').map(n => n.trim()).filter(n => n).forEach(name => {
        students.push({ id: generateId(), name, class: cls, present: true });
    });

    document.getElementById('pasteArea').value = "";
    saveData();
    renderStudentList();
}

function renderStudentList() {
    const filter = document.getElementById('searchStudent').value.toLowerCase();
    const container = document.getElementById('studentList');
    container.innerHTML = '';

    students
        .filter(s => s.name.toLowerCase().includes(filter))
        .sort((a,b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name))
        .forEach(s => {
            const div = document.createElement('div');
            div.className = `student-item ${s.present ? '' : 'absent'}`;
            div.innerHTML = `
                <span><b>${s.class}</b> ${s.name}</span>
                <input type="checkbox" ${s.present ? 'checked' : ''} onchange="togglePresence('${s.id}')">
            `;
            container.appendChild(div);
        });
}

function togglePresence(id) {
    const s = students.find(x => x.id == id);
    if(s) { s.present = !s.present; saveData(); renderStudentList(); }
}

// --- TEAMS LOGIC ---
function generateTeamsAnimated() {
    if(teamsLocked) { alert("Lagene er låst!"); return; }
    
    const count = parseInt(document.getElementById('teamCount').value);
    // Basic distribution logic
    let pool = students.filter(s => s.present);
    // Shuffle pool
    pool.sort(() => Math.random() - 0.5);

    // Init teams
    teams = Array.from({length: count}, (_, i) => ({
        id: i+1,
        name: `Lag ${i+1}`,
        members: [],
        points: 0,
        stats: { w:0, d:0, l:0, played:0, gf:0, ga:0, diff:0 }
    }));

    // Distribute equally from classes (simplified robust version)
    // First, group by class
    let byClass = {};
    settings.classes.forEach(c => byClass[c] = []);
    pool.forEach(s => {
        if(!byClass[s.class]) byClass[s.class] = [];
        byClass[s.class].push(s);
    });

    let currentTeam = 0;
    while(pool.length > 0) {
        // Try to pick from a class that has students left
        for(let c of settings.classes) {
            if(byClass[c].length > 0) {
                teams[currentTeam].members.push(byClass[c].pop());
                // Remove from pool ref for loop safety (not strictly needed but good)
                pool.pop(); 
                currentTeam = (currentTeam + 1) % count;
            }
        }
        // If some classes are empty but pool still has weird leftovers (rare)
        if(pool.length > 0 && Object.values(byClass).every(arr => arr.length === 0)) {
             // Fallback
             teams[currentTeam].members.push(pool.pop());
             currentTeam = (currentTeam + 1) % count;
        }
    }

    saveData();
    renderTeams();
}

// DRAG AND DROP LOGIC FOR TEAMS
let draggedStudent = null;
let sourceTeamId = null;

function renderTeams() {
    const container = document.getElementById('drawDisplay');
    container.innerHTML = '';
    
    teams.forEach(team => {
        const div = document.createElement('div');
        div.className = 'team-card';
        // Drop zone functionality
        div.ondragover = (e) => e.preventDefault(); // Allow drop
        div.ondrop = (e) => handleDrop(e, team.id);

        let membersHtml = team.members.map(m => `
            <div class="team-member" draggable="${!teamsLocked}" 
                 ondragstart="handleDragStart(event, '${m.id}', ${team.id})">
                ${m.name} <small>(${m.class})</small>
            </div>
        `).join('');

        div.innerHTML = `<h3>${team.name}</h3><div>${membersHtml}</div>`;
        container.appendChild(div);
    });
}

function handleDragStart(e, studentId, teamId) {
    if(teamsLocked) return;
    draggedStudent = studentId;
    sourceTeamId = teamId;
    e.target.classList.add('dragging');
}

function handleDrop(e, targetTeamId) {
    e.preventDefault();
    if(teamsLocked || !draggedStudent || sourceTeamId === targetTeamId) return;

    // Move student logic
    const sourceTeam = teams.find(t => t.id === sourceTeamId);
    const targetTeam = teams.find(t => t.id === targetTeamId);
    
    const sIndex = sourceTeam.members.findIndex(m => m.id == draggedStudent);
    if(sIndex > -1) {
        const s = sourceTeam.members.splice(sIndex, 1)[0];
        targetTeam.members.push(s);
        saveData();
        renderTeams();
    }
    draggedStudent = null;
}

function toggleLockTeams() {
    teamsLocked = !teamsLocked;
    saveData();
    updateLockButton();
    renderTeams(); // Re-render to disable drag
}

function updateLockButton() {
    const btn = document.getElementById('lockBtn');
    if(teamsLocked) {
        btn.innerHTML = '<i class="fas fa-lock"></i> Lagene er LÅST (Klikk for å åpne)';
        btn.classList.replace('btn-yellow', 'btn-red');
    } else {
        btn.innerHTML = '<i class="fas fa-unlock"></i> Lag er åpne (Klikk for å låse)';
        btn.classList.replace('btn-red', 'btn-yellow');
    }
}

// --- SCHEDULE LOGIC ---
function generateSchedule() {
    if(!teamsLocked) {
        if(!confirm("Lagene er ikke låst. Vil du låse dem og generere oppsett?")) return;
        toggleLockTeams();
    }
    
    matches = [];
    const breakMins = parseInt(document.getElementById('breakDuration').value);
    settings.breakDuration = breakMins;
    const startTimeStr = document.getElementById('startTimeInput').value;
    
    let currentTime = new Date();
    const [h, m] = startTimeStr.split(':');
    currentTime.setHours(parseInt(h), parseInt(m), 0);

    const half = Math.ceil(teams.length / 2);
    const groupA = teams.slice(0, half);
    const groupB = teams.slice(half);

    // Helper: Add Round
    const addRound = (activeTeams, roundNum, isMix) => {
        let pairings = [];
        
        if(!isMix) {
            // Internal group rotation
            let t = [...activeTeams];
            for(let i=0; i<roundNum; i++) t.push(t.shift()); // Rotate
            pairings.push([t[0], t[1], 'Volleyball', 'Bane 1']);
            pairings.push([t[2], t[3], 'Volleyball', 'Bane 2']);
            pairings.push([t[4], t[5], 'Stikkball', 'Bane 3']);
        } else {
            // Mix Group A vs Group B
            // Lag 1 (A) vs Lag 7 (B), etc. Rotate B.
            let b = [...groupB];
            for(let i=0; i<roundNum; i++) b.push(b.shift());
            
            pairings.push([groupA[0], b[0], 'Volleyball', 'Bane 1']);
            pairings.push([groupA[1], b[1], 'Volleyball', 'Bane 2']);
            pairings.push([groupA[2], b[2], 'Stikkball', 'Bane 3']);
            // Note: In a 12 team setup, this leaves some teams out in a mix round unless we use 6 courts. 
            // Assuming 3 courts active at a time based on request (2 VB, 1 SB).
            // Logic implies 6 teams play, 6 wait.
        }

        const timeStr = currentTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        
        pairings.forEach(p => {
            matches.push({
                id: generateId(),
                time: timeStr,
                round: matches.length > 0 ? matches[matches.length-1].round + (pairings.indexOf(p)===0?1:0) : 1, // Crude round counter
                t1: p[0].id, t2: p[1].id,
                t1Name: p[0].name, t2Name: p[1].name,
                type: p[2], court: p[3],
                s1: null, s2: null, done: false
            });
        });

        // Add Time
        currentTime.setMinutes(currentTime.getMinutes() + settings.matchDuration + settings.breakDuration);
    };

    // GENERATE ROUNDS
    // 1-3: Group A plays
    for(let i=0; i<3; i++) addRound(groupA, i, false);
    
    // 4-6: Group B plays
    for(let i=0; i<3; i++) addRound(groupB, i, false);

    // LONG BREAK Logic (Simulated by just adding time before next loop)
    currentTime.setMinutes(currentTime.getMinutes() + 10); // Extra 10 min

    // 7-9: MIX Rounds (A plays B)
    // To ensure 6 plays, 6 wait: We pick 3 from A and 3 from B? 
    // Or simplified: Just rotate rounds where A plays B.
    // Let's generate 3 rounds where A play B.
    for(let i=0; i<3; i++) addRound(null, i, true);

    saveData();
    renderSchedule();
    showTab('matches');
}

function renderSchedule() {
    const container = document.getElementById('scheduleContainer');
    container.innerHTML = '';
    
    // Sort matches by time
    matches.sort((a,b) => a.time.localeCompare(b.time));

    let lastTime = '';

    matches.forEach((m, index) => {
        if(m.time !== lastTime) {
            lastTime = m.time;
            const header = document.createElement('div');
            header.className = 'round-header';
            header.innerHTML = `<span>Kl ${m.time}</span> <span style="font-size:0.8rem">Runde-start</span>`;
            container.appendChild(header);
        }

        const div = document.createElement('div');
        div.className = 'match-row';
        div.innerHTML = `
            <div class="match-time">
                <input type="time" value="${m.time}" onchange="updateMatchTime('${m.id}', this.value)">
            </div>
            <div class="match-teams">
                <span style="font-weight:bold">${m.t1Name}</span> vs <span style="font-weight:bold">${m.t2Name}</span>
                <span class="court-badge">${m.court}</span>
                <span class="court-badge" style="background:${m.type=='Volleyball'?'#2980b9':'#e67e22'}">${m.type}</span>
            </div>
            <div class="match-score">
                <input type="number" value="${m.s1!==null?m.s1:''}" onchange="updateScore('${m.id}', 's1', this.value)">
                -
                <input type="number" value="${m.s2!==null?m.s2:''}" onchange="updateScore('${m.id}', 's2', this.value)">
                <button class="btn-red" onclick="deleteMatch('${m.id}')" style="margin-left:10px;"><i class="fas fa-times"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
}

function addManualMatch() {
    const t1 = teams[0] ? teams[0] : {id:0, name:'?'};
    matches.push({
        id: generateId(),
        time: "12:00",
        t1: t1.id, t2: t1.id,
        t1Name: "Lag A", t2Name: "Lag B",
        type: "Volleyball", court: "Manuell",
        s1: null, s2: null, done: false
    });
    saveData();
    renderSchedule();
}

function deleteMatch(id) {
    if(confirm("Slette kamp?")) {
        matches = matches.filter(m => m.id !== id);
        saveData();
        renderSchedule();
    }
}

function updateMatchTime(id, val) {
    const m = matches.find(x => x.id == id);
    if(m) { m.time = val; saveData(); } // Note: This doesn't re-sort immediately to avoid jumping UI
}

function updateScore(id, field, val) {
    const m = matches.find(x => x.id == id);
    if(m) {
        m[field] = val === '' ? null : parseInt(val);
        m.done = (m.s1 !== null && m.s2 !== null);
        saveData();
        recalcLeaderboard();
    }
}

// --- LEADERBOARD ---
function recalcLeaderboard() {
    teams.forEach(t => {
        t.points = 0;
        t.stats = { w:0, d:0, l:0, played:0, gf:0, ga:0, diff:0 };
    });

    matches.forEach(m => {
        if(m.done) {
            const t1 = teams.find(t => t.id == m.t1);
            const t2 = teams.find(t => t.id == m.t2);
            if(t1 && t2) {
                t1.stats.played++; t2.stats.played++;
                t1.stats.gf += m.s1; t1.stats.ga += m.s2;
                t2.stats.gf += m.s2; t2.stats.ga += m.s1;
                
                if(m.s1 > m.s2) {
                    t1.points += 3; t1.stats.w++; t2.stats.l++;
                } else if(m.s2 > m.s1) {
                    t2.points += 3; t2.stats.w++; t1.stats.l++;
                } else {
                    t1.points+=1; t2.points+=1; t1.stats.d++; t2.stats.d++;
                }
            }
        }
    });

    // Calc Diff & Sort
    teams.forEach(t => t.stats.diff = t.stats.gf - t.stats.ga);
    
    // Sort: Points -> GoalDiff -> GoalsFor
    teams.sort((a,b) => {
        if(b.points !== a.points) return b.points - a.points;
        if(b.stats.diff !== a.stats.diff) return b.stats.diff - a.stats.diff;
        return b.stats.gf - a.stats.gf;
    });

    renderLeaderboard();
}

function renderLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '';
    teams.forEach((t, i) => {
        tbody.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td style="text-align:left; font-weight:bold;">${t.name}</td>
                <td>${t.stats.played}</td>
                <td>${t.stats.w}</td>
                <td>${t.stats.d}</td>
                <td>${t.stats.l}</td>
                <td>${t.stats.diff > 0 ? '+'+t.stats.diff : t.stats.diff}</td>
                <td><strong>${t.points}</strong></td>
            </tr>
        `;
    });
}

function generateFinals() {
    if(teams.length < 4) return;
    const box = document.getElementById('finalsContainer');
    box.innerHTML = `
        <div class="final-card">
            <h3>🥉 Bronsefinale</h3>
            <div style="font-size:1.5rem; margin:10px;">${teams[2].name} vs ${teams[3].name}</div>
        </div>
        <div class="final-card gold">
            <h3>🏆 Gullfinale</h3>
            <div style="font-size:1.5rem; margin:10px;">${teams[0].name} vs ${teams[1].name}</div>
        </div>
    `;
}

// --- MASSIVE AUDIO & TIMER ---
let timerInt = null;
let timeLeft = 0;
let isRunning = false;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2,'0');
    const s = (sec % 60).toString().padStart(2,'0');
    return `${m}:${s}`;
}

function startTimer() {
    if(isRunning) return;
    if(timeLeft === 0) resetTimer();
    
    // Resume context if needed
    if(audioCtx.state === 'suspended') audioCtx.resume();
    
    // START SIGNAL: LOUD HORN
    if(timeLeft === parseInt(document.getElementById('matchDuration').value)*60) {
        playHorn(2.0); // 2 sec horn
    } else {
        // Just a short blip if resuming
        playTone(600, 0.1, 'sine');
    }

    isRunning = true;
    timerInt = setInterval(() => {
        timeLeft--;
        document.getElementById('timerDisplay').innerText = formatTime(timeLeft);
        
        // END SEQUENCE
        if(timeLeft === 3) playTone(880, 0.2, 'square');
        if(timeLeft === 2) playTone(880, 0.2, 'square');
        if(timeLeft === 1) playTone(880, 0.2, 'square');
        
        if(timeLeft <= 0) {
            pauseTimer();
            document.getElementById('timerDisplay').innerText = "00:00";
            // MASSIVE END SIGNAL
            playHorn(4.0); // 4 sec horn
            timeLeft = 0;
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInt);
    isRunning = false;
}

function resetTimer() {
    pauseTimer();
    const dur = parseInt(document.getElementById('matchDuration').value);
    timeLeft = dur * 60;
    document.getElementById('timerDisplay').innerText = formatTime(timeLeft);
}

// AUDIO SYNTHESIS
function testSound() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    playHorn(2.0);
}

function playTone(freq, duration, type) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime); // volum safe
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playHorn(duration) {
    // Creates a dissonant "Air Raid" / Hockey Horn sound
    const fund = 150; // Fundamental frequency (low)
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';

    osc1.frequency.value = fund;
    osc2.frequency.value = fund * 1.02; // Slightly detuned for roughness

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    // High volume ramp
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.8, now + 0.1); // Attack
    gain.gain.setValueAtTime(0.8, now + duration - 0.1);
    gain.gain.linearRampToValueAtTime(0, now + duration); // Release

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
}

// Utils
function generateId() { return '_' + Math.random().toString(36).substr(2, 9); }
