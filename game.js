/**
 * SIMON - Retro Arcade Edition
 * Pure Vanilla JavaScript with Web Audio API & Canvas Confetti
 */

// Sound frequencies corresponding to classic Simon tones
const COLOR_FREQUENCIES = {
  green: 415.3,  // G#4
  red: 311.13,   // D#4
  yellow: 252.28,// B3
  blue: 209.25   // G#3
};

const COLORS = ['green', 'red', 'yellow', 'blue'];

class SimonGame {
  constructor() {
    // DOM Elements
    this.board = document.getElementById('simon-board');
    this.pads = {
      green: document.getElementById('green'),
      red: document.getElementById('red'),
      yellow: document.getElementById('yellow'),
      blue: document.getElementById('blue')
    };
    this.startBtn = document.getElementById('start-btn');
    this.roundDisplay = document.getElementById('round-display');
    this.highScoreDisplay = document.getElementById('high-score-display');
    this.livesDisplay = document.getElementById('lives-display');
    this.statusBadge = document.getElementById('status-badge');
    this.strictToggle = document.getElementById('strict-toggle');
    this.strictLabel = document.getElementById('strict-label');
    this.muteToggle = document.getElementById('mute-toggle');
    this.soundIcon = document.getElementById('sound-icon');
    this.speedBtns = document.querySelectorAll('.speed-btn');

    // Modals
    this.modalBackdrop = document.getElementById('modal-backdrop');
    this.howToPlayBtn = document.getElementById('how-to-play-btn');
    this.modalCloseBtn = document.getElementById('modal-close-btn');
    this.modalOkBtn = document.getElementById('modal-ok-btn');
    this.resetHighScoreBtn = document.getElementById('reset-high-score-btn');

    // Game state
    this.sequence = [];
    this.userStep = 0;
    this.round = 0;
    this.isPlayingSequence = false;
    this.isUserTurn = false;
    this.isStrict = false;
    this.isMuted = localStorage.getItem('simon_muted') === 'true';
    this.highScore = parseInt(localStorage.getItem('simon_high_score') || '0', 10);
    this.speedMode = 'classic';
    this.maxLives = 3;
    this.lives = 3;
    this.audioCtx = null;

    // Confetti engine
    this.confettiCanvas = document.getElementById('confetti-canvas');
    this.confettiCtx = this.confettiCanvas ? this.confettiCanvas.getContext('2d') : null;
    this.confettiParticles = [];
    this.isConfettiRunning = false;

    this.init();
  }

  init() {
    this.updateHighScoreDisplay();
    this.updateMuteUI();
    this.initAudioOnInteraction();
    this.setupEventListeners();
    this.setupConfetti();
  }

  // Initialize Web Audio API on first user gesture
  initAudioOnInteraction() {
    const unlock = () => {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Play synthesized tone for colors
  playTone(frequency, durationMs) {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);

      // Smooth envelope attack and release to eliminate clicks
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (durationMs / 1000));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + (durationMs / 1000));
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // Play dissonant buzz for game over / mistake
  playErrorBuzz() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(110, now); // Low A
      osc2.frequency.setValueAtTime(78, now);  // Dissonant interval

