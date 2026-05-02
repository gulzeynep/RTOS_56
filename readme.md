Case Study 5: Full System Integration (25 pt) 
● Concept: Simulate an Advanced Driver Assistance System (ADAS). 
● 5.a (Setup): 
○ ISR_Radar: Task runs every 20ms; if an obstacle is detected, it sends a 
message to Queue_Radar. 
○ Task_Compute (High Prio): Reads from the queue. If there's a risk, it acquires 
Mutex_Brake and applies the brakes. 
○ Task_Log (Low Prio): Writes data to an SD Card, but must check the state of 
Mutex_Brake while doing so. 
● 5.b (Observation): Capture a large snapshot of the running system (at least 500ms). 
Annotate the graph to explain how the tasks interact, how the ISR interrupts the flow, the 
queue waiting times, and the Mutex locking. Show the "dance" of the entire OS. 
● 5.c (Final Defense): While developing this complex scenario, what were the 2 biggest 
logical or OS theory mistakes the AI made when generating code for you? Include your 
prompt history and explain how you recognized the error and instructed the AI to fix it. 
Case Study 6: Enter a shared driver (25 pt) 
● Concept: Add a complex I/O 
● 5.a (Setup): 
○ Proceed on top of the last stage of Case Study #5. Now 
ethernet I/O capability is added to both the low prio log 
task and the high prio ISR_Radar task. Add Network HW, 
related driver and the RTOS’s network stack task to your 
simulation. Priority of the network stack task should be 
changeable.  
● 5.b (Observation): First understand and write down the definitions of all these new 
network related terminology. 
● 5.c (Final Defense): Simulate the case when network I/O is successful for both high and 
low tasks. Simulate the case when the system orchestration is unsuccessful. Comment 
why and what is happening. Make the network task’s priority higher/lower than the 
worker tasks. Increase network message load. Show which task’s messages are being 
dropped.