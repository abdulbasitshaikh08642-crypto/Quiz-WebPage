/**
 * Basit's Quiz Platform
 * Modular architecture: StorageManager, APIHandler, QuizManager, UIManager, ThemeManager, App
 */

// ==================== CONSTANTS ====================

const TOPICS = [
    { id: 9,  name: 'General Knowledge', icon: '🌍', desc: 'Test your general awareness' },
    { id: 17, name: 'Science & Nature',  icon: '🔬', desc: 'Biology, chemistry & physics' },
    { id: 18, name: 'Computers',         icon: '💻', desc: 'Tech, coding & hardware' },
    { id: 21, name: 'Sports',            icon: '⚽', desc: 'Athletics, games & champions' },
    { id: 22, name: 'Geography',         icon: '🗺️', desc: 'Countries, capitals & maps' },
    { id: 23, name: 'History',           icon: '📜', desc: 'Events that shaped the world' },
    { id: 11, name: 'Film',              icon: '🎬', desc: 'Movies, directors & stars' },
    { id: 12, name: 'Music',             icon: '🎵', desc: 'Artists, albums & genres' },
    { id: 15, name: 'Video Games',       icon: '🎮', desc: 'Gaming trivia & classics' },
    { id: 27, name: 'Animals',           icon: '🐾', desc: 'Wildlife & natural world' },
];

const ACHIEVEMENTS = [
    { id: 'first_quiz',    label: 'First Quiz',     icon: '🎉', desc: 'Complete your first quiz' },
    { id: 'perfect',       label: 'Perfect Score',  icon: '💯', desc: 'Get 100% on any quiz' },
    { id: 'speed_runner',  label: 'Speed Runner',   icon: '⚡', desc: 'Average < 5s per question' },
    { id: 'quiz_master',   label: 'Quiz Master',    icon: '🧠', desc: 'Complete 10 quizzes' },
    { id: 'hot_streak',    label: 'Hot Streak',     icon: '🔥', desc: 'Get a 5-question streak' },
    { id: 'centurion',     label: 'Centurion',      icon: '💪', desc: 'Earn 100 total points' },
    { id: 'variety',       label: 'Explorer',       icon: '🗺️', desc: 'Play 5 different topics' },
    { id: 'top_scorer',    label: 'Top Scorer',     icon: '🏆', desc: 'Score 80%+ on a hard quiz' },
];

const TIMER_DURATION = 30; // seconds per question
const BASE_POINTS = 10;

// ==================== STORAGE MANAGER ====================

const StorageManager = {
    KEY: 'basitsQuizData',

    load() {
        try {
            return JSON.parse(localStorage.getItem(this.KEY)) || this._defaultData();
        } catch {
            return this._defaultData();
        }
    },

    save(data) {
        localStorage.setItem(this.KEY, JSON.stringify(data));
    },

    _defaultData() {
        return {
            totalPoints: 0,
            bestStreak: 0,
            achievements: [],
            history: [],
            topicsPlayed: [],
        };
    },
};

// ==================== API HANDLER ====================

const APIHandler = {
    cache: {},

    async fetchQuestions(categoryId, difficulty, amount) {
        const key = `${categoryId}-${difficulty}-${amount}`;
        if (this.cache[key]) return this.cache[key];

        const url = `https://opentdb.com/api.php?amount=${amount}&category=${categoryId}&difficulty=${difficulty}&type=multiple`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Network error');
            const data = await res.json();
            if (data.response_code !== 0 || !data.results.length) throw new Error('No questions');
            const questions = data.results.map(q => ({
                question: this._decode(q.question),
                correct: this._decode(q.correct_answer),
                options: this._shuffle([q.correct_answer, ...q.incorrect_answers].map(o => this._decode(o))),
            }));
            this.cache[key] = questions;
            return questions;
        } catch {
            return this._fallback(categoryId, amount);
        }
    },

    _decode(str) {
        const txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
    },

    _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    _fallback(categoryId, amount) {
        // Use the locally bundled questions as a fallback
        const pool = typeof questions !== 'undefined' ? questions : [];
        const mapped = pool.map(q => ({
            question: q.question,
            correct: q.answer,
            options: q.options,
        }));
        if (!mapped.length) return [];
        const result = [];
        for (let i = 0; i < amount; i++) result.push(mapped[i % mapped.length]);
        return result;
    },
};

// ==================== QUIZ MANAGER ====================

