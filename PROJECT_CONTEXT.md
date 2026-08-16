# FocusYou AI Project Context

## Overview
This repository is a Flask-based productivity and study companion web app. It includes authentication, a dashboard, AI chatbot, timer, planner, progress tracker, and support for ambient soundscapes.

## Core Components
- `app.py`: Main Flask application with routes for login, register, dashboard, chatbot, timer, planner, progress, and settings.
- `create_db.py`: SQLite database schema setup script.
- `users.db`: SQLite database file storing user accounts and study session history.
- `ai_chatbot.py`: Additional AI chatbot implementation or helper module.
- `extract_assets.py`: Asset extraction utility.

## Database
Current tables:
- `users`: stores `id`, `username`, `email`, `password`.
- `study_sessions`: stores `id`, `username`, `date`, `duration_minutes`.

Removed tables:
- `subjects`
- `placement_prep`

## Templates
The `templates/` directory contains the HTML views for the app:
- `login.html`
- `register.html`
- `dashboard.html`
- `chatbot.html`
- `timer.html`
- `planner.html`
- `progress.html`
- `settings.html`
- `ai_monitor.html`
- `bunny.html`
- `streak.html`
- `xp.html`
- `Timer.html`

## Static Assets
The `static/` directory contains CSS, JavaScript, and sound files used by the UI:
- `main.css`, `dashboard.css`, `chatbot.css`, `planner.css`, `progress.css`, `timer.css`, and others
- `main.js`, `dashboard.js`, `chatbot.js`, `planner.js`, `progress.js`, `timer.js`, `ai_monitor.js`, etc.
- `sounds/` contains ambient MP3 files for the timer ambient sound feature.

## Key Features
- User login/register and session handling via Flask.
- Productivity timer with ambient sound controls.
- AI chatbot integration.
- Planner and exam/study schedule UI.
- Progress tracking for study hours and streaks.
- Static file routing via Flask's `static` directory.

## Notes
- The project is currently focused on a study productivity experience with AI-enhanced features.
- The database was cleaned up to remove the `subjects` and `placement_prep` tables.
- The `users.db` file should remain in the project root for local development.
