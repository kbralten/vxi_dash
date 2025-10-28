Monitoring Setup: State Machine & Workflow
==========================================

Overview
--------

To move beyond simple, static data logging, the Monitoring Setup utilizes a powerful state machine. This allows you to create complex, automated workflows and test sequences. The core logic is "If This, Then That," enabling the system to automatically react to sensor data, timers, and other conditions.

Instead of just one set of modes and parameters, you define multiple **states**. The system then transitions between these states based on rules you define, automatically changing instrument settings as it moves.

Core Concepts
-------------

### 1\. State

A **State** is the fundamental building block. It represents a specific, stable condition for your entire setup.

**Each state defines:**

-   **Instrument Settings:** The specific **Mode** and **Parameters** for each instrument in your monitoring setup. For example, in a "Heating" state, the Power Supply might be in "Constant Voltage" mode, while in a "Cooling" state, it might be "Off."

-   **Active Rules:** A set of transition rules that are *only* active when this state is.

### 2\. Special States

-   **Initial State:** This is the *only* state marked as the "start" point. When you begin a monitoring session, it will always begin in this state.

-   **End State:** A special state that, when entered, automatically stops the monitoring session. You can have multiple End States (e.g., one for a successful test, one for an error condition).

### 3\. Transitions (The "If This, Then That")

A Transition is the logic that moves the system from one state to another. Each transition consists of a **Trigger** and a **Target State**. The system constantly evaluates the triggers for the *currently active state*.

**Trigger Types:**

-   **Sensor Value:** Triggers when a measured signal meets a condition.

    -   *Example:* `IF "DMM: Voltage" > 5.0V`

    -   *Example:* `IF "Thermometer: Temp" <= 20.0C`

-   **Time in State:** Triggers after the system has been in the current state for a specific duration.

    -   *Example:* `AFTER 30 seconds`

    -   *Example:* `AFTER 1.5 hours`

-   **Total Time:** Triggers after the monitoring session has been running for a specific total duration, regardless of the current state.

    -   *Example:* `IF "Total Monitoring Time" > 8 hours`

UI for Configuration: A Visual Workflow
---------------------------------------

A visual, node-based editor is the most intuitive way to configure a state machine.

### 1\. The Canvas

A main, zoomable, pannable canvas where you build your workflow.

### 2\. The Toolbar

A simple bar with:

-   **"Add State" Button:** Drags a new, generic state node onto the canvas.

-   **"Add End State" Button:** Drags a special "End" state node onto the canvas.

### 3\. State Nodes

Each state is a box (a "node") on the canvas.

-   **Initial State:** The first state you add is automatically marked "Initial State" (e.g., with a green border and a "START" icon). You can right-click any other state to "Set as Initial State."

-   **End State:** These nodes are visually distinct (e.g., red border, "END" icon).

-   **Transitions:** You create transitions by clicking an output handle on one state and dragging an arrow to the input handle of another.

### 4\. The Configuration Panel

When you click on a **State Node**, a side panel opens to configure its details:

1.  **State Name:** A text field (e.g., "Heating Phase," "Soak," "Safety Shutdown").

2.  **Instrument Setup:** A list of all instruments in this setup. For each instrument, you see:

    -   A dropdown to select its **Mode** (from the instrument's pre-configured list).

    -   Once a mode is selected, input fields appear for any **Parameters** that mode requires (e.g., `{volts}`, `{amps}`).

3.  **Transitions:** A list of all transitions *originating from this state*.

    -   Clicking "Add Transition" (or clicking the arrow on the canvas) opens the **Transition Rule Modal**.

### 5\. The Transition Rule Modal

This modal pops up when you create or edit a transition (the arrow).

-   **Target State:** `(Pre-filled, e.g., "Soak Phase")`

-   **Add Condition:** A button to add one or more "If" conditions.

    -   **Trigger Type:** Dropdown (Sensor Value, Time in State, Total Time).

    -   **Condition:**

        -   If "Sensor Value": `[Signal Dropdown]` `[Operator Dropdown]` `[Value Input]`

        -   If "Time in State": `AFTER` `[Duration Input]`

        -   If "Total Time": `IF Total Time >` `[Duration Input]`

-   You can add multiple conditions (e.g., `IF "DMM: Voltage" < 3.0` AND `Time in State > 60s`).

UI for Live Visualization
-------------------------

When a monitoring session is *running*, the UI should display the same visual, node-based graph.

-   The **active state** is clearly highlighted (e.g., a glowing border).

-   When a transition occurs, the highlight instantly moves to the new active state.

-   This gives you a clear, at-a-glance understanding of *exactly* what your process is doing and where it is in its workflow.

Example Workflow: Battery Charge/Discharge Test
-----------------------------------------------

-   **State 1: "Initial Setup" (Initial State)**

    -   **Instruments:**

        -   Power Supply: Mode "Set Output", Params: `{volts: 0, amps: 0}`

        -   DMM: Mode "Measure Voltage"

    -   **Transition:**

        -   `AFTER 5 seconds` -> Go to **"Charging"**

-   **State 2: "Charging"**

    -   **Instruments:**

        -   Power Supply: Mode "Set Output", Params: `{volts: 4.2, amps: 1.0}`

    -   **Transitions:**

        -   `IF "DMM: Voltage" >= 4.19` -> Go to **"Discharging"**

        -   `IF "Total Time" > 2 hours` -> Go to **"Error State"**

-   **State 3: "Discharging"**

    -   **Instruments:**

        -   Power Supply: Mode "Off"

        -   Electronic Load: Mode "Constant Current", Params: `{current: 0.5}`

    -   **Transitions:**

        -   `IF "DMM: Voltage" <= 3.0` -> Go to **"Test Complete (End)"**

-   **State 4: "Error State" (End State)**

    -   **Instruments:**

        -   Power Supply: Mode "Off"

        -   Electronic Load: Mode "Off"

    -   *(Session stops)*

-   **State 5: "Test Complete (End)" (End State)**

    -   *(Session stops)*