/**
 * MockPortal Vanilla SPA Engine
 * ----------------------------
 * Handles Routing, Authentication, and Dynamic View Rendering
 */

const App = {
    // --- Configuration & State ---
    state: {
        user: null,
        currentRoute: '',
        isLoading: true,
        quizzes: [],
        currentQuiz: null,
        activeAttempt: null,
        timerInterval: null,
        answers: {},      // persistent local answers
        markedQuestions: {}, // persistent local marks
        heartbeatInterval: null
    },

    // --- Core Initialization ---
    async init() {
        console.log("🚀 MockPortal Initializing...");
        this.cacheDOM();
        this.bindEvents();
        
        // Wait for auth check BEFORE handling initial routing
        // This prevents the "flash" or incorrect redirection to login
        await this.checkAuth();
        this.handleRouting();
    },

    cacheDOM() {
        this.mainContent = document.getElementById('main-content');
        this.navLinks = document.getElementById('nav-links');
        this.toastContainer = document.getElementById('toast-container');
    },

    bindEvents() {
        window.addEventListener('hashchange', () => this.handleRouting());
        
        // Handle global nav clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('#nav-logo')) {
                window.location.hash = '#home';
            }
        });

        // Mobile menu toggle
        const menuBtn = document.getElementById('mobile-menu-btn');
        const navLinks = document.getElementById('nav-links');
        if (menuBtn && navLinks) {
            menuBtn.addEventListener('click', () => {
                navLinks.classList.toggle('mobile-open');
            });
        }
    },

    // --- Authentication Logic ---
    async checkAuth() {
        try {
            const data = await this.api('/api/me/');
            if (data.isAuthenticated) {
                this.state.user = data.user;
            } else {
                this.state.user = null;
            }
            this.renderNav();
        } catch (err) {
            console.error("Auth check failed:", err);
        }
    },

    // --- Routing System ---
    handleRouting() {
        const hash = window.location.hash || '#home';
        this.state.currentRoute = hash;
        this.renderNav();

        // Clear any active timers when changing routes
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
        }
        if (this.state.heartbeatInterval) {
            clearInterval(this.state.heartbeatInterval);
        }

        // Apply page transition wrapper
        this.mainContent.classList.remove('visible');
        this.mainContent.classList.add('page-container');

        switch(hash) {
            case '#home': this.viewHome(); break;
            case '#login': this.viewLogin(); break;
            case '#register': this.viewRegister(); break;
            case '#dashboard': this.viewDashboard(); break;
            case '#results': this.viewResults(); break;
            default:
                if (hash.startsWith('#quiz/')) {
                    const quizId = hash.split('/')[1];
                    this.viewQuiz(quizId);
                } else if (hash.startsWith('#result/')) {
                    const attemptId = hash.split('/')[1];
                    this.viewResultDetail(attemptId);
                } else {
                    this.viewHome();
                }
        }
    },

    // --- Navigation Renderer ---
    renderNav() {
        const user = this.state.user;
        let html = `
            <a href="#home" class="${this.state.currentRoute === '#home' ? 'active' : ''}">
                <i class="fas fa-house"></i> Home
            </a>
        `;

        if (user) {
            html += `
                <a href="#dashboard" class="${this.state.currentRoute === '#dashboard' ? 'active' : ''}">
                    <i class="fas fa-gauge-high"></i> Dashboard
                </a>
                <a href="#results" class="${this.state.currentRoute === '#results' ? 'active' : ''}">
                    <i class="fas fa-chart-line"></i> My Results
                </a>
                <a href="#" id="logout-btn" class="btn-logout">
                    <i class="fas fa-sign-out-alt"></i> Logout (${user.username})
                </a>
            `;
        } else {
            html += `
                <a href="#login" class="${this.state.currentRoute === '#login' ? 'active' : ''}">Login</a>
                <a href="#register" class="btn btn-primary btn-sm" style="padding: 0.5rem 1rem;">Get Started</a>
            `;
        }

        this.navLinks.innerHTML = html;

        // Trigger fade-in for main content after navigation update
        setTimeout(() => this.mainContent.classList.add('visible'), 50);

        // Logout listener
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = async (e) => {
                e.preventDefault();
                await this.api('/api/logout/', { method: 'POST' });
                this.state.user = null;
                this.showToast('Logged out successfully', 'success');
                window.location.hash = '#home';
                this.renderNav();
            };
        }
    },

    // --- VIEWS ---

    async viewHome() {
        this.showLoader();
        const data = await this.api('/api/home_quiz/');
        
        let heroHtml = `
            <div class="hero">
                <h1>Master Your Exams</h1>
                <p>The most advanced platform for competitive exam preparation. Real-time testing, deep analytics, and premium content.</p>
                <div class="hero-actions">
                    ${this.state.user ? 
                        `<a href="#dashboard" class="btn btn-primary">Go to Dashboard <i class="fas fa-arrow-right"></i></a>` :
                        `<a href="#register" class="btn btn-primary">Join Now <i class="fas fa-sparkles"></i></a>
                         <a href="#login" class="btn btn-outline" style="margin-left: 1rem;">Login <i class="fas fa-sign-in-alt"></i></a>`
                    }
                </div>
            </div>
        `;

        if (data.quiz) {
            const q = data.quiz;
            heroHtml += `
                <section class="featured-quiz">
                    <h2 style="text-align: center; margin-bottom: 2rem;">Featured Mock Test</h2>
                    <div class="quiz-card glass" style="max-width: 600px; margin: 0 auto; padding: 2.5rem;">
                        <span class="difficulty ${q.difficulty.toLowerCase()}">${q.difficulty}</span>
                        <h3>${q.title}</h3>
                        <p style="color: var(--text-muted); margin: 1rem 0;">${q.description}</p>
                        <a href="#quiz/${q.id}" class="btn btn-accent" style="width: 100%;">Start Free Practice <i class="fas fa-play"></i></a>
                    </div>
                </section>
            `;
        }

        this.mainContent.innerHTML = heroHtml;
    },

    viewLogin() {
        if (this.state.user) { window.location.hash = '#dashboard'; return; }
        this.mainContent.innerHTML = `
            <div class="container-narrow">
                <div class="card glass">
                    <h2 style="margin-bottom: 0.5rem;">Welcome Back</h2>
                    <p style="color: var(--text-muted); margin-bottom: 2rem;">Login to continue your journey.</p>
                    
                    <form id="login-form">
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" name="username" class="input-glass" placeholder="Enter your username" required>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" name="password" class="input-glass" placeholder="••••••••" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
                            Login <i class="fas fa-sign-in-alt"></i>
                        </button>
                    </form>
                    <p style="text-align: center; margin-top: 1.5rem; font-size: 0.9rem; color: var(--text-muted);">
                        Don't have an account? <a href="#register" style="color: var(--primary); text-decoration: none; font-weight: 700;">Join now</a>
                    </p>
                </div>
            </div>
        `;

        document.getElementById('login-form').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const body = Object.fromEntries(formData.entries());
            
            try {
                const res = await this.api('/api/login/', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                this.state.user = res.user;
                this.showToast('Login successful!', 'success');
                window.location.hash = '#dashboard';
            } catch (err) {
                this.showToast(err.message || 'Invalid credentials', 'error');
            }
        };
    },

    viewRegister() {
        if (this.state.user) { window.location.hash = '#dashboard'; return; }
        this.mainContent.innerHTML = `
            <div class="container-narrow">
                <div class="card glass">
                    <h2 style="margin-bottom: 0.5rem;">Create Account</h2>
                    <p style="color: var(--text-muted); margin-bottom: 2rem;">Join thousands of students and excel.</p>
                    
                    <form id="register-form">
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" name="username" class="input-glass" placeholder="Pick a username" required>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" name="password" class="input-glass" placeholder="••••••••" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
                            Create Account <i class="fas fa-user-plus"></i>
                        </button>
                    </form>
                    <p style="text-align: center; margin-top: 1.5rem; font-size: 0.9rem; color: var(--text-muted);">
                        Already have an account? <a href="#login" style="color: var(--primary); text-decoration: none; font-weight: 700;">Login here</a>
                    </p>
                </div>
            </div>
        `;

        document.getElementById('register-form').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const body = Object.fromEntries(formData.entries());
            
            try {
                const res = await this.api('/api/register/', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                this.showToast(res.message, 'success');
                window.location.hash = '#login';
            } catch (err) {
                this.showToast(err.message || 'Registration failed', 'error');
            }
        };
    },

    async viewDashboard() {
        if (!this.state.user) { window.location.hash = '#login'; return; }
        this.showLoader();
        
        try {
            const [quizData, statsData] = await Promise.all([
                this.api('/api/quizzes/'),
                this.api('/api/stats/')
            ]);

            const stats = statsData;
            const lastActivity = stats.last_activity
                ? new Date(stats.last_activity).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Never';

            let html = `
                <div class="dashboard-header">
                    <div>
                        <h1 class="dashboard-title">Welcome back, <span class="gradient-text">${this.state.user.username}</span> 👋</h1>
                        <p style="color: var(--text-muted); margin-top: 0.5rem;">Track your performance and take mock tests below.</p>
                    </div>
                    <a href="#results" class="btn btn-outline" style="white-space: nowrap;">
                        <i class="fas fa-chart-line"></i> View All Results
                    </a>
                </div>

                <div class="stats-grid">
                    <div class="stat-card glass">
                        <div class="stat-icon" style="background: rgba(79,70,229,0.2); color: var(--primary);"><i class="fas fa-pen-to-square"></i></div>
                        <div class="stat-value">${stats.total_attempts}</div>
                        <div class="stat-label">Tests Taken</div>
                    </div>
                    <div class="stat-card glass">
                        <div class="stat-icon" style="background: rgba(16,185,129,0.2); color: var(--accent);"><i class="fas fa-bullseye"></i></div>
                        <div class="stat-value">${stats.average_score_pct}%</div>
                        <div class="stat-label">Avg. Score</div>
                    </div>
                    <div class="stat-card glass">
                        <div class="stat-icon" style="background: rgba(245,158,11,0.2); color: var(--warning);"><i class="fas fa-trophy"></i></div>
                        <div class="stat-value">${stats.pass_rate_pct}%</div>
                        <div class="stat-label">Pass Rate</div>
                    </div>
                    <div class="stat-card glass">
                        <div class="stat-icon" style="background: rgba(139,92,246,0.2); color: #8b5cf6;"><i class="fas fa-calendar-check"></i></div>
                        <div class="stat-value" style="font-size: 1.1rem;">${lastActivity}</div>
                        <div class="stat-label">Last Activity</div>
                    </div>
                </div>

                <h2 style="font-size: 1.75rem; margin-bottom: 1.5rem; margin-top: 3rem;">Available Mock Tests</h2>
                <div class="quiz-grid">
            `;

            if (quizData.quizzes.length === 0) {
                html += `
                    <div class="card glass" style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                        <i class="fas fa-book-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem; display: block;"></i>
                        <h3>No Tests Available</h3>
                        <p style="color: var(--text-muted); margin-top: 0.5rem;">Check back soon — the admin will publish tests shortly.</p>
                    </div>
                `;
            } else {
                quizData.quizzes.forEach(q => {
                    // Status badge and action button based on attempt status
                    let statusBadge = '';
                    let actionBtn = '';
                    switch(q.status) {
                        case 'in_progress':
                            statusBadge = `<span style="background:rgba(245,158,11,0.15);color:var(--warning);border:1px solid var(--warning);border-radius:20px;padding:3px 10px;font-size:0.75rem;font-weight:600;"><i class="fas fa-spinner fa-pulse"></i> In Progress</span>`;
                            actionBtn = `<a href="#quiz/${q.id}" class="btn btn-primary" style="width:100%;"><i class="fas fa-redo"></i> Resume Test</a>`;
                            break;
                        case 'completed_pending':
                            statusBadge = `<span style="background:rgba(79,70,229,0.15);color:var(--primary);border:1px solid var(--primary);border-radius:20px;padding:3px 10px;font-size:0.75rem;font-weight:600;"><i class="fas fa-hourglass-half"></i> Result Pending</span>`;
                            actionBtn = `<a href="#result/${q.attempt_id}" class="btn btn-outline" style="width:100%;"><i class="fas fa-eye"></i> View Responses</a>`;
                            break;
                        case 'completed_published':
                            statusBadge = `<span style="background:rgba(16,185,129,0.15);color:var(--success);border:1px solid var(--success);border-radius:20px;padding:3px 10px;font-size:0.75rem;font-weight:600;"><i class="fas fa-check-circle"></i> Result Published</span>`;
                            actionBtn = `<a href="#result/${q.attempt_id}" class="btn btn-accent" style="width:100%;"><i class="fas fa-chart-bar"></i> View Result</a>`;
                            break;
                        default: // not_attempted
                            statusBadge = `<span style="background:rgba(100,116,139,0.15);color:var(--text-muted);border:1px solid var(--glass-border);border-radius:20px;padding:3px 10px;font-size:0.75rem;font-weight:600;"><i class="fas fa-circle-dot"></i> Not Attempted</span>`;
                            actionBtn = `<a href="#quiz/${q.id}" class="btn btn-primary" style="width:100%;">Start Test <i class="fas fa-play"></i></a>`;
                    }
                    html += `
                        <div class="quiz-card card glass">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                                <span class="difficulty ${q.difficulty.toLowerCase()}">${q.difficulty}</span>
                                ${statusBadge}
                            </div>
                            <h3>${q.title}</h3>
                            <p style="color: var(--text-muted); margin: 1rem 0; font-size: 0.9rem;">${q.description || 'No description provided.'}</p>
                            <div style="display: flex; gap: 15px; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem;">
                                <span><i class="fas fa-clock"></i> ${q.time_limit} min</span>
                            </div>
                            ${actionBtn}
                        </div>
                    `;
                });
            }

            html += `</div>`;
            this.mainContent.innerHTML = html;
        } catch (err) {
            console.error("Dashboard failed:", err);
            this.renderError("Failed to load dashboard data. " + err.message);
        }
    },

    async viewQuiz(quizId) {
        this.showLoader();

        try {
            const data = await this.api(`/api/quizzes/${quizId}/attempt/`);
            
            // Handle login requirement
            if (data.error && data.error === 'Login required for this test') {
                 this.showToast('Login required for this test', 'info');
                 window.location.hash = '#login';
                 return;
            }
            
            // Handle already attempted
            if (data.already_attempted) {
                this.mainContent.innerHTML = `
                    <div class="container-narrow">
                        <div class="card glass" style="text-align: center; padding: 4rem 2rem;">
                            <div style="font-size: 4rem; margin-bottom: 1.5rem;">✅</div>
                            <h2 style="margin-bottom: 1rem;">Mock Test Attempted</h2>
                            <p style="color: var(--text-muted); margin-bottom: 2rem;">
                                You have already completed an attempt for <strong>${data.message || 'this test'}</strong>. 
                                In our system, only one attempt is permitted per mock test.
                            </p>
                            <div style="display: flex; gap: 1rem; justify-content: center;">
                                <a href="#dashboard" class="btn btn-outline">Back to Dashboard</a>
                                <a href="#result/${data.attempt_id}" class="btn btn-primary">View My Result</a>
                            </div>
                        </div>
                    </div>
                `;
                return;
            }

            this.renderQuizEngine(data);
        } catch (err) {
            this.showToast(err.message, 'error');
            window.location.hash = '#dashboard';
        }
    },

    renderQuizEngine(data) {
        const { quiz, questions, time_remaining_ms, attempt_id } = data;
        let html = `
            <div class="quiz-container">
                <div class="quiz-main">
                    <div id="question-container">
                        ${this.renderQuestion(questions[0], 0, questions.length)}
                    </div>
                </div>
                <aside class="quiz-nav-panel">
                    <div class="card glass">
                        <div id="quiz-timer" class="timer-box">00:00</div>
                        <h4 style="margin-bottom: 1rem; font-size: 0.9rem;">Question Progress</h4>
                        <div class="question-dots">
                            ${questions.map((_, i) => `<div class="dot ${i === 0 ? 'current' : ''}" data-idx="${i}">${i+1}</div>`).join('')}
                        </div>
                        <hr style="border: 0; border-top: 1px solid var(--glass-border); margin: 1.5rem 0;">
                        <button id="view-paper-btn" class="btn btn-outline" style="width: 100%; margin-bottom: 0.5rem;"><i class="fas fa-file-lines"></i> Question Paper</button>
                        <button id="final-submit" class="btn btn-primary" style="width: 100%;">Finish Attempt</button>
                    </div>
                </aside>
            </div>
        `;

        this.mainContent.innerHTML = html;
        
        // Quiz Engine State
        let currentIdx = 0;
        const answers = data.saved_answers || {}; 
        let timeUpFired = false;  // Prevent multiple "time up" submissions
        
        // Timer Logic
        let remaining = Math.floor(time_remaining_ms / 1000);
        const timerEl = document.getElementById('quiz-timer');
        
        const updateTimer = () => {
            const m = Math.floor(remaining / 60);
            const s = remaining % 60;
            timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            if (remaining <= 0 && !timeUpFired) {
                timeUpFired = true;
                clearInterval(this.state.timerInterval);
                this.submitQuiz(quiz.id, attempt_id, answers, true);
            }
            remaining--;
        };
        
        updateTimer();
        this.state.timerInterval = setInterval(updateTimer, 1000);

        // Heartbeat logic
        const sendHeartbeat = async () => {
            try {
                await this.api(`/api/quizzes/${quiz.id}/heartbeat/`, {
                    method: 'POST',
                    body: JSON.stringify({ remaining_seconds: remaining })
                });
            } catch (err) { console.error("Heartbeat failed:", err); }
        };
        this.state.heartbeatInterval = setInterval(sendHeartbeat, 30000); // every 30s

        // Bind Controls
        const refreshQuestion = () => {
            document.getElementById('question-container').innerHTML = this.renderQuestion(questions[currentIdx], currentIdx, questions.length, answers);
            
            // Update dots
            document.querySelectorAll('.dot').forEach((d, i) => {
                const q_id = questions[i].id;
                d.classList.toggle('current', i === currentIdx);
                d.classList.toggle('answered', !!(answers[q_id] && answers[q_id].choice_id));
                d.classList.toggle('marked', !!(answers[q_id] && answers[q_id].is_marked));
            });
        };

        const saveAndNext = async () => {
             const selected = document.querySelector('input[name="question-active"]:checked');
             const qId = questions[currentIdx].id;
             
             if (selected) {
                 if (!answers[qId]) answers[qId] = { is_marked: false };
                 answers[qId].choice_id = selected.value;
                 
                 // API Save
                 try {
                     await this.api(`/api/quizzes/${quiz.id}/save_answer/`, {
                         method: 'POST',
                         body: JSON.stringify({
                             question_id: qId,
                             choice_id: selected.value,
                             is_marked_for_review: answers[qId].is_marked
                         })
                     });
                 } catch (err) { console.error("Auto-save failed:", err); }
             }
             
             // Wrap around: after last question, go back to first
             const nextIdx = (currentIdx + 1) % questions.length;
             
             // Trigger a heartbeat occasionally when saving
             if (currentIdx % 3 === 0) sendHeartbeat();

             currentIdx = nextIdx;
             refreshQuestion();
        };

        this.mainContent.onclick = (e) => {
            const target = e.target;
            
            if (target.id === 'save-next-btn' || target.closest('#save-next-btn')) {
                saveAndNext();
            }

            if (target.id === 'prev-btn' || target.closest('#prev-btn')) {
                currentIdx = (currentIdx - 1 + questions.length) % questions.length;
                refreshQuestion();
            }

            if (target.classList.contains('dot')) {
                currentIdx = parseInt(target.dataset.idx);
                refreshQuestion();
            }

            if (target.id === 'final-submit') {
                this.showSubmitConfirmation(quiz, questions, answers, data);
            }

            if (target.id === 'view-paper-btn') {
                this.showQuestionPaper(quiz, questions);
            }

            if (target.closest('.btn-mark-review')) {
                const qId = questions[currentIdx].id;
                if (!answers[qId]) answers[qId] = { choice_id: null, is_marked: false };
                answers[qId].is_marked = !answers[qId].is_marked;
                
                this.api(`/api/quizzes/${quiz.id}/save_answer/`, {
                    method: 'POST',
                    body: JSON.stringify({
                        question_id: qId,
                        choice_id: answers[qId].choice_id,
                        is_marked_for_review: answers[qId].is_marked
                    })
                });
                refreshQuestion();
            }
        };

        // Real-time selection feedback
        this.mainContent.addEventListener('change', (e) => {
            if (e.target.name === 'question-active') {
                const labels = this.mainContent.querySelectorAll('.choice-label');
                labels.forEach(l => l.classList.remove('selected'));
                e.target.closest('.choice-label').classList.add('selected');
                
                // Track in local state
                const qId = questions[currentIdx].id;
                if (!answers[qId]) answers[qId] = { is_marked: false };
                answers[qId].choice_id = e.target.value;
            }
        });
    },

    renderQuestion(q, idx, total, answers = {}) {
        const isMarked = answers[q.id]?.is_marked;
        const currentChoice = answers[q.id]?.choice_id;
        return `
            <div class="question-card card glass">
                <header style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--primary); font-weight: 700; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">Question ${idx+1} of ${total}</span>
                    <span style="color: var(--text-muted); font-size: 0.8rem;">${q.marks} Mark(s)</span>
                </header>
                <h2 style="font-size: 1.15rem; line-height: 1.3; margin-bottom: 1rem;">${q.text}</h2>
                <div class="choices" style="display: grid; gap: 0.5rem;">
                    ${q.choices.map(c => `
                        <label class="choice-label ${currentChoice == c.id ? 'selected' : ''}">
                            <input type="radio" name="question-active" value="${c.id}" ${currentChoice == c.id ? 'checked' : ''}>
                            <span class="choice-radio"></span>
                            <span class="choice-text">${c.text}</span>
                        </label>
                    `).join('')}
                </div>
                <footer style="margin-top: 1.5rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                    <button class="btn btn-mark-review ${isMarked ? 'marked' : ''}" style="flex: 1; min-width: 150px;">
                        <i class="fas fa-bookmark"></i> ${isMarked ? 'Marked' : 'Mark for Review'}
                    </button>
                    <div style="display: flex; gap: 0.5rem; flex: 2; min-width: 250px;">
                        ${idx > 0 ? `<button id="prev-btn" class="btn btn-outline" style="flex: 1;">Previous</button>` : '<div></div>'}
                        <button id="save-next-btn" class="btn btn-primary" style="flex: 1.5;">Save & Next <i class="fas fa-chevron-right"></i></button>
                    </div>
                </footer>
            </div>
        `;
    },

    showQuestionPaper(quiz, questions) {
        const overlay = document.getElementById('modal-overlay');
        const body = document.getElementById('modal-body');
        const close = document.getElementById('modal-close');

        body.innerHTML = questions.map((q, i) => `
            <div class="paper-question">
                <div class="paper-q-header">QUESTION ${i+1} (${q.marks} Marks)</div>
                <div class="paper-q-text">${q.text}</div>
                <div class="paper-choices">
                    ${q.choices.map(c => `<div class="paper-choice">${c.text}</div>`).join('')}
                </div>
            </div>
        `).join('');

        overlay.classList.add('active');
        close.onclick = () => overlay.classList.remove('active');
        overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove('active'); };
    },

    showSubmitConfirmation(quiz, questions, answers, fullData) {
        const total = questions.length;
        const answeredCount = Object.values(answers).filter(a => a.choice_id).length;
        const markedCount = Object.values(answers).filter(a => a.is_marked).length;
        const unanswered = total - answeredCount;

        const overlay = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const close = document.getElementById('modal-close');

        modalTitle.textContent = 'Submit Test?';
        body.innerHTML = `
            <div style="text-align:center;">
                <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
                <h3 style="margin-bottom:0.5rem;">Are you sure you want to submit?</h3>
                <p style="color:var(--text-muted);margin-bottom:1.5rem;">Once submitted, you <strong>cannot</strong> change your answers.</p>

                <div class="summary-grid" style="margin-bottom:1.5rem;">
                    <div class="summary-item glass">
                        <span class="count">${total}</span>
                        <span class="label">Total</span>
                    </div>
                    <div class="summary-item glass" style="border-bottom:3px solid var(--accent);">
                        <span class="count" style="color:var(--accent);">${answeredCount}</span>
                        <span class="label">Answered</span>
                    </div>
                    <div class="summary-item glass" style="border-bottom:3px solid var(--warning);">
                        <span class="count" style="color:var(--warning);">${markedCount}</span>
                        <span class="label">Marked</span>
                    </div>
                    <div class="summary-item glass" style="border-bottom:3px solid var(--danger);">
                        <span class="count" style="color:var(--danger);">${unanswered}</span>
                        <span class="label">Unanswered</span>
                    </div>
                </div>

                ${unanswered > 0 ? `<p style="color:var(--danger);font-weight:600;margin-bottom:1rem;"><i class="fas fa-exclamation-triangle"></i> You have ${unanswered} unanswered question(s)!</p>` : ''}

                <div style="display:flex;gap:1rem;justify-content:center;">
                    <button id="cancel-submit-btn" class="btn btn-outline" style="flex:1;">Go Back</button>
                    <button id="confirm-submit-btn" class="btn btn-primary" style="flex:1;"><i class="fas fa-paper-plane"></i> Submit Now</button>
                </div>
            </div>
        `;

        overlay.classList.add('active');

        // Go Back — close modal, stay on quiz
        document.getElementById('cancel-submit-btn').onclick = () => {
            overlay.classList.remove('active');
        };
        close.onclick = () => overlay.classList.remove('active');

        // Confirm Submit
        document.getElementById('confirm-submit-btn').onclick = () => {
            overlay.classList.remove('active');
            this.submitQuiz(quiz.id, null, answers);
        };
    },

    async submitQuiz(quizId, attemptId, answers, isAuto = false) {
        this.showLoader();
        if (this.state.timerInterval) clearInterval(this.state.timerInterval);
        if (this.state.heartbeatInterval) clearInterval(this.state.heartbeatInterval);
        
        try {
            const cleanAnswers = {};
            for (const [qId, data] of Object.entries(answers)) {
                // Handle both objects {choice_id: ...} and direct values from string/int
                const choiceId = (typeof data === 'object' && data !== null) ? data.choice_id : data;
                if (choiceId) cleanAnswers[qId] = choiceId;
            }

            const res = await this.api(`/api/quizzes/${quizId}/attempt/`, {
                method: 'POST',
                body: JSON.stringify({ answers: cleanAnswers })
            });
            this.showToast(isAuto ? 'Time up! Quiz submitted automatically.' : 'Quiz submitted successfully!', 'success');
            window.location.hash = `#result/${res.attempt_id}`;
        } catch (err) {
            this.showToast('Submission error', 'error');
        }
    },

    async viewResults() {
        if (!this.state.user) { window.location.hash = '#login'; return; }
        this.showLoader();
        
        try {
            const data = await this.api('/api/results/');
            let html = `
                <h2 style="margin-bottom: 2rem; font-size: 2.5rem;">Performance Dashboard</h2>
                <div class="card glass" style="padding: 0; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead style="background: rgba(255,255,255,0.05);">
                            <tr>
                                <th style="padding: 1.5rem;">Test Name</th>
                                <th style="padding: 1.5rem;">Score</th>
                                <th style="padding: 1.5rem;">Date</th>
                                <th style="padding: 1.5rem;">Result</th>
                                <th style="padding: 1.5rem;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            data.results.forEach(r => {
                const date = new Date(r.start_time).toLocaleDateString();
                html += `
                    <tr style="border-top: 1px solid var(--glass-border);">
                        <td style="padding: 1.5rem; font-weight: 600;">${r.quiz_title}</td>
                        <td style="padding: 1.5rem;">${r.results_activated ? `${r.score} / ${r.total_marks}` : '---'}</td>
                        <td style="padding: 1.5rem; color: var(--text-muted); font-size: 0.9rem;">${date}</td>
                        <td style="padding: 1.5rem;">
                            <span class="status-badge ${r.results_activated ? 'status-active' : 'status-pending'}">
                                ${r.results_activated ? 'ACTIVE' : 'PENDING'}
                            </span>
                        </td>
                        <td style="padding: 1.5rem;">
                            <a href="#result/${r.id}" class="btn btn-outline" style="padding: 0.4rem 1rem; font-size: 0.8rem;">Review</a>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table></div>`;
            if (data.results.length === 0) {
                html = `<div class="card glass" style="text-align: center; padding: 4rem;"><h3>No attempts found yet.</h3><p>Take a mock test to see your performance here.</p></div>`;
            }
            this.mainContent.innerHTML = html;
        } catch (err) {
            console.error("Results List failed:", err);
            this.renderError("Failed to load results history. " + err.message);
        }
    },

    async viewResultDetail(attemptId) {
        this.showLoader();
        try {
            const data = await this.api(`/api/results/${attemptId}/`);
            
            let html = `
                <div style="margin-bottom: 2rem;">
                    <a href="#results" style="color: var(--text-muted); text-decoration: none; font-size: 0.9rem;"><i class="fas fa-arrow-left"></i> Back to Dashboard</a>
                </div>

                <div class="result-banner">
                    <div class="score-card">
                        <div class="score-radial">
                            ${data.results_activated ? `
                                <span class="score-val">${data.score}</span>
                                <span class="score-total">/ ${data.total_marks}</span>
                            ` : `
                                <span class="score-val" style="font-size: 1.5rem;">PENDING</span>
                            `}
                        </div>
                        <p>${data.results_activated ? 'Net Score' : 'Submission Received'}</p>
                    </div>
                    <div class="result-info">
                        <h1>${data.quiz.title}</h1>
                        <p class="text-muted">Completed in ${Math.floor(data.time_taken_seconds / 60)}m ${Math.floor(data.time_taken_seconds % 60)}s</p>
                        <div class="stats-row mt-3">
                            <div class="stat-badge"><i class="fas fa-trophy"></i> Rank ${data.rank} / ${data.total_participants}</div>
                            ${data.results_activated ? `<div class="stat-badge"><i class="fas fa-bullseye"></i> ${data.percentage}% Score</div>` : ''}
                        </div>
                        ${!data.results_activated ? `
                            <div class="review-hint mt-3">
                                <i class="fas fa-info-circle"></i> Results not yet declared by admin. You can review your responses below. Rank shown is live.
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Summary Stats Grid -->
                <div class="summary-grid" style="margin-top: 2rem; margin-bottom: 2rem;">
                    <div class="summary-item glass">
                        <span class="count">${data.questions.length}</span>
                        <span class="label">Total Questions</span>
                    </div>
                    <div class="summary-item glass" style="border-bottom: 3px solid var(--primary);">
                        <span class="count" style="color: var(--primary);">${data.total_attempted}</span>
                        <span class="label">Attempted</span>
                    </div>
                    <div class="summary-item glass" style="border-bottom: 3px solid var(--accent);">
                        <span class="count" style="color: var(--accent);">${data.total_correct ?? '—'}</span>
                        <span class="label">Correct</span>
                    </div>
                    <div class="summary-item glass" style="border-bottom: 3px solid var(--danger);">
                        <span class="count" style="color: var(--danger);">${data.total_wrong}</span>
                        <span class="label">Wrong</span>
                    </div>
                    <div class="summary-item glass" style="border-bottom: 3px solid var(--warning);">
                        <span class="count" style="color: var(--warning);">-${data.negative_marks}</span>
                        <span class="label">Negative Marks</span>
                    </div>
                    ${data.results_activated ? `
                    <div class="summary-item glass" style="border-bottom: 3px solid var(--success);">
                        <span class="count" style="color: var(--success);">${data.net_marks}</span>
                        <span class="label">Net Marks</span>
                    </div>` : ''}
                </div>

                <div class="questions-review mt-4">
                    ${data.questions.map((q, i) => {
                        // Determine status for this question
                        let statusBadge = '';
                        if (!q.user_choice_id) {
                            statusBadge = `<span style="background: rgba(245,158,11,0.15); color: var(--warning); border: 1px solid var(--warning); border-radius: 20px; padding: 3px 12px; font-size: 0.78rem; font-weight: 600;"><i class="fas fa-minus-circle"></i> Not Answered</span>`;
                        } else if (data.results_activated) {
                            if (q.is_correct) {
                                statusBadge = `<span style="background: rgba(16,185,129,0.15); color: var(--success); border: 1px solid var(--success); border-radius: 20px; padding: 3px 12px; font-size: 0.78rem; font-weight: 600;"><i class="fas fa-check-circle"></i> Correct</span>`;
                            } else {
                                statusBadge = `<span style="background: rgba(239,68,68,0.15); color: var(--danger); border: 1px solid var(--danger); border-radius: 20px; padding: 3px 12px; font-size: 0.78rem; font-weight: 600;"><i class="fas fa-times-circle"></i> Wrong</span>`;
                            }
                        } else {
                            statusBadge = `<span style="background: rgba(79,70,229,0.15); color: var(--primary); border: 1px solid var(--primary); border-radius: 20px; padding: 3px 12px; font-size: 0.78rem; font-weight: 600;"><i class="fas fa-check"></i> Answered</span>`;
                        }

                        return `
                            <div class="review-card card glass">
                                <div class="review-q-header">
                                    <span>Question ${i+1}</span>
                                    <div style="display:flex; align-items:center; gap: 10px;">
                                        ${statusBadge}
                                        <span class="review-marks">${q.marks} Marks</span>
                                    </div>
                                </div>
                                <p class="review-text">${q.text}</p>
                                
                                <div class="choices-review mt-3" style="display: grid; gap: 0.5rem;">
                                    ${q.choices.map(c => {
                                        const isSelected = String(q.user_choice_id) === String(c.id);
                                        const isCorrect = data.results_activated && c.is_correct;
                                        const isWrongSelection = data.results_activated && isSelected && !c.is_correct;
                                        
                                        let classes = 'choice-label';
                                        if (isSelected) classes += ' user-selected';
                                        if (isCorrect) classes += ' review-correct';
                                        if (isWrongSelection) classes += ' review-wrong';
                                        
                                        return `
                                            <div class="${classes}" style="position: relative;">
                                                <span class="choice-text">${c.text}</span>
                                                ${isSelected && !isCorrect ? '<i class="fas fa-times" style="position:absolute;right:15px;top:50%;transform:translateY(-50%);color:var(--danger);"></i>' : ''}
                                                ${isSelected && isCorrect ? '<i class="fas fa-check-double" style="position:absolute;right:15px;top:50%;transform:translateY(-50%);color:var(--success);"></i>' : ''}
                                                ${isCorrect && !isSelected ? '<i class="fas fa-check" style="position:absolute;right:15px;top:50%;transform:translateY(-50%);color:var(--success);"></i>' : ''}
                                            </div>
                                        `;
                                    }).join('')}
                                </div>

                                ${data.results_activated && q.user_choice_id ? `
                                    <div class="mt-3" style="display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:0.6rem 0.8rem;background:rgba(0,0,0,0.15);border-radius:6px;">
                                        ${q.is_correct
                                            ? `<span style="color:var(--success);font-weight:600;"><i class="fas fa-check-circle"></i> Correct</span><span class="badge" style="background:var(--success);">+${q.awarded_marks} Marks</span>`
                                            : `<span style="color:var(--danger);font-weight:600;"><i class="fas fa-times-circle"></i> Wrong</span><span class="badge" style="background:var(--danger);">${q.awarded_marks} Marks</span>`
                                        }
                                    </div>
                                ` : ''}

                                ${!q.user_choice_id ? `
                                    <div class="mt-3" style="padding:0.75rem;background:rgba(245,158,11,0.08);border-left:3px solid var(--warning);border-radius:4px;">
                                        <em style="color:var(--warning);font-size:0.9rem;font-weight:600;"><i class="fas fa-exclamation-circle"></i> Not Answered — 0 Marks</em>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            this.mainContent.innerHTML = html;
        } catch (err) {
            this.showToast('Error loading result detail', 'error');
        }
    },

    // --- Helpers ---

    showLoader(type = 'default') {
        if (type === 'skeleton-dashboard') {
            this.mainContent.innerHTML = `
                <div class="skeleton-heading skeleton"></div>
                <div class="stats-grid">
                    <div class="skeleton-stat skeleton"></div>
                    <div class="skeleton-stat skeleton"></div>
                    <div class="skeleton-stat skeleton"></div>
                    <div class="skeleton-stat skeleton"></div>
                </div>
                <div class="skeleton-heading skeleton" style="margin-top: 3rem;"></div>
                <div class="quiz-grid">
                    <div class="skeleton-card skeleton"></div>
                    <div class="skeleton-card skeleton"></div>
                    <div class="skeleton-card skeleton"></div>
                </div>
            `;
            return;
        }
        this.mainContent.innerHTML = `
            <div class="loader-container">
                <div class="premium-loader"></div>
            </div>
        `;
    },

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        this.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },

    renderError(message) {
        this.mainContent.innerHTML = `
            <div class="error-container" style="text-align: center; padding: 4rem 2rem;">
                <div class="error-icon" style="font-size: 4rem; color: var(--danger); margin-bottom: 1.5rem;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2 style="margin-bottom: 1rem;">Something went wrong</h2>
                <p style="color: var(--text-dim); margin-bottom: 2rem; max-width: 500px; margin-left: auto; margin-right: auto;">
                    ${message || "We encountered an error while loading this page. Please check your connection or try again later."}
                </p>
                <button class="btn btn-primary" onclick="window.location.reload()">
                    <i class="fas fa-redo"></i> Refresh Page
                </button>
            </div>
        `;
        this.mainContent.classList.add('visible');
    },

    async api(url, options = {}) {
        const defaults = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCookie('csrftoken')
            }
        };
        
        try {
            const response = await fetch(url, { ...defaults, ...options });
            const contentType = response.headers.get('content-type');
            
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                console.error(`Non-JSON response from ${url}:`, text.substring(0, 500));
                throw new Error(`Server returned non-JSON response (Status ${response.status})`);
            }

            if (!response.ok) {
                console.error(`API Error [${url}] Status ${response.status}:`, data.error || data);
                throw new Error(data.error || `Request failed with status ${response.status}`);
            }
            return data;
        } catch (err) {
            console.error(`Fetch Error [${url}]:`, err.message);
            throw err;
        }
    },

    getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
};

// Start the App
document.addEventListener('DOMContentLoaded', () => App.init());