      osc1.frequency.exponentialRampToValueAtTime(40, now + 0.6);
      osc2.frequency.exponentialRampToValueAtTime(35, now + 0.6);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.65);
      osc2.stop(now + 0.65);
    } catch (e) {
      console.warn('Buzz sound error:', e);
    }
  }

  // Level clear / Fanfare
  playMilestoneFanfare() {
    if (this.isMuted) return;
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    chord.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 280);
      }, idx * 110);
    });
  }

  setupEventListeners() {
    // Pad inputs (both pointerdown and click safety)
    Object.keys(this.pads).forEach(color => {
      const pad = this.pads[color];
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.handleUserPadPress(color);
      });
    });

    // Start / Restart button
    this.startBtn.addEventListener('click', () => {
      this.startGame();
    });

    // Strict Mode Switch
    this.strictToggle.addEventListener('click', () => {
      this.toggleStrict();
    });

    // Speed options
    this.speedBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.speedBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.speedMode = e.currentTarget.dataset.speed;
      });
    });

    // Mute toggle
    this.muteToggle.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      localStorage.setItem('simon_muted', this.isMuted);
      this.updateMuteUI();
    });

    // Keyboard controls (Q, W, A, S & Space)
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const key = e.key.toUpperCase();

      if (e.code === 'Space') {
        e.preventDefault();
        this.startGame();
        return;
      }

      if (this.isUserTurn) {
        if (key === 'Q') this.handleUserPadPress('green');
        if (key === 'W') this.handleUserPadPress('red');
        if (key === 'A') this.handleUserPadPress('yellow');
        if (key === 'S') this.handleUserPadPress('blue');
      }
    });

    // How to play modal
    this.howToPlayBtn.addEventListener('click', () => this.showModal());
    this.modalCloseBtn.addEventListener('click', () => this.hideModal());
    this.modalOkBtn.addEventListener('click', () => this.hideModal());
    this.modalBackdrop.addEventListener('click', (e) => {
      if (e.target === this.modalBackdrop) this.hideModal();
    });

    // Reset high score
    this.resetHighScoreBtn.addEventListener('click', () => {
      if (confirm('Reset your Simon High Score to 0?')) {
        this.highScore = 0;
        localStorage.removeItem('simon_high_score');
        this.updateHighScoreDisplay();
      }
    });
  }

  showModal() {
    this.modalBackdrop.classList.add('show');
    this.modalBackdrop.setAttribute('aria-hidden', 'false');
  }

  hideModal() {
    this.modalBackdrop.classList.remove('show');
    this.modalBackdrop.setAttribute('aria-hidden', 'true');
  }

  toggleStrict() {
    if (this.round > 0 && (this.isPlayingSequence || this.isUserTurn)) {
      if (!confirm('Toggling Strict Mode will reset the current game. Proceed?')) {
        return;
      }
    }
    this.isStrict = !this.isStrict;
    this.strictToggle.classList.toggle('active', this.isStrict);
    this.strictToggle.setAttribute('aria-checked', this.isStrict.toString());
    this.strictLabel.textContent = this.isStrict ? 'ON' : 'OFF';
    
    // Update lives display depending on mode
    this.updateLivesUI();
    if (this.round > 0) {
      this.resetGame();
    }
  }

  updateMuteUI() {
    this.soundIcon.textContent = this.isMuted ? '🔇' : '🔊';
  }

  updateLivesUI() {
    if (this.isStrict) {
      this.livesDisplay.textContent = '⚡ STRICT';
      this.livesDisplay.style.fontSize = '0.75rem';
    } else {
      this.livesDisplay.style.fontSize = '1.1rem';
      let hearts = '';
      for (let i = 0; i < this.lives; i++) hearts += '❤️';
      for (let i = this.lives; i < this.maxLives; i++) hearts += '🖤';
      this.livesDisplay.textContent = hearts || '💀';
    }
  }

  updateHighScoreDisplay() {
    const scoreStr = this.highScore < 10 ? '0' + this.highScore : this.highScore.toString();
    this.highScoreDisplay.textContent = scoreStr;
  }

  updateRoundDisplay(val) {
    if (val === '--') {
      this.roundDisplay.textContent = '--';
    } else {
      this.roundDisplay.textContent = val < 10 ? '0' + val : val.toString();
    }
  }

  setStatus(text, type = '') {
    this.statusBadge.textContent = text;
    this.statusBadge.className = 'status-indicator-badge ' + type;
  }

  // Calculate duration per step based on round and speed settings
  getTimingConfig() {
    let baseTime = 600;
    if (this.speedMode === 'fast') baseTime = 420;
    if (this.speedMode === 'insane') baseTime = 260;

    // Classic Simon accelerates at round 5, 9, 13
    if (this.round >= 13) baseTime *= 0.45;
    else if (this.round >= 9) baseTime *= 0.6;
    else if (this.round >= 5) baseTime *= 0.75;

    const litDuration = Math.max(120, Math.floor(baseTime * 0.7));
    const pauseDuration = Math.max(80, Math.floor(baseTime * 0.3));

    return { litDuration, pauseDuration, totalStep: litDuration + pauseDuration };
  }

  startGame() {
    this.resetGame();
    this.round = 1;
    this.lives = this.maxLives;
    this.updateLivesUI();
    this.updateRoundDisplay(this.round);
    this.startBtn.querySelector('.btn-text').textContent = 'RESTART';
    this.setStatus('GET READY!', 'watch');

    // Add first random color
    this.sequence.push(this.getRandomColor());

    setTimeout(() => {
      this.playSequence();
    }, 700);
  }

  resetGame() {
    this.sequence = [];
    this.userStep = 0;
    this.round = 0;
    this.isPlayingSequence = false;
    this.isUserTurn = false;
    this.updateRoundDisplay('--');
    this.setStatus('PRESS START');
    this.clearAllActivePads();
  }

  getRandomColor() {
    const randomIndex = Math.floor(Math.random() * COLORS.length);
    return COLORS[randomIndex];
  }

  // Light up a pad both visually and acoustically
  activatePad(color, durationMs = 350) {
    const pad = this.pads[color];
    if (!pad) return;

    pad.classList.add('active');
    this.playTone(COLOR_FREQUENCIES[color], durationMs);

    setTimeout(() => {
      pad.classList.remove('active');
    }, durationMs);
  }

  clearAllActivePads() {
    Object.values(this.pads).forEach(pad => pad.classList.remove('active'));
  }

  // Play Simon's sequence to the player
  async playSequence() {
    this.isPlayingSequence = true;
    this.isUserTurn = false;
    this.setStatus('WATCH & LISTEN', 'watch');

    const { litDuration, pauseDuration } = this.getTimingConfig();

    // Small delay before sequence begins
    await this.wait(400);

    for (let i = 0; i < this.sequence.length; i++) {
      const color = this.sequence[i];
      this.activatePad(color, litDuration);
      await this.wait(litDuration + pauseDuration);
    }

    // Now it's the user's turn
    this.isPlayingSequence = false;
    this.isUserTurn = true;
    this.userStep = 0;
    this.setStatus('YOUR TURN!', 'play');
  }

  handleUserPadPress(color) {
    if (!this.isUserTurn || this.isPlayingSequence) return;

    const { litDuration } = this.getTimingConfig();
    this.activatePad(color, Math.min(250, litDuration));

    const expectedColor = this.sequence[this.userStep];

    if (color === expectedColor) {
      // Correct step
      this.userStep++;

      // Check if user finished the full sequence for this round
      if (this.userStep === this.sequence.length) {
        this.handleRoundComplete();
      }
    } else {
      // Incorrect step!
      this.handleMistake();
    }
  }

  handleRoundComplete() {
    this.isUserTurn = false;
    this.setStatus('NICE JOB!', 'play');

    // Check high score
    if (this.round > this.highScore) {
      this.highScore = this.round;
      localStorage.setItem('simon_high_score', this.highScore.toString());
      this.updateHighScoreDisplay();
    }

    // Trigger celebration at milestones (every 5 rounds)
    if (this.round % 5 === 0) {
      this.triggerConfetti();
      this.playMilestoneFanfare();
      this.setStatus(`LEVEL ${this.round} CLEARED!`, 'play');
    }

    // Advance to next round
    this.round++;
    this.sequence.push(this.getRandomColor());

    setTimeout(() => {
      this.updateRoundDisplay(this.round);
      this.playSequence();
    }, 1100);
  }

  handleMistake() {
    this.isUserTurn = false;
    this.playErrorBuzz();
    this.board.classList.add('shake');
    setTimeout(() => this.board.classList.remove('shake'), 450);

    if (this.isStrict) {
      // Strict mode: Game Over instantly
      this.gameOver();
    } else {
      // Normal mode: deduct life
      this.lives--;
      this.updateLivesUI();

      if (this.lives <= 0) {
        this.gameOver();
      } else {
        this.setStatus(`WRONG! TRY AGAIN (${this.lives} ❤️ LEFT)`, 'fail');
        this.userStep = 0;
        setTimeout(() => {
          this.playSequence();
        }, 1300);
      }
    }
  }

  gameOver() {
    this.setStatus('GAME OVER!', 'fail');
    this.startBtn.querySelector('.btn-text').textContent = 'PLAY AGAIN';
    this.roundDisplay.textContent = 'XX';
    this.isUserTurn = false;
    this.isPlayingSequence = false;

    // Flash all pads once
    Object.values(this.pads).forEach(pad => pad.classList.add('active'));
    setTimeout(() => {
      this.clearAllActivePads();
    }, 500);
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Confetti Particle Explosion
  setupConfetti() {
    if (!this.confettiCanvas) return;
    const resize = () => {
      this.confettiCanvas.width = window.innerWidth;
      this.confettiCanvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  triggerConfetti() {
    if (!this.confettiCanvas || !this.confettiCtx) return;
    const colors = ['#00ff73', '#ff2a4b', '#ffea00', '#18a0fb', '#ffffff', '#a855f7'];

    for (let i = 0; i < 90; i++) {
      this.confettiParticles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.7) * 16,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    if (!this.isConfettiRunning) {
      this.isConfettiRunning = true;
      this.animateConfetti();
    }
  }

  animateConfetti() {
    if (!this.confettiCtx) return;
    this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);

    for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
      const p = this.confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25; // gravity
      p.rotation += p.rSpeed;
      p.opacity -= 0.012;

      if (p.opacity <= 0) {
        this.confettiParticles.splice(i, 1);
        continue;
      }

      this.confettiCtx.save();
      this.confettiCtx.translate(p.x, p.y);
      this.confettiCtx.rotate((p.rotation * Math.PI) / 180);
      this.confettiCtx.fillStyle = p.color;
      this.confettiCtx.globalAlpha = p.opacity;
      this.confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      this.confettiCtx.restore();
    }

    if (this.confettiParticles.length > 0) {
      requestAnimationFrame(() => this.animateConfetti());
    } else {
      this.isConfettiRunning = false;
      this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
    }
  }
}

// Start game instance when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.simonInstance = new SimonGame();
});
