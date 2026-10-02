# Smart Flood Monitoring and Automated Alert System

An incremental final-year project scaffold for flood monitoring and alerts.

## Technology stack

- Frontend: Preact and JavaScript, served and built with Vite
- Backend: Node.js and Express
- Database: MySQL
- ML microservice: Python and Flask

## Project structure

```text
frontend/    Preact user interface
backend/     Express API
ml-service/  Flask microservice
database/    MySQL schema
```

## Getting started

Install frontend dependencies from `frontend/`, then run `npm run dev` to start
the Vite development server.

Install backend dependencies from `backend/`, then run `npm run dev` to start
the Express API. The health endpoint is `GET /api/health`; the default port is
3000 and can be changed with the `PORT` environment variable.

Create a Python virtual environment in `ml-service/`, install the packages in
`requirements.txt`, and run `python app.py` to start the Flask service. Its
health endpoint is `GET /health` on port 5000.

Apply `database/schema.sql` to a MySQL server to create the initial database and
tables.

This scaffold contains service entry points and an initial schema only. Model
training, data integrations, database connectivity, and alert delivery are
future implementation steps.

