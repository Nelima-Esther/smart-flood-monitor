# Smart Flood Monitoring and Automated Alert System

A Nairobi flood-monitoring dashboard with a Preact frontend, an Express API, SQLite storage and a Python machine-learning service.

## Technology stack

- Frontend: Preact and JavaScript, served and built with Vite
- Backend: Node.js and Express
- Database: SQLite (`better-sqlite3`)
- ML service: Python and Flask

## Project structure

```text
frontend/    Preact user interface
backend/     Express API and SQLite database setup
ml-service/  Flask machine-learning service and model files
```

## Getting started

You need Node.js and npm. Python is only needed if you want to run the ML service locally; the backend environment example points to the hosted ML service by default.

### 1. Start the backend

In PowerShell, open a terminal in the project folder and run:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

The API starts on `http://localhost:3000`. Its health endpoint is `http://localhost:3000/api/health`. The backend creates its SQLite database and tables automatically at `backend/database/floodwatch.db`; you do not need to install or start MySQL or manually apply a schema.

The sample `.env` uses Africa's Talking sandbox settings. Add your own provider credentials only if you want to use SMS notifications. Keep `.env` private and never commit it.

### 2. Start the frontend

Open a second terminal in the project folder:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. Create an account in the app, then sign in.

### 3. (Optional) Run the ML service locally

The backend uses the hosted ML service URL from `backend/.env` by default. To run the service on your computer, open another terminal and run:

```powershell
cd ml-service
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-api.txt
python app.py
```

Then set `ML_SERVICE_URL=http://127.0.0.1:5000` in `backend/.env` and restart the backend. The ML health endpoint is `http://127.0.0.1:5000/health`.

> **Model note:** Predictions depend on the model files and input values. The project documentation identifies some training data as synthetic/demo data, so model results should not be treated as official flood warnings.

## Database

The Express backend initializes its SQLite schema in `backend/src/database.js`. It creates `backend/database/floodwatch.db` the first time the backend starts. The database file is local runtime data and is not committed to Git.
