// ============================================
// CORE DATA STRUCTURES
// ============================================

// Message Queue for Radar Data
let Queue_Radar = [];
const QUEUE_MAX_SIZE = 10;
let droppedMessages = 0;

// Mutex for Brake System
let Mutex_Brake = {
    isLocked: false,
    owner: null,
    waitingQueue: [],
    lockCount: 0  // Statistics: how many times it's been locked
};

// Task Definitions
let taskCompute = {
    name: "Task_Compute",
    priority: 1,          // 1 = Highest priority
    state: "Blocked_Queue", // States: Ready, Running, Blocked_Queue, Blocked_Mutex
    executionTimeMs: 40,  // How long it needs to run
    ticksRemaining: 0,    // Countdown timer (in 20ms ticks)
    color: "#3498db"
};

let taskLog = {
    name: "Task_Log",
    priority: 2,          // 2 = Lower priority
    state: "Ready",
    executionTimeMs: 160,
    ticksRemaining: 0,
    color: "#2ecc71"
};

// System State
let currentTime = 0;
let systemHistory = [];
let eventLog = [];
let isRunning = false;
let simulationInterval = null;

// ============================================
// QUEUE OPERATIONS
// ============================================

function enqueueMessage(message) {
    if (Queue_Radar.length < QUEUE_MAX_SIZE) {
        Queue_Radar.push({
            timestamp: currentTime,
            data: message
        });
        return true;
    } else {
        droppedMessages++;
        return false; // Queue full
    }
}

function dequeueMessage() {
    if (Queue_Radar.length > 0) {
        return Queue_Radar.shift();
    }
    return null;
}

function getQueueLength() {
    return Queue_Radar.length;
}

function getOldestMessage() {
    if (Queue_Radar.length > 0) {
        return `${currentTime - Queue_Radar[0].timestamp}ms old`;
    }
    return "-";
}

// ============================================
// MUTEX OPERATIONS
// ============================================

function acquireMutex(task) {
    if (!Mutex_Brake.isLocked) {
        // Mutex is free - grab it!
        Mutex_Brake.isLocked = true;
        Mutex_Brake.owner = task.name;
        Mutex_Brake.lockCount++;
        return true;
    } else if (Mutex_Brake.owner === task.name) {
        // Already own it
        return true;
    } else {
        // Someone else has it - must wait
        if (!Mutex_Brake.waitingQueue.includes(task)) {
            Mutex_Brake.waitingQueue.push(task);
        }
        return false;
    }
}

function releaseMutex(task) {
    if (Mutex_Brake.owner === task.name) {
        Mutex_Brake.isLocked = false;
        Mutex_Brake.owner = null;
        
        // Wake up next waiting task
        if (Mutex_Brake.waitingQueue.length > 0) {
            let nextTask = Mutex_Brake.waitingQueue.shift();
            nextTask.state = "Ready";
            logEvent(`[${nextTask.name}] Woken up - mutex available`, "event-mutex");
        }
        return true;
    }
    return false;
}

// ============================================
// TASK STATE MANAGEMENT
// ============================================

function getAllTasks() {
    return [taskCompute, taskLog];
}

function getTaskByName(name) {
    if (name === "Task_Compute") return taskCompute;
    if (name === "Task_Log") return taskLog;
    return null;
}