// ============================================
// SCHEDULER - Decides which task runs next
// ============================================

function scheduler() {
    // Priority-based preemptive scheduler
    // Pick highest priority READY or RUNNING task
    
    let tasks = getAllTasks();
    
    // Sort by priority (lower number = higher priority)
    tasks.sort((a, b) => a.priority - b.priority);
    
    for (let task of tasks) {
        if (task.state === "Ready" || task.state === "Running") {
            return task;
        }
    }
    
    // No task ready - CPU is idle
    return null;
}

// ============================================
// TASK EXECUTION ENGINE
// ============================================

function executeTask(task) {
    if (!task) {
        return "Idle"; // No task to run
    }
    
    let wasBlocked = (task.state === "Blocked_Queue" || task.state === "Blocked_Mutex");
    let wasReady = (task.state === "Ready");
    
    // Transition to Running
    task.state = "Running";
    
    // Initialize execution if this is the first tick
    if (task.ticksRemaining === 0) {
        task.ticksRemaining = task.executionTimeMs / 20;
        
        // Task_Compute reads from queue when it starts
        if (task.name === "Task_Compute") {
            let msg = dequeueMessage();
            if (msg) {
                logEvent(`[Task_Compute] Processing: "${msg.data}" (Queue now: ${getQueueLength()})`, "event-queue");
            }
        }
        
        if (wasReady) {
            logEvent(`[${task.name}] Started execution (${task.executionTimeMs}ms)`, 
                     task.name === "Task_Compute" ? "event-compute" : "event-log-task");
        }
    }
    
    // Try to acquire the mutex
    if (!acquireMutex(task)) {
        // Failed to get mutex - block this task
        task.state = "Blocked_Mutex";
        logEvent(`[${task.name}] Blocked on Mutex_Brake (held by ${Mutex_Brake.owner})`, "event-mutex");
        return "Blocked_Mutex";
    }
    
    // Execute one tick (20ms worth of work)
    task.ticksRemaining--;
    
    // Check if task completed
    if (task.ticksRemaining <= 0) {
        logEvent(`[${task.name}] ✅ Completed execution`, 
                 task.name === "Task_Compute" ? "event-compute" : "event-log-task");
        
        // Release the mutex
        releaseMutex(task);
        logEvent(`[${task.name}] Released Mutex_Brake`, "event-mutex");
        
        // Determine next state
        if (task.name === "Task_Compute") {
            // Check if more queue data is available
            if (getQueueLength() > 0) {
                task.state = "Ready";
                task.ticksRemaining = 0; // Will be reset on next execution
                logEvent(`[Task_Compute] More queue data available - staying Ready`, "event-compute");
            } else {
                task.state = "Blocked_Queue";
                logEvent(`[Task_Compute] Queue empty - entering Blocked state`, "event-queue");
            }
        } else if (task.name === "Task_Log") {
            // Task_Log goes back to Ready (periodic task)
            task.state = "Ready";
            task.ticksRemaining = 0;
        }
    }
    
    return task.name;
}