// voice.js - FocusYou Voice Assistant Integration

const FocusVoice = {
  enabled: true,
  voice: null,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  userInteracted: false,
  pendingText: null,
  interactionBound: false,

  init() {
    const savedEnabled = localStorage.getItem('fy_voice_enabled');
    if (savedEnabled !== null) {
      this.enabled = savedEnabled === 'true';
    }

    this.attachInteractionListeners();

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.selectVoice();
        if (this.pendingText) {
          this.resume();
        }
      };
      this.selectVoice();
    }

    const toggleEl = document.getElementById('monVoiceToggle');
    if (toggleEl) {
      toggleEl.checked = this.enabled;
    }
  },

  attachInteractionListeners() {
    if (this.interactionBound || typeof window === 'undefined') return;

    const activate = () => {
      this.userInteracted = true;
      this.resume();
    };

    ['pointerdown', 'keydown', 'touchstart', 'mousedown'].forEach((eventName) => {
      window.addEventListener(eventName, activate, { once: true, passive: true });
    });

    this.interactionBound = true;
  },

  resume() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      console.warn('Voice cancel failed:', e);
    }

    if (typeof window.speechSynthesis.resume === 'function') {
      try {
        window.speechSynthesis.resume();
      } catch (e) {
        console.warn('Voice resume failed:', e);
      }
    }

    if (this.pendingText) {
      const nextText = this.pendingText;
      this.pendingText = null;
      this.speak(nextText);
    }
  },

  selectVoice() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const voices = window.speechSynthesis.getVoices() || [];
    this.voice = voices.find((v) => v.lang && v.lang.toLowerCase().includes('en-us') && /google|microsoft|samantha|speak/i.test(v.name)) ||
                 voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en') && /natural|english/i.test(v.name)) ||
                 voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en')) ||
                 voices[0] || null;
  },

  speak(text) {
    if (!this.enabled || !text) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('Speech synthesis not supported in this browser.');
      return;
    }

    if (!this.userInteracted) {
      this.pendingText = text;
      this.resume();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.voice) utterance.voice = this.voice;
      utterance.lang = this.voice?.lang || 'en-US';
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Voice speak failed:', e);
    }
  },

  speakDistracted() {
    this.speak('You are distracted, keep focusing so you could achieve on your goals.');
  },

  speakNoFace() {
    this.speak('No face detected.');
  },

  speakTimerStart() {
    this.speak('Your time starts now.');
  },

  speakTimerOver() {
    this.speak('Timer is over.');
  },

  speakTaskSet(taskName) {
    this.speak('Task set: ' + taskName);
  },

  toggle(val) {
    this.enabled = val;
    localStorage.setItem('fy_voice_enabled', val ? 'true' : 'false');
    const toggleEl = document.getElementById('monVoiceToggle');
    if (toggleEl && toggleEl.checked !== val) {
      toggleEl.checked = val;
    }
    if (val) {
      this.resume();
    }
  }
};

if (typeof window !== 'undefined') {
  window.FocusVoice = FocusVoice;

  const startVoice = () => {
    FocusVoice.init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startVoice, { once: true });
  } else {
    startVoice();
  }
}
