// DATA STORAGE
let students = [];
let teams = [];
let matches = [];
let settings = {
    classes: ['10A', '10B', '10C', '10D'],
    startHour: 10,
    startMin: 15,
    matchDuration: 15,
    breakDuration: 3 // Tid mellom kamper til bytte
};

// --- INIT & TABS ---
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    // Highlight knapp logic her om ønskelig
}

// --- STUDENT MANAGEMENT ---
function addStudents() {
    const cls = document.getElementById('classSelect').value;
    const text = document.getElementById('pasteArea').value;
    if (!text.trim()) return;

    const names = text.split('\n').map(n => n.trim()).filter(n => n !== "");
    
    names.forEach(name => {
        students.push({
            id: Date.now() + Math.random(),
            name: name,
            class: cls,
            present: true
        });
    });

    document.getElementById('pasteArea').value = "";
    renderStudentList();
}

function renderStudentList() {
    const container = document.getElementById('studentList');
    container.innerHTML = '';
    
    // Sort by class then name
    students.sort((a,b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name));

    students.forEach(s => {
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
    if (s) {
        s.present = !s.present;
        renderStudentList();
    }
}

// --- TEAM GENERATION ---
function prepareTeams() {
    showTab('draw');
}

function generateTeamsLogic(teamCount) {
    // 1. Get present students
    let pool = students.filter(s => s.present);
    
    // 2. Group by class
    let byClass = {};
    settings.classes.forEach(c => byClass[c] = []);
    pool.forEach(s => {
        if (!byClass[s.class]) byClass[s.class] = [];
        byClass[s.class].push(s);
    });

    // Shuffle each class list
    for (let c in byClass) {
        byClass[c].sort(() => Math.random() - 0.5);
    }

    // 3. Distribute
    let newTeams = Array.from({length: teamCount}, (_, i) => ({
        id: i + 1,
        name: `Lag ${i + 1}`,
        members: [],
        points: 0,
        stats: { w:0, d:0, l:0, played: 0 }
    }));

    // Round robin distribution
    let teamIndex = 0;
    let keepGoing = true;

    while (keepGoing) {
        keepGoing = false;
        // Try to take one from each class in order
        for (let c of settings.classes) {
            if (byClass[c].length > 0) {
                let s = byClass[c].pop();
                newTeams[teamIndex].members.push(s);
                keepGoing = true;
                
                teamIndex++;
                if (teamIndex >= teamCount) teamIndex = 0;
            }
        }
    }
    return newTeams;
}

function generateTeamsQuick() {
    const count = parseInt(document.getElementById('teamCount').value);
    teams = generateTeamsLogic(count);
    renderTeams(false);
}

function generateTeamsAnimated() {
    const count = parseInt(document.getElementById('teamCount').value);
    teams = generateTeamsLogic(count);
    document.getElementById('drawDisplay').innerHTML = '';
    
    // Animation loop
    let i = 0;
    const interval = setInterval(() => {
        if (i >= teams.length) {
            clearInterval(interval);
            return;
        }
        renderSingleTeam(teams[i]);
        playSoundEffect('pop'); // Optional simple sound
        i++;
    }, 800); // Delay between teams appearing
}

function renderTeams(animated) {
    const container = document.getElementById('drawDisplay');
    container.innerHTML = '';
    teams.forEach(t => renderSingleTeam(t));
}

function renderSingleTeam(team) {
    const container = document.getElementById('drawDisplay');
    const div = document.createElement('div');
    div.className = 'team-card pop-in';
    
    let membersHtml = team.members.map(m => `<li>${m.name} <small>(${m.class})</small></li>`).join('');
    
    div.innerHTML = `
        <h3>${team.name}</h3>
        <ul>${membersHtml}</ul>
    `;
    container.appendChild(div);
}

// --- SCHEDULE GENERATOR ---
function generateSchedule() {
    if (teams.length === 0) {
        alert("Lag lagene først!");
        return;
    }

    // Hardcoded logic for optimal 12-team rotation (6 play, 6 wait)
    // Activities: VB1, VB2, SB
    // Pattern: 
    // Round 1: Group A plays, Group B rests
    // Round 2: Group B plays, Group A rests
    
    matches = [];
    let currentTime = new Date();
    currentTime.setHours(settings.startHour, settings.startMin, 0);

    // Split teams into two blocks (odd/even) or simple slice
    // Assuming 12 teams.
    const half = Math.ceil(teams.length / 2);
    const groupA = teams.slice(0, half); // Lag 1-6
    const groupB = teams.slice(half);    // Lag 7-12

    // Helper to generate round matches
    const createRound = (activeTeams, roundNum) => {
        // activeTeams is array of 6 teams
        // We need 3 matches: VB, VB, SB
        // Simple rotation within the group based on round number
        
        // Circular shift of array based on roundNum to vary opponents
        let t = [...activeTeams];
        for(let i=0; i<roundNum; i++) {
            t.push(t.shift());
        }

        // Pairings: (0vs1), (2vs3), (4vs5)
        // Assign types based on round to ensure rotation
        // Round 1: VB, VB, SB
        // Round 3: SB, VB, VB ...
        
        let types = ['Volleyball', 'Volleyball', 'Stikkball'];
        // Rotate types
        for(let i=0; i<roundNum; i++) types.unshift(types.pop());

        let roundMatches = [];
        
        // Match 1
        roundMatches.push({ t1: t[0], t2: t[1], type: types[0], court: 'Bane 1' });
        // Match 2
        roundMatches.push({ t1: t[2], t2: t[3], type: types[1], court: 'Bane 2' });
        // Match 3
        roundMatches.push({ t1: t[4], t2: t[5], type: types[2], court: 'Bane 3' });

        return roundMatches;
    };

    // Calculate how many slots we have until 14:00
    // 10:15 -> 14:00 = 225 mins.
    // Each slot = Match (15) + Break (3) = 18 mins.
    // 225 / 18 = ~12 slots.
    // This allows Group A to play 6 times and Group B to play 6 times. Perfect!
    
    const totalSlots = 12;

    for (let i = 1; i <= totalSlots; i++) {
        let activeGroup = (i % 2 !== 0) ? groupA : groupB;
        let roundMatches = createRound(activeGroup, Math.floor((i-1)/2)); // Increment rotation every time group plays
        
        let timeString = currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        roundMatches.forEach(m => {
            matches.push({
                id: matches.length,
                time: timeString,
                round: i,
                teamA: m.t1,
                teamB: m.t2,
                type: m.type,
                court: m.court,
                scoreA: null,
                scoreB: null,
                completed: false
            });
        });

        // Add time
        currentTime.setMinutes(currentTime.getMinutes() + settings.matchDuration + settings.breakDuration);
    }

    renderSchedule();
}

function renderSchedule() {
    const container = document.getElementById('scheduleContainer');
    container.innerHTML = '';

    // Group by round/time
    let currentRound = 0;
    let roundDiv = null;

    matches.forEach(m => {
        if (m.round !== currentRound) {
            currentRound = m.round;
            roundDiv = document.createElement('div');
            roundDiv.className = 'round-block';
            roundDiv.innerHTML = `<h4>Runde ${m.round} - Kl ${m.time}</h4>`;
            container.appendChild(roundDiv);
        }

        let typeClass = m.type === 'Volleyball' ? 'type-vb' : 'type-sb';
        let icon = m.type === 'Volleyball' ? '🏐' : '🤾';

        const row = document.createElement('div');
        row.className = 'match-row';
        row.innerHTML = `
            <div class="match-info">
                <span class="type-badge ${typeClass}">${icon} ${m.type}</span>
                ${m.teamA.name} vs ${m.teamB.name}
                <small style="color:#666; margin-left:10px;">(${m.court})</small>
            </div>
            <div class="match-score">
                <input type="number" id="sA_${m.id}" value="${m.scoreA !== null ? m.scoreA : ''}" onchange="updateScore(${m.id})">
                <span>-</span>
                <input type="number" id="sB_${m.id}" value="${m.scoreB !== null ? m.scoreB : ''}" onchange="updateScore(${m.id})">
            </div>
        `;
        roundDiv.appendChild(row);
    });
}

// --- SCORING & LEADERBOARD ---
function updateScore(matchId) {
    const sA = document.getElementById(`sA_${matchId}`).value;
    const sB = document.getElementById(`sB_${matchId}`).value;

    const match = matches.find(m => m.id === matchId);
    if (sA !== '' && sB !== '') {
        match.scoreA = parseInt(sA);
        match.scoreB = parseInt(sB);
        match.completed = true;
    } else {
        match.scoreA = null;
        match.scoreB = null;
        match.completed = false;
    }

    recalcLeaderboard();
}

function recalcLeaderboard() {
    // Reset stats
    teams.forEach(t => {
        t.points = 0;
        t.stats = { w:0, d:0, l:0, played:0 };
    });

    matches.forEach(m => {
        if (m.completed) {
            // Update played count
            m.teamA.stats.played++;
            m.teamB.stats.played++;

            if (m.scoreA > m.scoreB) {
                m.teamA.points += 3;
                m.teamA.stats.w++;
                m.teamB.stats.l++;
            } else if (m.scoreB > m.scoreA) {
                m.teamB.points += 3;
                m.teamB.stats.w++;
                m.teamA.stats.l++;
            } else {
                m.teamA.points += 1;
                m.teamB.points += 1;
                m.teamA.stats.d++;
                m.teamB.stats.d++;
            }
        }
    });

    // Sort: Points -> Wins -> Random(or name)
    teams.sort((a,b) => b.points - a.points || b.stats.w - a.stats.w);

    renderLeaderboard();
}

function renderLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '';

    teams.forEach((t, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${t.name}</strong></td>
            <td>${t.stats.played}</td>
            <td>${t.stats.w}</td>
            <td>${t.stats.d}</td>
            <td>${t.stats.l}</td>
            <td><strong>${t.points}</strong></td>
        `;
        tbody.appendChild(tr);
    });
}

// --- TIMER ---
let timerInterval;
let secondsLeft = 15 * 60;
let isRunning = false;

function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateTimerDisplay() {
    document.getElementById('timerDisplay').innerText = formatTime(secondsLeft);
}

function startTimer() {
    if (isRunning) return;
    const durationInput = parseInt(document.getElementById('matchDuration').value);
    // If starting fresh or reset, set seconds
    if (secondsLeft === 0) secondsLeft = durationInput * 60;
    
    isRunning = true;
    playSoundEffect('whistle_start'); // Lyd ved start

    timerInterval = setInterval(() => {
        secondsLeft--;
        updateTimerDisplay();
        if (secondsLeft <= 0) {
            pauseTimer();
            playSoundEffect('whistle_end'); // Lyd ved slutt
            secondsLeft = 0;
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    isRunning = false;
}

function resetTimer() {
    pauseTimer();
    const durationInput = parseInt(document.getElementById('matchDuration').value);
    secondsLeft = durationInput * 60;
    updateTimerDisplay();
}

// --- FINALS ---
function generateFinals() {
    // Top 4 teams
    if (teams.length < 4) return;
    const gold1 = teams[0];
    const gold2 = teams[1];
    const bronze1 = teams[2];
    const bronze2 = teams[3];

    const container = document.getElementById('finalsContainer');
    container.innerHTML = `
        <div class="final-card bronze">
            <h3>🥉 Bronsefinale</h3>
            <p>${bronze1.name} vs ${bronze2.name}</p>
            <div class="final-inputs">
                <input type="number" placeholder="0"> - <input type="number" placeholder="0">
            </div>
            <p>Stikkball / Volleyball (Valgfritt)</p>
        </div>
        <div class="final-card gold">
            <h3>🏆 Gullfinale</h3>
            <p>${gold1.name} vs ${gold2.name}</p>
             <div class="final-inputs">
                <input type="number" placeholder="0"> - <input type="number" placeholder="0">
            </div>
            <p>Volleyball - Center Court</p>
        </div>
    `;
}

// --- AUDIO HELPER ---
// Uses Web Audio API to create simple beep/whistle without external files
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound() {
    playSoundEffect('whistle_end');
}

function playSoundEffect(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'whistle_start') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } 
    else if (type === 'whistle_end') {
        // Longer multiple beeps
        osc.type = 'square';
        osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.2);
        osc.frequency.setValueAtTime(0, audioCtx.currentTime + 0.21); // Silence
        
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 1.5);
        
        // This simple synth is basic. For better results, replace with new Audio('file.mp3').play();
    }
    else if (type === 'pop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }
}