const QuizManager = {
    questions: [],
    currentIndex: 0,
    score: 0,
    points: 0,
    streak: 0,
    bestStreak: 0,
    startTime: 0,
    questionStartTime: 0,
    timePerQuestion: [],
    answers: [],
    timerInterval: null,
    timeLeft: TIMER_DURATION,
    topic: null,
    difficulty: 'medium',

    async start(topic, difficulty, amount) {
        this.topic = topic;
        this.difficulty = difficulty;
        this.questions = await APIHandler.fetchQuestions(topic.id, difficulty, amount);
        if (!this.questions.length) return false;

        this.currentIndex = 0;
        this.score = 0;
        this.points = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.answers = [];
        this.timePerQuestion = [];
        this.startTime = Date.now();
        return true;
    },

    currentQuestion() {
        return this.questions[this.currentIndex];
    },

    answer(selected) {
        const q = this.currentQuestion();
        const elapsed = (Date.now() - this.questionStartTime) / 1000;
        this.timePerQuestion.push(elapsed);
        const correct = selected === q.correct;

        let earned = 0;
        if (correct) {
            this.score++;
            this.streak++;
            if (this.streak > this.bestStreak) this.bestStreak = this.streak;
            const speedBonus = Math.max(0, Math.floor(5 * (1 - elapsed / TIMER_DURATION)));
            const multiplier = this.streak >= 5 ? 1.2 : this.streak >= 3 ? 1.1 : 1.0;
            earned = Math.round((BASE_POINTS + speedBonus) * multiplier);
            this.points += earned;
        } else {
            this.streak = 0;
        }

        this.answers.push({ question: q.question, correct: q.correct, selected, wasCorrect: correct, pointsEarned: earned });
        return correct;
    },

    next() {
        this.currentIndex++;
    },

    isFinished() {
        return this.currentIndex >= this.questions.length;
    },

    totalTime() {
        return Math.round((Date.now() - this.startTime) / 1000);
    },

    avgTimePerQ() {
        if (!this.timePerQuestion.length) return TIMER_DURATION;
        return this.timePerQuestion.reduce((a, b) => a + b, 0) / this.timePerQuestion.length;
    },

    startTimer(onTick, onExpire) {
        this.timeLeft = TIMER_DURATION;
        this.questionStartTime = Date.now();
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            onTick(this.timeLeft);
            if (this.timeLeft <= 0) {
                clearInterval(this.timerInterval);
                onExpire();
            }
        }, 1000);
    },

    stopTimer() {
        clearInterval(this.timerInterval);
    },
};

// ==================== UI MANAGER ====================

const UIManager = {
    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        document.querySelectorAll('.nav-btn[data-screen]').forEach(b => {
            b.classList.toggle('active', b.dataset.screen === this._screenToNav(id));
        });
        window.scrollTo(0, 0);
    },

    _screenToNav(screenId) {
        const map = { dashboardScreen: 'dashboard', historyScreen: 'history' };
        return map[screenId] || '';
    },

    renderDashboard(data) {
        const quizzes = data.history.length;
        const avgScore = quizzes
            ? Math.round(data.history.reduce((sum, h) => sum + (h.score / h.total) * 100, 0) / quizzes)
            : 0;

        document.getElementById('totalPoints').textContent = data.totalPoints;
        document.getElementById('totalQuizzes').textContent = quizzes;
        document.getElementById('avgScore').textContent = avgScore + '%';
        document.getElementById('bestStreak').textContent = data.bestStreak;

        this.renderTopics(data);
        this.renderAchievements(data.achievements, document.getElementById('achievementsBar'));
        this.renderLeaderboard(data.history);
    },

    renderTopics(data) {
        const grid = document.getElementById('topicsGrid');
        grid.innerHTML = '';
        TOPICS.forEach(topic => {
            const played = data.history.filter(h => h.topicId === topic.id);
            const wins = played.filter(h => (h.score / h.total) >= 0.6).length;
            const card = document.createElement('div');
            card.className = 'topic-card';
            card.innerHTML = `
                <span class="topic-icon">${topic.icon}</span>
                <span class="topic-name">${topic.name}</span>
                <span class="topic-desc">${topic.desc}</span>
                <span class="topic-stats">${played.length ? `${played.length} played · ${wins}W` : 'Not played yet'}</span>
            `;
            card.addEventListener('click', () => App.startQuiz(topic));
            grid.appendChild(card);
        });
    },

    renderAchievements(unlocked, container) {
        container.innerHTML = '';
        ACHIEVEMENTS.forEach(a => {
            const isUnlocked = unlocked.includes(a.id);
            const badge = document.createElement('div');
            badge.className = `achievement-badge ${isUnlocked ? 'unlocked' : 'locked'}`;
            badge.title = a.desc;
            badge.innerHTML = `${a.icon} ${a.label}`;
            container.appendChild(badge);
        });
    },

    renderLeaderboard(history) {
        const lb = document.getElementById('leaderboard');
        if (!history.length) {
            lb.innerHTML = '<div class="leaderboard-empty">No quiz results yet. Start playing! 🎯</div>';
            return;
        }
        const top = [...history]
            .sort((a, b) => b.points - a.points)
            .slice(0, 8);
        const medals = ['🥇', '🥈', '🥉'];
        lb.innerHTML = top.map((h, i) => `
            <div class="leaderboard-row">
                <span class="lb-rank">${medals[i] || (i + 1)}</span>
                <span class="lb-topic">${h.topicName}</span>
                <span class="lb-score">${h.points} pts</span>
                <span class="lb-date">${new Date(h.date).toLocaleDateString()}</span>
            </div>
        `).join('');
    },

    renderHistory(history, topicFilter) {
        const list = document.getElementById('historyList');
        const filtered = topicFilter === 'all' ? history : history.filter(h => String(h.topicId) === topicFilter);

        if (!filtered.length) {
            list.innerHTML = '<div class="history-empty">No quiz history yet. Play some quizzes! 🎮</div>';
            return;
        }
