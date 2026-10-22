/**
 * NTU EduBot - Voice Manager Module (STT & TTS)
 * Intelligent Speech Recognition with Instant Live Streaming, Academic Term Normalization,
 * Fallback to Multimodal MediaRecorder, and Natural Vietnamese Speech Synthesis.
 */

class VoiceManager {
  constructor() {
    this.recognition = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.voiceConfig = { lang: "vi-VN", rate: 1.0, pitch: 1.0 };
    this.activeUtterance = null;

    // Load voice preferences from backend if available
    this.initVoiceConfig();
  }

  async initVoiceConfig() {
    try {
      if (window.ApiService && typeof window.ApiService.getVoiceConfig === "function") {
        this.voiceConfig = await window.ApiService.getVoiceConfig();
      }
    } catch {
      // Use fallback defaults
    }
  }

  /**
   * Standardize spoken Vietnamese into official academic keywords and abbreviations.
   * @param {string} text - Raw spoken transcription.
   * @returns {string} Normalized academic query.
   */
  normalizeAcademicTerms(text) {
    if (!text) return "";
    let res = text;
    const rules = [
      [/\bn\s*t\s*u\b/gi, "NTU"],
      [/\bđại học nguyễn trãi\b/gi, "Đại học Nguyễn Trãi"],
      [/\bhọc bổng ca ca hát tê\b/gi, "học bổng KKHT"],
      [/\bca ca hát tê\b/gi, "KKHT"],
      [/\bkhuyến khích học tập\b/gi, "khuyến khích học tập"],
      [/\bđiểm ép\b/gi, "điểm F"],
      [/\bđiểm a\b/gi, "điểm A"],
      [/\bđiểm b cộng\b/gi, "điểm B+"],
      [/\bđiểm bê cộng\b/gi, "điểm B+"],
      [/\bđiểm bê\b/gi, "điểm B"],
      [/\bđiểm c cộng\b/gi, "điểm C+"],
      [/\bđiểm xê cộng\b/gi, "điểm C+"],
      [/\bđiểm xê\b/gi, "điểm C"],
      [/\bđiểm d cộng\b/gi, "điểm D+"],
      [/\bđiểm đê cộng\b/gi, "điểm D+"],
      [/\bđiểm đê\b/gi, "điểm D"],
      [/\bđiểm d\b/gi, "điểm D"],
      [/\bđiểm f\b/gi, "điểm F"],
      [/\bgpa\b/gi, "GPA"],
      [/\bdrl\b/gi, "ĐRL"],
    ];

    for (const [pattern, replacement] of rules) {
      res = res.replace(pattern, replacement);
    }
    return res;
  }

  /**
   * Main Toggle Recording Entry Point called by main.js
   * @param {Function} onResult - Callback receiving recognized string: onResult(text)
   * @param {Function} onStateChange - Callback receiving boolean: onStateChange(isRecording)
   */
  toggleRecording(onResult, onStateChange) {
    if (this.isRecording) {
      this.stopListening(onResult, onStateChange);
    } else {
      this.startListening(onResult, onStateChange);
    }
  }

  /**
   * Start microphone capture using Web Speech API (with immediate live input streaming)
   * or fallback to MediaRecorder.
   */
  startListening(onResult, onStateChange) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "vi-VN";
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        let accumulatedTranscript = "";
        const inputElem = document.getElementById("chat-input");

        recognition.onstart = () => {
          this.isRecording = true;
          if (typeof onStateChange === "function") onStateChange(true);
        };

