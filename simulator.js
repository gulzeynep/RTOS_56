// ============================================
// 1. GLOBAL STATE
// ============================================
let Queue_Radar = [];
const QUEUE_MAX = 10;
let droppedMessages = 0;
let systemHistory = [];
let currentTime = 0;
let previousTask = null;

let Mutex_Brake = { isLocked: false, owner: null, waitingQueue: [] };

let taskCompute = { name: "Task_Compute", priority: 1, state: "Blocked_Queue", ticksRemaining: 0 };
let taskNetwork = { name: "Task_Network", priority: 2, state: "Ready", ticksRemaining: 0 };
let taskLog = { name: "Task_Log", priority: 3, state: "Ready", ticksRemaining: 0 };

// ============================================
// 2. CORE LOGIC
// ============================================
function initUIListeners() {
    document.getElementById('enableCase6').addEventListener('change', function() {
        document.getElementById('case6Controls').style.display = this.checked ? 'block' : 'none';
    });
}

function logEvent(msg, type = "info") {
    const logContainer = document.getElementById('eventLog');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `<span class="time">[${currentTime.toString().padStart(4, '0')}ms]</span> ${msg}`;
    logContainer.prepend(entry);
}

function scheduler(isCase6) {
    let activeTasks = [taskCompute, taskLog];
    
    // Dynamic Priorities
    taskCompute.priority = parseFloat(document.getElementById('computePriority').value);
    taskLog.priority = parseFloat(document.getElementById('logPriority').value);

    if (isCase6) {
        taskNetwork.priority = parseFloat(document.getElementById('netPriority').value);
        activeTasks.push(taskNetwork);
        
        // Simulating network I/O requests from ISR/Log
        if (currentTime % 100 === 0 && Math.random() > 0.5) {
            taskNetwork.state = "Ready";
            taskNetwork.ticksRemaining += 1;
            logEvent("Network I/O request queued.", "network");
        }
    }

    // Sort tasks by priority (Lowest number = Highest priority)
    activeTasks.sort((a, b) => a.priority - b.priority);
    
    for (let task of activeTasks) {
        if (task.state === "Ready" || task.state === "Running") {
            return task;
        }
    }
    return null;
}

function executeTick(task) {
    if (!task) return "Idle";

    // Log context switch
    if (previousTask !== task.name && previousTask !== "Idle") {
        logEvent(`Context Switch: CPU mapped to ${task.name} (Priority: ${task.priority})`, "switch");
    }
    
    task.state = "Running";

    if (task.ticksRemaining <= 0) {
        if (task.name === "Task_Compute") {
            task.ticksRemaining = parseInt(document.getElementById('computeTime').value) / 20;
            if (Queue_Radar.length > 0) {
                Queue_Radar.shift();
                logEvent("Task_Compute consumed 1 data packet from Queue_Radar.", "action");
            }
        } else if (task.name === "Task_Network") {
            task.ticksRemaining = 2; // Fixed simulated network transmission time
            logEvent("Task_Network started packet transmission.", "network");
        } else if (task.name === "Task_Log") {
            task.ticksRemaining = parseInt(document.getElementById('logTime').value) / 20;
            logEvent("Task_Log started SD Card write sequence.", "action");
        }
    }

    // Mutex Acquisition attempt for Compute and Log
    if (task.name === "Task_Compute" || task.name === "Task_Log") {
        if (!Mutex_Brake.isLocked) {
            Mutex_Brake.isLocked = true;
            Mutex_Brake.owner = task.name;
            logEvent(`${task.name} acquired Mutex_Brake.`, "mutex");
        } else if (Mutex_Brake.owner !== task.name) {
            task.state = "Blocked_Mutex";
            if (!Mutex_Brake.waitingQueue.includes(task)) {
                Mutex_Brake.waitingQueue.push(task);
                logEvent(`${task.name} BLOCKED waiting for Mutex_Brake (Owner: ${Mutex_Brake.owner}).`, "error");
            }
            return "Blocked_Mutex";
        }
    }

    task.ticksRemaining--;

    // Task Completion
    if (task.ticksRemaining <= 0) {
        logEvent(`${task.name} completed its execution block.`, "success");

        if (Mutex_Brake.owner === task.name) {
            Mutex_Brake.isLocked = false;
            Mutex_Brake.owner = null;
            logEvent(`${task.name} released Mutex_Brake.`, "mutex");
            
            if (Mutex_Brake.waitingQueue.length > 0) {
                let unblockedTask = Mutex_Brake.waitingQueue.shift();
                unblockedTask.state = "Ready";
                logEvent(`${unblockedTask.name} UNBLOCKED and moved to Ready state.`, "success");
            }
        }
        
        if (task.name === "Task_Compute") {
            task.state = (Queue_Radar.length > 0) ? "Ready" : "Blocked_Queue";
        } else if (task.name === "Task_Network") {
            task.state = "Blocked_IO"; // Waits for next request
        } else {
            task.state = "Ready";
        }
    }
    
    previousTask = task.name;
    return task.name;
}

