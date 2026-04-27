// ============================================
// 1. GLOBAL STATE & RTOS STRUCTURES
// ============================================
let Queue_Radar = [];
const QUEUE_MAX_SIZE = 10;
let droppedMessages = 0;
let systemHistory = [];
let currentTime = 0;

let Mutex_Brake = {
    isLocked: false,
    owner: null,
    waitingQueue: [],
    lockCount: 0
};

let taskCompute = {
    name: "Task_Compute",
    priority: 1, // High Priority
    state: "Blocked_Queue",
    ticksRemaining: 0,
    color: "#3498db"
};

let taskLog = {
    name: "Task_Log",
    priority: 2, // Low Priority
    state: "Ready",
    ticksRemaining: 0,
    color: "#2ecc71"
};

// ============================================
// 2. SCHEDULER & EXECUTION (Preemptive)
// ============================================
function scheduler() {
    let tasks = [taskCompute, taskLog];
    tasks.sort((a, b) => a.priority - b.priority); // Lower number = Higher Prio
    
    for (let task of tasks) {
        if (task.state === "Ready" || task.state === "Running") {
            return task;
        }
    }
    return null;
}

function executeTick(task) {
    if (!task) return "Idle";
    
    task.state = "Running";
    
    // Initialize countdown based on user input
    if (task.ticksRemaining <= 0) {
        const inputId = task.name === "Task_Compute" ? "computeTime" : "logTime";
        const totalMs = parseInt(document.getElementById(inputId).value);
        task.ticksRemaining = totalMs / 20;
        
        // Task_Compute consumes data from queue
        if (task.name === "Task_Compute" && Queue_Radar.length > 0) {
            Queue_Radar.shift(); 
            logEvent("Task_Compute: Applying Brakes (Processing Queue)", "event-compute");
        }
    }

    // Mutex Protection for Brake System
    if (!Mutex_Brake.isLocked) {
        Mutex_Brake.isLocked = true;
        Mutex_Brake.owner = task.name;
        Mutex_Brake.lockCount++;
    } else if (Mutex_Brake.owner !== task.name) {
        // Resource Conflict: Task is blocked
        task.state = "Blocked_Mutex";
        if (!Mutex_Brake.waitingQueue.includes(task)) {
            Mutex_Brake.waitingQueue.push(task);
        }
        return "Blocked_Mutex";
    }

    task.ticksRemaining--;

    // Completion Logic
    if (task.ticksRemaining <= 0) {
        Mutex_Brake.isLocked = false;
        Mutex_Brake.owner = null;
        
        if (task.name === "Task_Compute") {
            task.state = (Queue_Radar.length > 0) ? "Ready" : "Blocked_Queue";
        } else {
            task.state = "Ready"; // Periodic task resets
        }

        if (Mutex_Brake.waitingQueue.length > 0) {
            let next = Mutex_Brake.waitingQueue.shift();
            next.state = "Ready";
        }
    }
    return task.name;
}

// ============================================
// 3. BATCH SIMULATION ENGINE (Re-Roll)
// ============================================
function runBatchSimulation() {
    // Reset Data
    currentTime = 0;
    systemHistory = [];
    Queue_Radar = [];
    droppedMessages = 0;
    Mutex_Brake = { isLocked: false, owner: null, waitingQueue: [], lockCount: 0 };
    taskCompute.state = "Blocked_Queue";
    taskCompute.ticksRemaining = 0;
    taskLog.state = "Ready";
    taskLog.ticksRemaining = 0;
    document.getElementById('eventLog').innerHTML = "";

    const prob = parseInt(document.getElementById('obstacleProb').value);

    // Run 500ms Window in 20ms steps
    for (let t = 0; t <= 500; t += 20) {
        currentTime = t;
        
        // 1. ISR_Radar: Fires EVERY 20ms (OS Tick)
        // But only detects an obstacle based on probability
        let obstacleFound = Math.random() * 100 < prob;
        if (obstacleFound) {
            if (Queue_Radar.length < QUEUE_MAX_SIZE) {
                Queue_Radar.push({time: t});
                if (taskCompute.state === "Blocked_Queue") taskCompute.state = "Ready";
                logEvent("ISR: Obstacle Detected", "event-isr");
            } else {
                droppedMessages++;
                logEvent("ISR: Queue Full! Message Dropped", "event-warning");
            }
        }

        // 2. Scheduler & Execution
        let selected = scheduler();
        let runningName = executeTick(selected);

        systemHistory.push({
            time: t,
            isr: true, // Always true because OS Tick fires every 20ms
            obstacle: obstacleFound,
            task: runningName,
            qSize: Queue_Radar.length,
            mLocked: Mutex_Brake.isLocked
        });
    }

    updateUI();
    drawGanttChart();
}

function logEvent(msg, className) {
    const log = document.getElementById('eventLog');
    const div = document.createElement('div');
    div.className = className;
    div.textContent = `[${currentTime}ms] ${msg}`;
    log.prepend(div);
}

// ============================================
// 4. UI & VISUALIZATION (Schedulina Style)
// ============================================
function updateUI() {
    document.getElementById('qVal').textContent = `${Queue_Radar.length} / ${QUEUE_MAX_SIZE}`;
    document.getElementById('dropVal').textContent = droppedMessages;
    document.getElementById('mState').textContent = Mutex_Brake.isLocked ? "Locked 🔒" : "Unlocked 🔓";
    document.getElementById('mOwner').textContent = Mutex_Brake.owner || "None";
    document.getElementById('mCount').textContent = Mutex_Brake.lockCount;
}

function drawGanttChart() {
    const canvas = document.getElementById('ganttChart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const margin = { top: 40, left: 150, bottom: 60, right: 40 };
    const chartW = canvas.width - margin.left - margin.right;
    const tickW = chartW / 25; 
    const rowH = 30;

    // Labels (Y-Axis)
    ctx.fillStyle = "#2c3e50";
    ctx.font = "bold 12px Arial";
    const rows = ["OS Tick (ISR)", "Task_Compute (H)", "Task_Log (L)", "CPU (Idle Check)"];
    rows.forEach((label, i) => ctx.fillText(label, 10, margin.top + 25 + (i * 50)));

    systemHistory.forEach((snap, i) => {
        const x = margin.left + (i * tickW);

        // Row 1: OS Tick / ISR (Red for detection, Light Red for Tick)
        ctx.fillStyle = snap.obstacle ? "#e74c3c" : "#fadbd8";
        ctx.fillRect(x, margin.top + 5, tickW - 2, rowH);

        // Row 2: Compute Task (Blue)
        if (snap.task === "Task_Compute") {
            ctx.fillStyle = "#3498db";
            ctx.fillRect(x, margin.top + 55, tickW - 2, rowH);
        }

        // Row 3: Log Task (Green)
        if (snap.task === "Task_Log") {
            ctx.fillStyle = "#2ecc71";
            ctx.fillRect(x, margin.top + 105, tickW - 2, rowH);
        }

        // Row 4: CPU Usage (Idle = Gray)
        ctx.fillStyle = (snap.task === "Idle") ? "#d5dbdb" : 
                        (snap.task === "Task_Compute" ? "#3498db" : "#2ecc71");
        ctx.fillRect(x, margin.top + 155, tickW - 2, rowH);

        // Time Labels
        if (snap.time % 100 === 0) {
            ctx.fillStyle = "#7f8c8d";
            ctx.fillText(snap.time + "ms", x, canvas.height - 40);
        }
    });

    ctx.strokeStyle = "#2c3e50";
    ctx.strokeRect(margin.left, margin.top, chartW, 200);
}