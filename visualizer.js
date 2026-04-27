// ============================================
// GANTT CHART VISUALIZATION
// ============================================

function drawGanttChart() {
    const canvas = document.getElementById('ganttChart');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Configuration
    const tickWidth = 20;  // Each 20ms tick gets 20 pixels
    const maxVisibleTicks = Math.floor(width / tickWidth);
    const visibleHistory = systemHistory.slice(-maxVisibleTicks);
    
    if (visibleHistory.length === 0) return;
    
    // Row layout
    const rowHeight = 50;
    const rows = [
        { label: "ISR_Radar", y: 10 },
        { label: "Task_Compute (H)", y: 70 },
        { label: "Task_Log (L)", y: 130 },
        { label: "CPU Timeline", y: 190 }
    ];
    
    // Draw row labels
    ctx.fillStyle = "#2c3e50";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    rows.forEach(row => {
        ctx.fillText(row.label, 5, row.y + 25);
    });
    
    // Draw grid lines
    ctx.strokeStyle = "#ecf0f1";
    ctx.lineWidth = 1;
    for (let i = 0; i <= visibleHistory.length; i += 5) {
        let x = i * tickWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - 30);
        ctx.stroke();
    }
    
    // Draw execution blocks
    let currentBlock = null;
    
    visibleHistory.forEach((snapshot, index) => {
        const x = index * tickWidth;
        
        // ISR always fires (thin bar at top)
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(x, rows[0].y, tickWidth - 2, rowHeight);
        
        // Determine what's running on CPU
        let cpuTask = snapshot.runningTask;
        let cpuColor = "#95a5a6"; // Default: Idle
        let cpuY = rows[3].y;
        
        if (cpuTask === "Task_Compute") {
            cpuColor = "#3498db";
            // Also draw in Task_Compute row
            ctx.fillStyle = "#3498db";
            ctx.fillRect(x, rows[1].y, tickWidth - 2, rowHeight);
        } else if (cpuTask === "Task_Log") {
            cpuColor = "#2ecc71";
            // Also draw in Task_Log row
            ctx.fillStyle = "#2ecc71";
            ctx.fillRect(x, rows[2].y, tickWidth - 2, rowHeight);
        } else if (cpuTask === "Blocked_Mutex") {
            cpuColor = "#f39c12";
        }
        
        // Draw in CPU timeline row
        ctx.fillStyle = cpuColor;
        ctx.fillRect(x, cpuY, tickWidth - 2, rowHeight);
        
        // Draw task state indicators (small boxes for blocked states)
        if (snapshot.taskComputeState === "Blocked_Queue") {
            ctx.fillStyle = "#9b59b6";
            ctx.fillRect(x, rows[1].y + rowHeight - 10, tickWidth - 2, 8);
        } else if (snapshot.taskComputeState === "Blocked_Mutex") {
            ctx.fillStyle = "#f39c12";
            ctx.fillRect(x, rows[1].y + rowHeight - 10, tickWidth - 2, 8);
        }
    });
    
    // Draw time labels
    ctx.fillStyle = "#2c3e50";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    for (let i = 0; i < visibleHistory.length; i += 10) {
        const x = i * tickWidth;
        const timeLabel = visibleHistory[i].time;
        ctx.fillText(`${timeLabel}ms`, x + 10, height - 10);
    }
    
    // Draw current time marker
    if (visibleHistory.length > 0) {
        const lastX = (visibleHistory.length - 1) * tickWidth + tickWidth/2;
        ctx.strokeStyle = "#e74c3c";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(lastX, 0);
        ctx.lineTo(lastX, height - 30);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}