        recognition.onresult = (event) => {
          let interimText = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              accumulatedTranscript += transcript;
            } else {
              interimText += transcript;
            }
          }

          const rawCombined = accumulatedTranscript || interimText;
          const normalized = this.normalizeAcademicTerms(rawCombined);

          // Stream recognized text immediately to chat textarea
          if (inputElem) {
            inputElem.value = normalized;
            inputElem.style.height = "auto";
            inputElem.style.height = `${Math.min(inputElem.scrollHeight, 140)}px`;
            inputElem.dispatchEvent(new Event("input"));
          }
        };

        recognition.onerror = (event) => {
          console.warn("Speech recognition error:", event.error);
          this.isRecording = false;
          if (typeof onStateChange === "function") onStateChange(false);
        };

        recognition.onend = () => {
          this.isRecording = false;
          if (typeof onStateChange === "function") onStateChange(false);

          const finalText = inputElem && inputElem.value.trim() 
            ? inputElem.value.trim() 
            : this.normalizeAcademicTerms(accumulatedTranscript).trim();

          if (finalText && typeof onResult === "function") {
            onResult(finalText);
          }
        };

        this.recognition = recognition;
        recognition.start();
        return;
      } catch (err) {
        console.warn("SpeechRecognition initiation failed, falling back to MediaRecorder:", err);
      }
    }

    // Fallback: Multimodal MediaRecorder sending audio blob to backend
    this.startMediaRecorderFallback(onResult, onStateChange);
  }

  /**
   * Stop active speech listening session.
   */
  stopListening(onResult, onStateChange) {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }

    this.isRecording = false;
    if (typeof onStateChange === "function") onStateChange(false);
  }

  /**
   * MediaRecorder Fallback when Web Speech API is unsupported in current browser.
   */
  async startMediaRecorderFallback(onResult, onStateChange) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Trình duyệt không hỗ trợ tính năng ghi âm microphone.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus";
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
      };

      recorder.onstart = () => {
        this.isRecording = true;
        if (typeof onStateChange === "function") onStateChange(true);
      };

      recorder.onstop = async () => {
        this.isRecording = false;
        if (typeof onStateChange === "function") onStateChange(false);

        if (recorder.stream) {
          recorder.stream.getTracks().forEach((t) => t.stop());
        }

        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        if (audioBlob.size > 200 && window.ApiService) {
          try {
            const rawText = await window.ApiService.transcribeAudio(audioBlob);
            const normalized = this.normalizeAcademicTerms(rawText);
            const inputElem = document.getElementById("chat-input");
            if (inputElem) {
              inputElem.value = normalized;
              inputElem.dispatchEvent(new Event("input"));
            }
            if (normalized && typeof onResult === "function") {
              onResult(normalized);
            }
          } catch (e) {
            console.error("Audio transcription failed:", e);
          }
        }
      };

      recorder.start(250);
    } catch (err) {
      console.error("Microphone access failed:", err);
      this.isRecording = false;
      if (typeof onStateChange === "function") onStateChange(false);
    }
  }

  // =========================================================================
  // Text-to-Speech (TTS) Methods
  // =========================================================================

  cleanTextForSpeech(rawText) {
    return (rawText || "")
      .replace(/\[Tài liệu \d+\]:.*$/gm, "")
      .replace(/\[.*?\]\(.*?\)/g, "")
      .replace(/[#*`_~>[\]|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  speak(text, onStart, onEnd) {
    if (!window.speechSynthesis) {
      if (typeof onEnd === "function") onEnd();
      return;
    }

    window.speechSynthesis.cancel();
    const plainText = this.cleanTextForSpeech(text);
    if (!plainText) {
      if (typeof onEnd === "function") onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = this.voiceConfig.lang || "vi-VN";
    utterance.rate = this.voiceConfig.rate || 1.0;
    utterance.pitch = this.voiceConfig.pitch || 1.0;

    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find((v) => v.lang.startsWith("vi") || v.name.includes("Vietnamese"));
    if (viVoice) {
      utterance.voice = viVoice;
    }

    utterance.onstart = () => {
      this.activeUtterance = utterance;
      if (typeof onStart === "function") onStart();
    };

    utterance.onend = () => {
      this.activeUtterance = null;
      if (typeof onEnd === "function") onEnd();
    };

    utterance.onerror = () => {
      this.activeUtterance = null;
      if (typeof onEnd === "function") onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.activeUtterance = null;
    }
  }

  isSpeaking() {
    return !!(window.speechSynthesis && window.speechSynthesis.speaking);
  }
}

// Attach globally
window.VoiceManager = new VoiceManager();
