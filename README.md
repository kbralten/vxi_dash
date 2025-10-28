VXI-11 Instrument Dashboard & Data Logger
=========================================

Overview
--------

Welcome to the VXI-11 Instrument Dashboard & Data Logger! This program is designed to provide a comprehensive solution for configuring, interacting with, monitoring, and logging data from various scientific and industrial instruments that use the VXI-11 (LXI) protocol.

Whether you are working with a single instrument or a complex setup of multiple devices, this tool provides a user-friendly interface to manage your equipment and visualize data in real-time.

Key Features
------------

-   **VXI-11 Protocol Support:** Natively configure and communicate with VXI-11 (LXI) compatible instruments over a network.

-   **Advanced Instrument Configuration:** Define an instrument's capabilities in detail, including its operational modes with dynamically parsed parameters, measurable signals, units, and scaling factors.

-   **Interactive Terminal:** A powerful interface for direct instrument control. It includes a raw SCPI command line and a list of all pre-configured modes for the selected instrument. You can instantly activate or deactivate any mode with start/stop buttons, and a pop-up will prompt for any required parameters.

-   **Monitoring Setup:** Define complex monitoring configurations by selecting instruments, setting them to a pre-configured mode with specific parameters, and defining the measurement frequency.

-   **Live Dashboard & Historical Data:** Visualize real-time data from your monitoring setups on a clean, interactive dashboard. The application also logs all measured data, allowing you to review and analyze historical trends.

Advanced Instrument Configuration
---------------------------------

A powerful feature of this dashboard is the ability to create detailed profiles for each instrument. This involves defining the instrument's protocol, connection, its measurable signals, and its operational modes. This upfront configuration makes setting up monitoring tasks much faster and less error-prone.

The configuration process follows four steps:

### Step 1: Basic Connection Details

First, provide the physical connection details for your VXI-11 instrument.

-   **VXI-11 (LXI):** Requires an Instrument Name and the IP Address or Hostname of the device on the network.

### Step 2: Define Signals

Next, define the signals the instrument can measure.

-   **Signal Name:** A descriptive name (e.g., "Primary Value", "Frequency").

-   **Measure Command:** The SCPI query command used to read this signal's value (e.g., `MEAS:VOLT?`, `MEAS:FREQ?`).

### Step 3: Define Modes and Parameters

Modes represent the different states or functions of the instrument.

-   **Mode Name:** A descriptive name (e.g., "Constant Voltage Output").

-   **Enable/Disable Commands:** Multi-line blocks of SCPI commands. To create a parameter, enclose a name in curly braces, like `{param_name}`.

### Step 4: Configure Signals Within Each Mode

This is where you link your signals and modes using a configuration matrix. The interface will display a table where each **row** represents one of your defined **modes** and each **column** represents a **signal**.

At the intersection of a mode and a signal, you can configure how that signal behaves in that specific mode. For each applicable combination, the cell will provide:

-   **Unit:** A dropdown to select the unit of measurement.

-   **Scaling Factor:** An input for a multiplier to apply to the raw value.

Note on units and scaling
-------------------------

Always choose a base unit of measure for each signal (for example: Volts `V`, Amps `A`, Hertz `Hz`). If your instrument reports a value in a secondary unit, use the Scaling Factor to convert it to the base unit you selected.

Example: Instrument reports millivolts (mV) but you want Volts (V)

- Set Unit to `V` (Volts)
- Set Scaling Factor to `0.001` (because 1 mV = 0.001 V)

With this setup, a raw reading of `250 mV` will be stored/displayed as `0.25 V`.

### Configuration Example: VXI-11 Power Supply

-   **Connection:** VXI-11, IP Address: `192.168.1.100`.

-   **Signals Defined:**

    -   "Output Voltage": `MEAS:VOLT?`

    -   "Output Current": `MEAS:CURR?`

-   **Mode: "Set Output"**

    -   **Enable Actions:**

        ```
        VOLT {volts}
        CURR:LIM {amps}
        OUTP ON

        ```

    -   **Disable Actions:**

        ```
        OUTP OFF

        ```

-   **Signal Configuration:**

    -   In "Set Output" mode, "Output Voltage" unit is `Volts` and "Output Current" unit is `Amps`.

Usage Workflow
--------------

### 1\. Configure an Instrument

Navigate to the "Instruments" section and fully configure your device using the four-step process described above.

### 2\. Interact with an Instrument

Go to the "Interactive" tab and select an instrument. You will get a raw SCPI command line and the Mode Control panel.

-   **Mode Control:** You will see a list of all configured modes with "Start" and "Stop" buttons. Clicking "Start" will execute the enable commands, prompting for any parameters if needed.

### 3\. Create a Monitoring Setup

In the "Monitoring" section, create a new setup by giving it a name, setting a measurement frequency, and selecting one or more VXI-11 instruments. For each instrument, set its mode and provide any necessary parameters.

### 4\. View the Dashboard

Go to the "Dashboard" section and select your monitoring setup. You will see live charts and a control panel with **Start**, **Stop**, **Reset**, and **Download CSV** options.

Poxying non-VXI instruments
--------------------------

For instruments that aren't natively VXI-11, the [vxi_proxy](https://github.com/kbralten/vxi_proxy) project can be used to bridge communication. It supports SCPI, MODBUS, USBTMC, and custom instruments over network and serial connections. This allows seamless integration of a wider range of instruments into the VXI-11 Instrument Dashboard & Data Logger.

Project Structure
-----------------

-   `backend/` – FastAPI application (Poetry managed) that exposes the VXI-11 API, SQLModel persistence, and async service stubs.
-   `frontend/` – React + Vite dashboard UI with TailwindCSS and Vitest scaffolding.
-   `services/mock_instrument/` – Lightweight FastAPI mock to emulate instrument responses for local development.
-   `docker-compose.yml` – Spins up backend, frontend, and mock services together.

Backend Setup (FastAPI + Poetry)
--------------------------------

1.  `cd backend`
2.  `poetry install`
3.  `poetry run pre-commit install` *(optional but recommended)*
4.  `cp .env.example .env`
5.  `poetry run uvicorn app.main:app --reload`

Frontend Setup (React + Vite)
-----------------------------

1.  `cd frontend`
2.  `npm install`
3.  `npm run dev`

Full Stack via Docker Compose
-----------------------------

1.  Ensure Docker is running.
2.  From the project root execute `docker-compose up --build`.
3.  Access the frontend at `http://localhost:5173` and the API at `http://localhost:8000/api`.

Local Dev Helper Script (Windows)
---------------------------------

-   Run `./scripts/dev.ps1` to open dedicated PowerShell windows for the backend (Poetry + Uvicorn) and frontend (Vite dev server).

Testing & Tooling
-----------------

-   Backend: `cd backend && poetry run pytest`
-   Frontend: `cd frontend && npm run test`
-   Static Analysis: `poetry run ruff check .`, `poetry run black .`, `npm run lint`

Contributing
------------

Contributions are welcome! Please feel free to submit a pull request or open an issue to discuss proposed changes or report bugs.

License
-------

This project is licensed under the AGPL. See the `LICENSE` file for more details.