// ============================================
// 3. SIMULATION RUNNER
// ============================================
function runBatchSimulation() {
    currentTime = 0; systemHistory = []; Queue_Radar = []; droppedMessages = 0; previousTask = null;
    Mutex_Brake = { isLocked: false, owner: null, waitingQueue: [] };
    
    taskCompute.state = "Blocked_Queue"; taskCompute.ticksRemaining = 0;
    taskLog.state = "Ready"; taskLog.ticksRemaining = 0;
    taskNetwork.state = "Blocked_IO"; taskNetwork.ticksRemaining = 0;
    
    document.getElementById('eventLog').innerHTML = "";
    logEvent("Simulation Started.", "info");

    const isCase6 = document.getElementById('enableCase6').checked;
    const prob = parseInt(document.getElementById('obstacleProb').value);

    for (let t = 0; t <= 500; t += 20) {
        currentTime = t;
        let isrTriggered = false;

        // ISR_Radar firing
        if (Math.random() * 100 < prob) {
            isrTriggered = true;
            logEvent("ISR_Radar: Hardware Interrupt Triggered - Obstacle Detected!", "isr");
            
            if (Queue_Radar.length < QUEUE_MAX) {
                Queue_Radar.push("DATA");
                if (taskCompute.state === "Blocked_Queue") {
                    taskCompute.state = "Ready";
                    logEvent("Task_Compute moved from Blocked_Queue to Ready.", "switch");
                }
            } else {
                droppedMessages++;
                logEvent("QUEUE OVERFLOW: ISR_Radar dropped message.", "error");
            }
        }

        let selectedTask = scheduler(isCase6);
        let runningName = executeTick(selectedTask);

        systemHistory.push({ time: t, isr: isrTriggered, task: runningName, case6: isCase6 });
    }
    
    updateUI();
    drawProportionalGanttChart();
}

function updateUI() {
    document.getElementById('qVal').textContent = `${Queue_Radar.length} / ${QUEUE_MAX}`;
    document.getElementById('dropVal').textContent = droppedMessages;
    document.getElementById('mState').textContent = Mutex_Brake.isLocked ? "Locked" : "Unlocked";
    document.getElementById('mOwner').textContent = Mutex_Brake.owner || "None";
    document.getElementById('mWait').textContent = Mutex_Brake.waitingQueue.map(t => t.name).join(", ") || "0";
}

