// ============================================
// INTERRUPT SERVICE ROUTINE (ISR)
// ============================================

function ISR_Radar() {
    // This function runs EVERY 20ms tick (simulates hardware interrupt)
    
    const obstacleProb = parseInt(document.getElementById('obstacleProb').value);
    const detected = Math.random() * 100 < obstacleProb;
    
    if (detected) {
        // Obstacle detected!
        let success = enqueueMessage("Obstacle detected!");
        
        if (success) {
            logEvent(`[ISR_Radar] ⚠️ Obstacle detected! Queue: ${getQueueLength()}/${QUEUE_MAX_SIZE}`, "event-isr");
            
            // Wake up Task_Compute if it was sleeping
            if (taskCompute.state === "Blocked_Queue") {
                taskCompute.state = "Ready";
                taskCompute.ticksRemaining = 0; // Will be initialized in executeTask
                logEvent(`[Task_Compute] Woken up - queue has data`, "event-compute");
            }
        } else {
            // Queue was full - message dropped!
            logEvent(`[ISR_Radar] ❌ Queue FULL! Message dropped (Total dropped: ${droppedMessages})`, "event-warning");
        }
    }
}

// ============================================
// MAIN SIMULATION TICK (20ms heartbeat)
// ============================================

function tick() {
    currentTime += 20;
    
    // STEP 1: ISR runs first (interrupts everything)
    ISR_Radar();
    
    // STEP 2: Scheduler picks highest priority ready task
    let selectedTask = scheduler();
    
    // STEP 3: Execute the selected task
    let runningTaskName = executeTask(selectedTask);
    
    // STEP 4: Record this moment in history
    let snapshot = {
        time: currentTime,
        runningTask: runningTaskName,
        taskComputeState: taskCompute.state,
        taskLogState: taskLog.state,
        queueLength: getQueueLength(),
        mutexLocked: Mutex_Brake.isLocked,
        mutexOwner: Mutex_Brake.owner
    };
    
    systemHistory.push(snapshot);
    
    // Keep history size manageable (last 5 seconds = 250 ticks)
    if (systemHistory.length > 250) {
        systemHistory.shift();
    }
    
    // STEP 5: Update UI
    updateUI();
    drawGanttChart();
}

// ============================================
// SIMULATION CONTROLS
// ============================================

function startSimulation() {
    if (isRunning) return;
    
    isRunning = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    
    // Apply settings
    taskCompute.executionTimeMs = parseInt(document.getElementById('computeTime').value);
    taskLog.executionTimeMs = parseInt(document.getElementById('logTime').value);
    
    logEvent("🚀 Simulation STARTED", "event-isr");
    
    // Start the heartbeat (20ms interval)
    simulationInterval = setInterval(tick, 20);
}

function stopSimulation() {
    if (!isRunning) return;
    
    isRunning = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    
    clearInterval(simulationInterval);
    logEvent("⏸️ Simulation PAUSED", "event-isr");
}

function resetSimulation() {
    stopSimulation();
    
    // Reset all state
    currentTime = 0;
    systemHistory = [];
    eventLog = [];
    Queue_Radar = [];
    droppedMessages = 0;
    
    Mutex_Brake.isLocked = false;
    Mutex_Brake.owner = null;
    Mutex_Brake.waitingQueue = [];
    Mutex_Brake.lockCount = 0;
    
    taskCompute.state = "Blocked_Queue";
    taskCompute.ticksRemaining = 0;
    
    taskLog.state = "Ready";
    taskLog.ticksRemaining = 0;
    
    // Clear UI
    document.getElementById('eventLog').innerHTML = '';
    const canvas = document.getElementById('ganttChart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    updateUI();
    logEvent("🔄 System RESET to initial state", "event-isr");
}

// Initialize UI on page load
window.addEventListener('load', function() {
    updateUI();
    logEvent("💻 ADAS RTOS Simulator initialized", "event-isr");
    logEvent("ℹ️ Click START to begin simulation", "event-isr");
});