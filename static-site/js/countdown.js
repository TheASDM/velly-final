class SessionCountdown {
    constructor() {
        this.nextSessionDate = new Date('2026-01-20T19:00:00');
        this.intervalId = null;
    }
    init() {
        this.updateDisplay();
        this.startTimer();
    }
    startTimer() {
        this.updateDisplay();
        this.intervalId = setInterval(() => {
            this.updateDisplay();
        }, 1000);
    }
    stopTimer() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    updateDisplay() {
        const sessionInfoDiv = document.getElementById('session-info');
        const countdownDiv = document.getElementById('countdown');
        if (!sessionInfoDiv || !countdownDiv) return;
        const now = new Date();
        const timeUntil = this.nextSessionDate - now;
        if (timeUntil < 0) {
            this.displaySessionPassed();
            this.stopTimer();
            return;
        }
        const days = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' };
        const sessionDateStr = this.nextSessionDate.toLocaleDateString('en-US', options);
        document.querySelector('.session-date').textContent = sessionDateStr;
        let countdownStr = '';
        if (days > 0) countdownStr += `${days}d `;
        countdownStr += `${hours}h ${minutes}m ${seconds}s`;
        countdownDiv.textContent = countdownStr;
        if (days === 0 && hours < 2) {
            countdownDiv.style.color = '#ff6b6b';
            countdownDiv.style.animation = 'pulse 1s infinite';
        } else if (days === 0) {
            countdownDiv.style.color = '#ffd700';
        }
    }
    displaySessionPassed() {
        const sessionInfoDiv = document.getElementById('session-info');
        if (!sessionInfoDiv) return;
        sessionInfoDiv.innerHTML = `
            <div class="session-date">Session in Progress or Completed</div>
            <div class="countdown">Check back for next session date!</div>
        `;
    }
    setNextSession(date) {
        this.nextSessionDate = date;
        this.updateDisplay();
        if (!this.intervalId) this.startTimer();
    }
}
let sessionCountdown;
document.addEventListener('DOMContentLoaded', () => {
    sessionCountdown = new SessionCountdown();
    sessionCountdown.init();
});
function updateNextSession(dateString) {
    if (sessionCountdown) {
        const newDate = new Date(dateString);
        if (!isNaN(newDate.getTime())) {
            sessionCountdown.setNextSession(newDate);
            console.log('Next session updated to:', newDate);
        } else {
            console.error('Invalid date format');
        }
    }
}