// ============================================
// 4. PROPORTIONAL GRAPHICS
// ============================================
function drawProportionalGanttChart() {
    const canvas = document.getElementById('ganttChart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const margin = { top: 40, left: 160, bottom: 60, right: 40 };
    const chartW = canvas.width - margin.left - margin.right;
    const tickW = chartW / 26; 
    const rowH = 28;

    const isCase6 = document.getElementById('enableCase6').checked;
    const rows = ["ISR_Radar (IRQ)", "Task_Compute", "Task_Log"];
    if (isCase6) rows.splice(2, 0, "Task_Network");
    rows.push("CPU Execution");

    ctx.fillStyle = "#2c3e50";
    ctx.font = "bold 12px 'Segoe UI'";
    rows.forEach((l, i) => ctx.fillText(l, 10, margin.top + 20 + (i * 60)));

    // Helper to draw merged blocks
    const drawBlock = (taskName, color, rowIdx, startIdx, length) => {
        const x = margin.left + (startIdx * tickW);
        const w = length * tickW;
        
        ctx.fillStyle = color;
        // Task Row
        ctx.fillRect(x, margin.top + (rowIdx * 60), w, rowH);
        // Stroke for better visibility
        ctx.strokeStyle = "#2c3e50";
        ctx.strokeRect(x, margin.top + (rowIdx * 60), w, rowH);
        
        // CPU Row
        ctx.fillRect(x, margin.top + (rows.length - 1) * 60, w, rowH);
        ctx.strokeRect(x, margin.top + (rows.length - 1) * 60, w, rowH);
    };

    let activeTaskObj = { name: null, startIdx: 0, length: 0 };

    systemHistory.forEach((snap, i) => {
        const x = margin.left + (i * tickW);

        // Draw ISR as instantaneous triggers (since they are quick hardware interrupts)
        if (snap.isr) {
            ctx.fillStyle = "#e74c3c";
            ctx.fillRect(x, margin.top, tickW, rowH);
            ctx.strokeRect(x, margin.top, tickW, rowH);
        }

        // Proportional Blocks Logic for Tasks
        if (snap.task !== activeTaskObj.name || snap.task === "Idle" || snap.task === "Blocked_Mutex") {
            // Render previous block if it existed
            if (activeTaskObj.name && activeTaskObj.name !== "Idle" && !activeTaskObj.name.includes("Blocked")) {
                let rowIdx = rows.indexOf(activeTaskObj.name);
                let color = activeTaskObj.name === "Task_Compute" ? "#3498db" : 
                            activeTaskObj.name === "Task_Log" ? "#2ecc71" : 
                            activeTaskObj.name === "Task_Network" ? "#f1c40f" : "#95a5a6";
                if (rowIdx !== -1) {
                    drawBlock(activeTaskObj.name, color, rowIdx, activeTaskObj.startIdx, activeTaskObj.length);
                }
            }
            // Reset tracker
            activeTaskObj = { name: snap.task, startIdx: i, length: 1 };
        } else {
            // Continue current block
            activeTaskObj.length++;
        }

        // Timeline Markers
        if (snap.time % 100 === 0) {
            ctx.fillStyle = "#7f8c8d";
            ctx.fillText(snap.time + "ms", x, canvas.height - 30);
            ctx.beginPath();
            ctx.moveTo(x, margin.top - 10);
            ctx.lineTo(x, canvas.height - 45);
            ctx.strokeStyle = "#ecf0f1";
            ctx.stroke();
        }
    });

    // Render the very last block if simulation ended while running a task
    if (activeTaskObj.name && activeTaskObj.name !== "Idle" && !activeTaskObj.name.includes("Blocked")) {
        let rowIdx = rows.indexOf(activeTaskObj.name);
        let color = activeTaskObj.name === "Task_Compute" ? "#3498db" : 
                    activeTaskObj.name === "Task_Log" ? "#2ecc71" : 
                    activeTaskObj.name === "Task_Network" ? "#f1c40f" : "#95a5a6";
        if (rowIdx !== -1) {
            drawBlock(activeTaskObj.name, color, rowIdx, activeTaskObj.startIdx, activeTaskObj.length);
        }
    }
    
    // Main Chart Border
    ctx.strokeStyle = "#34495e";
    ctx.strokeRect(margin.left, margin.top - 10, chartW, rows.length * 60 - 20);
}

// Initialize on load
initUIListeners();