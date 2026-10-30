# MockPortal - Online Mock Test & Quiz Platform

A full-featured online quiz and mock examination web application built with **Django** and styled with **Jazzmin**.

---

## 🚀 Features

- **Modern Single-Page Quiz Interface**: Clean, distraction-free interface for test-takers with question navigation, timer countdown, review flags, and instant scoring.
- **Admin Dashboard**: Powered by Django Jazzmin dark theme with custom styling for easy test and question management.
- **Bulk Upload**: Import questions in bulk directly from the admin panel.
- **Configurable Tests**:
  - Time limits
  - Passing scores
  - Negative marking
  - Difficulty levels
  - Guest access vs. Login-required tests
- **Comprehensive Database Fixtures**: Pre-configured sample quizzes provided via `quiz_data.json`.

---

## 🛠️ Tech Stack

- **Backend**: Python 3, Django
- **Admin UI**: Django Jazzmin
- **Database**: SQLite (default, easily switchable to PostgreSQL/MySQL)
- **Frontend**: Django Templates, CSS3, Vanilla JS

---

## 💻 Local Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/mock_website.git
cd mock_website
```

### 2. Create and activate a virtual environment
**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Run database migrations
```bash
python manage.py migrate
```

### 5. Load initial quiz data
```bash
python manage.py loaddata quiz_data.json
```

### 6. Create an administrator account
```bash
python manage.py createsuperuser
```

### 7. Start the development server
```bash
python manage.py runserver
```

Open your browser at `http://127.0.0.1:8000/` for the quiz portal, or `http://127.0.0.1:8000/admin/` for the admin dashboard.

---

## 🌐 Deployment / Hosting

> **Note on GitHub Pages:** GitHub Pages is designed for static websites (HTML/CSS/JS) and cannot run a Python/Django backend or SQLite database.
> 
> To host this application live on the internet, connect this GitHub repository to any of the following free or low-cost cloud platforms:
> - **[Render](https://render.com/)** (Recommended: supports automated GitHub deploys)
> - **[PythonAnywhere](https://www.pythonanywhere.com/)** (Beginner-friendly for Django)
> - **[Railway](https://railway.app/)**
