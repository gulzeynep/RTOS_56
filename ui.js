// ============================================
// UI UPDATE FUNCTIONS
// ============================================

function updateUI() {
    // Time display
    document.getElementById('timeDisplay').textContent = `${currentTime} ms`;
    
    // Task states
    let currentTask = systemHistory.length > 0 ? 
        systemHistory[systemHistory.length - 1].runningTask : "Idle";
    document.getElementById('taskDisplay').textContent = currentTask;
    
    // Task_Compute state
    let computeStateText = taskCompute.state;
    if (taskCompute.state === "Running") {
        computeStateText = `Running (${taskCompute.ticksRemaining * 20}ms left)`;
    } else if (taskCompute.state === "Blocked_Queue") {
        computeStateText = "Blocked (Queue Empty)";
    } else if (taskCompute.state === "Blocked_Mutex") {
        computeStateText = "Blocked (Waiting for Mutex)";
    }
    document.getElementById('computeStateDisplay').textContent = computeStateText;
    
    // Task_Log state
    let logStateText = taskLog.state;
    if (taskLog.state === "Running") {
        logStateText = `Running (${taskLog.ticksRemaining * 20}ms left)`;
    } else if (taskLog.state === "Blocked_Mutex") {
        logStateText = "Blocked (Waiting for Mutex)";
    }
    document.getElementById('logStateDisplay').textContent = logStateText;
    
    // Queue status
    document.getElementById('queueCount').textContent = getQueueLength();
    document.getElementById('oldestMsg').textContent = getOldestMessage();
    document.getElementById('droppedCount').textContent = droppedMessages;
    
    // Mutex status
    document.getElementById('mutexState').textContent = Mutex_Brake.isLocked ? "🔒 Locked" : "🔓 Unlocked";
    document.getElementById('mutexOwner').textContent = Mutex_Brake.owner || "None";
    document.getElementById('mutexWaiting').textContent = Mutex_Brake.waitingQueue.length;
    document.getElementById('lockCount').textContent = Mutex_Brake.lockCount;
}

// ============================================
// EVENT LOGGING
// ============================================

function logEvent(message, className = "") {
    const logDiv = document.getElementById('eventLog');
    const entry = document.createElement('div');
    entry.className = className;
    entry.textContent = `[${currentTime}ms] ${message}`;
    logDiv.insertBefore(entry, logDiv.firstChild);
    
    // Keep only last 100 events
    while (logDiv.children.length > 100) {
        logDiv.removeChild(logDiv.lastChild);
    }
    
    eventLog.push({ time: currentTime, message, className });
}

// Update probability slider display
document.getElementById('obstacleProb').addEventListener('input', function() {
    document.getElementById('probValue').textContent = this.value + '%';
});