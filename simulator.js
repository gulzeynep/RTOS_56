// --- 1. INITIALIZATION ---
const canvas = document.getElementById('cpuGraph');
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("statusDisplay");

const computeInput = document.getElementById("computeTimeInput");
const logInput = document.getElementById("logTimeInput");

let systemHistory = [];
let Queue_Radar = [];
let currentTime = 0;

// Task Objects
let taskCompute = { 
    name: "Task_Compute", 
    priority: "High", 
    state: "Blocked", 
    ticksRemaining: 0 
};

let taskLog = { 
    name: "Task_Log", 
    priority: "Low", 
    state: "Ready", 
    ticksRemaining: 0 
};

let Mutex_Brake = { 
    isLocked: false, 
    owner: null,
    waitingQueue: [] 
};

// --- 2. INTERRUPT SERVICE ROUTINE (ISR) ---
function triggerObstacle() {
    let msg = "Obstacle Detected!";
    statusText.textContent = "⚠️ " + msg;
    Queue_Radar.push(msg);

    // Wake up high-priority task and load its "Recipe"
    if (taskCompute.state === "Blocked") {
        taskCompute.state = "Ready";
        taskCompute.ticksRemaining = parseInt(computeInput.value);
    }
}

// --- 3. THE HEARTBEAT (20ms Ticks) ---
setInterval(() => {
    currentTime += 20;

    let currentSnapshot = {
        time: currentTime,
        runningTask: "Idle", // Default if nothing runs
        queueLength: Queue_Radar.length,
        mutexLocked: Mutex_Brake.isLocked
    };

    // --- CPU SCHEDULER LOGIC ---
    
    // Check High Priority Task first
    if (taskCompute.state === "Ready" || taskCompute.state === "Running") {
        handleTaskExecution(taskCompute, currentSnapshot);
    } 
    // If High Priority is Blocked/Idle, try Low Priority
    else if (taskLog.state === "Ready" || taskLog.state === "Running") {
        // Log task resets its own time if it was fresh
        if (taskLog.ticksRemaining <= 0 && taskLog.state === "Ready") {
            taskLog.ticksRemaining = parseInt(logInput.value);
        }
        handleTaskExecution(taskLog, currentSnapshot);
    }

    systemHistory.push(currentSnapshot);
    drawGraph(); // Helper to visualize the history
}, 20);

// --- 4. TASK LOGIC HELPER ---
function handleTaskExecution(task, snapshot) {
    snapshot.runningTask = task.name;
    task.state = "Running";

    // 🔑 MUTEX LOGIC: Try to get the key if needed
    if (!Mutex_Brake.isLocked) {
        Mutex_Brake.isLocked = true;
        Mutex_Brake.owner = task.name;
        if (task.name === "Task_Compute" && Queue_Radar.length > 0) {
            Queue_Radar.shift(); // "Read" the radar data
        }
    } else if (Mutex_Brake.owner !== task.name) {
        // Someone else has the key! Block this task.
        task.state = "Blocked";
        Mutex_Brake.waitingQueue.push(task);
        snapshot.runningTask = "Waiting for Mutex";
        return;
    }

    // ⏳ COUNTDOWN LOGIC
    task.ticksRemaining--;

    // ✅ COMPLETION LOGIC
    if (task.ticksRemaining <= 0) {
        statusText.textContent = `${task.name} finished task.`;
        
        // Release Mutex
        Mutex_Brake.isLocked = false;
        Mutex_Brake.owner = null;
        
        // Final state
        task.state = (task.name === "Task_Compute") ? "Blocked" : "Ready";

        // Wake up next in line
        if (Mutex_Brake.waitingQueue.length > 0) {
            let nextTask = Mutex_Brake.waitingQueue.shift();
            nextTask.state = "Ready";
        }
    }
}

// Simple visualization function
function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let x = 0;
    systemHistory.slice(-40).forEach(snap => { // Show last 40 ticks
        ctx.fillStyle = snap.runningTask === "Task_Compute" ? "red" : 
                        snap.runningTask === "Task_Log" ? "blue" : "gray";
        ctx.fillRect(x, 150, 15, - (snap.queueLength * 10 + 20));
        x += 20;
    });
}