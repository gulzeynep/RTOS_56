// ============================================
// 1. GLOBAL STATE
// ============================================
let Queue_Radar = [];
const QUEUE_MAX = 10;
let droppedMessages = 0;
let systemHistory = [];
let currentTime = 0;

let Mutex_Brake = { isLocked: false, owner: null, waitingQueue: [] };

let taskCompute = { name: "Task_Compute", priority: 1, state: "Blocked_Queue", ticksRemaining: 0 };
let taskNetwork = { name: "Task_Network", priority: 1.5, state: "Ready", ticksRemaining: 0 };
let taskLog = { name: "Task_Log", priority: 2, state: "Ready", ticksRemaining: 0 };

// ============================================
// 2. CORE LOGIC
// ============================================
function scheduler(isCase6) {
    let tasks = [taskCompute, taskLog];
    if (isCase6) {
        taskNetwork.priority = parseFloat(document.getElementById('netPriority').value);
        tasks.push(taskNetwork);
    }
    tasks.sort((a, b) => a.priority - b.priority);
    for (let t of tasks) {
        if (t.state === "Ready" || t.state === "Running") return t;
    }
    return null;
}

function executeTick(task) {
    if (!task) return "Idle";
    task.state = "Running";

    if (task.ticksRemaining <= 0) {
        if (task.name === "Task_Compute") {
            task.ticksRemaining = parseInt(document.getElementById('computeTime').value) / 20;
            if (Queue_Radar.length > 0) Queue_Radar.shift();
        } else if (task.name === "Task_Network") {
            task.ticksRemaining = 1; // 20ms network processing
        } else if (task.name === "Task_Log") {
            task.ticksRemaining = parseInt(document.getElementById('logTime').value) / 20;
        }
    }

    // Mutex Protection (Sadece Compute ve Log için)
    if (task.name === "Task_Compute" || task.name === "Task_Log") {
        if (!Mutex_Brake.isLocked) {
            Mutex_Brake.isLocked = true;
            Mutex_Brake.owner = task.name;
        } else if (Mutex_Brake.owner !== task.name) {
            task.state = "Blocked_Mutex";
            if (!Mutex_Brake.waitingQueue.includes(task)) Mutex_Brake.waitingQueue.push(task);
            return "Blocked_Mutex";
        }
    }

    task.ticksRemaining--;

    if (task.ticksRemaining <= 0) {
        if (Mutex_Brake.owner === task.name) {
            Mutex_Brake.isLocked = false;
            Mutex_Brake.owner = null;
            if (Mutex_Brake.waitingQueue.length > 0) Mutex_Brake.waitingQueue.shift().state = "Ready";
        }
        
        if (task.name === "Task_Compute") task.state = (Queue_Radar.length > 0) ? "Ready" : "Blocked_Queue";
        else task.state = "Ready";
    }
    return task.name;
}

// ============================================
// 3. SIMULATION RUNNER
// ============================================
function runBatchSimulation() {
    currentTime = 0; systemHistory = []; Queue_Radar = []; droppedMessages = 0;
    Mutex_Brake = { isLocked: false, owner: null, waitingQueue: [] };
    taskCompute.state = "Blocked_Queue"; taskCompute.ticksRemaining = 0;
    taskLog.state = "Ready"; taskLog.ticksRemaining = 0;
    document.getElementById('eventLog').innerHTML = "";

    const isCase6 = document.getElementById('enableCase6').checked;
    const prob = parseInt(document.getElementById('obstacleProb').value);

    for (let t = 0; t <= 500; t += 20) {
        currentTime = t;
        let isrTriggered = false;

        // ISR_Radar firing every 20ms
        if (Math.random() * 100 < prob) {
            isrTriggered = true;
            if (Queue_Radar.length < QUEUE_MAX) {
                Queue_Radar.push("DATA");
                if (taskCompute.state === "Blocked_Queue") taskCompute.state = "Ready";
                logEvent("ISR: Obstacle Detected", "event-isr");
            } else {
                droppedMessages++;
            }
        }

        let selected = scheduler(isCase6);
        let runningName = executeTick(selected);

        systemHistory.push({ time: t, isr: isrTriggered, task: runningName, case6: isCase6 });
    }
    updateUI();
    drawGanttChart();
}

function logEvent(msg, cls) {
    const log = document.getElementById('eventLog');
    const d = document.createElement('div');
    d.className = cls; d.textContent = `[${currentTime}ms] ${msg}`;
    log.prepend(d);
}

function updateUI() {
    document.getElementById('qVal').textContent = `${Queue_Radar.length} / ${QUEUE_MAX}`;
    document.getElementById('dropVal').textContent = droppedMessages;
    document.getElementById('mState').textContent = Mutex_Brake.isLocked ? "Locked" : "Unlocked";
    document.getElementById('mOwner').textContent = Mutex_Brake.owner || "None";
}

// ============================================
// 4. GRAPHICS (Idle kısımları boş bırakıldı)
// ============================================
function drawGanttChart() {
    const canvas = document.getElementById('ganttChart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const margin = { top: 40, left: 160, bottom: 60, right: 40 };
    const chartW = canvas.width - margin.left - margin.right;
    const tickW = chartW / 25; 
    const rowH = 28;

    const isCase6 = document.getElementById('enableCase6').checked;
    const rows = ["ISR_Radar (IRQ)", "Task_Compute (H)", "Task_Log (L)"];
    if (isCase6) rows.splice(2, 0, "Task_Network (IO)");
    rows.push("CPU Execution");

    ctx.fillStyle = "#2c3e50";
    ctx.font = "bold 11px Arial";
    rows.forEach((l, i) => ctx.fillText(l, 10, margin.top + 22 + (i * 60)));

    systemHistory.forEach((snap, i) => {
        const x = margin.left + (i * tickW);

        // ISR Row
        ctx.fillStyle = snap.isr ? "#e74c3c" : "#fdf2f2";
        ctx.fillRect(x, margin.top, tickW - 2, rowH);

        // Task Rows & CPU Timeline
        const drawTask = (taskName, color, rowIdx) => {
            if (snap.task === taskName) {
                ctx.fillStyle = color;
                ctx.fillRect(x, margin.top + (rowIdx * 60), tickW - 2, rowH);
                ctx.fillRect(x, margin.top + (rows.length - 1) * 60, tickW - 2, rowH); // CPU Row
            }
        };

        drawTask("Task_Compute", "#3498db", 1);
        if (isCase6) {
            drawTask("Task_Network", "#f1c40f", 2);
            drawTask("Task_Log", "#2ecc71", 3);
        } else {
            drawTask("Task_Log", "#2ecc71", 2);
        }

        if (snap.time % 100 === 0) {
            ctx.fillStyle = "#7f8c8d";
            ctx.fillText(snap.time + "ms", x, canvas.height - 35);
        }
    });
    
    // Frame
    ctx.strokeStyle = "#34495e";
    ctx.strokeRect(margin.left, margin.top - 10, chartW, rows.length * 60 - 30);
}