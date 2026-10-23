/**
 * NTU EduBot - Main Application Controller
 * Google Gemini Web Ultra-Minimalist UI Architecture
 * Dynamic Home Mode (Centered Greeting & Omnibox) vs Active Chat Mode,
 * Single-line History Items, Regulations Library Modal, Multimodal Omnibox & SSE Streaming.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Application State
  const state = {
    sessionId: createFreshSessionId(),
    topK: 5,
    autoTTS: false,
    isProcessing: false,
    selectedFile: null,
    selectedCameraFile: null,
    selectedAttachmentFile: null,
    renamingSessionId: null,
    deletingSessionId: null,
    deletingSessionName: "",
    renamingDocId: null,
    sessionsList: [],
    allSessionsList: [],
    cameraFacingMode: "environment",
    mediaStream: null,
    capturedBlob: null,
    currentQuestion: "",
    activeCitation: null,
    studentId: localStorage.getItem("ntu_student_id") || "",
    ragMode: "detail",
    filterMode: "all",
    searchQuery: "",
    ttsSpeed: parseFloat(localStorage.getItem("ntu_tts_speed") || "1.0"),
  };

  // DOM Elements Mapping
  const elements = {
    // App & Layout
    appContainer: document.querySelector(".app-container"),
    mainChat: document.getElementById("main-chat"),
    chatTopBar: document.getElementById("chat-topbar"),

    // Sidebar
    sidebar: document.getElementById("sidebar"),
    btnToggleSidebar: document.getElementById("btn-toggle-sidebar"),
    btnToggleSidebarMobile: document.getElementById("btn-toggle-sidebar-mobile"),
    btnSidebarSearch: document.getElementById("btn-sidebar-search"),
    btnNewChat: document.getElementById("btn-new-chat"),
    btnOpenDocsModal: document.getElementById("btn-open-docs-modal"),
    btnSidebarGpaCalc: document.getElementById("btn-sidebar-gpa-calc"),
    chatSessionsList: document.getElementById("chat-sessions-list"),
    sessionsPinnedGroup: document.getElementById("sessions-pinned-group"),
    sessionsPinnedList: document.getElementById("sessions-pinned-list"),
    sessionsRecentGroup: document.getElementById("sessions-recent-group"),
    sessionsRecentList: document.getElementById("sessions-recent-list"),
    statusDot: document.getElementById("status-dot"),
    statusText: document.getElementById("status-text"),
    btnSidebarSettings: document.getElementById("btn-sidebar-settings"),

    // Topbar Controls
    btnExportWordTopbar: document.getElementById("btn-export-word-topbar"),
    selectTopK: document.getElementById("select-topk"),
    btnToggleTTS: document.getElementById("btn-toggle-tts"),
    ttsIcon: document.getElementById("tts-icon"),
    toggleAutoTTS: document.getElementById("toggle-auto-tts"),
    btnToggleTheme: document.getElementById("btn-toggle-theme"),
    themeIcon: document.getElementById("theme-icon"),

    // Workspace & Chat
    chatMessages: document.getElementById("chat-messages"),
    geminiContentArea: document.getElementById("gemini-content-area"),
    geminiGreeting: document.getElementById("gemini-greeting"),
    geminiPromptPills: document.getElementById("gemini-prompt-pills"),

    // Gemini Omnibox
    chatForm: document.getElementById("chat-form"),
    chatInput: document.getElementById("chat-input"),
    btnPlusMenu: document.getElementById("btn-plus-menu"),
    geminiUploadMenu: document.getElementById("gemini-upload-menu"),
    btnMic: document.getElementById("btn-mic"),
    btnSend: document.getElementById("btn-send"),

    // Attachment Preview Bar
    chatAttachmentBar: document.getElementById("chat-attachment-bar"),
    attachmentIcon: document.getElementById("attachment-icon"),
    attachmentName: document.getElementById("attachment-name"),
    attachmentSize: document.getElementById("attachment-size"),
    attachmentTitleInput: document.getElementById("attachment-title-input"),
    btnUploadAttachment: document.getElementById("btn-upload-attachment"),
    btnCancelAttachment: document.getElementById("btn-cancel-attachment"),

    // Omnibox Menu Options & Native File Inputs
    menuOptDoc: document.getElementById("menu-opt-doc"),
    menuOptImage: document.getElementById("menu-opt-image"),
    menuOptCamera: document.getElementById("menu-opt-camera"),
    menuOptMedia: document.getElementById("menu-opt-media"),
    menuOptVoice: document.getElementById("menu-opt-voice"),
    menuOptGpa: document.getElementById("menu-opt-gpa"),
    menuInputDoc: document.getElementById("menu-input-doc"),
    menuInputImage: document.getElementById("menu-input-image"),
    menuInputMedia: document.getElementById("menu-input-media"),
    smartphoneCameraInput: document.getElementById("smartphone-camera-input"),

    // Modal 1: Citation Preview
    modalCitation: document.getElementById("modal-citation"),
    citationDocTitle: document.getElementById("citation-modal-doc-title"),
    citationLocation: document.getElementById("citation-modal-location"),
    citationScore: document.getElementById("citation-modal-score"),
    citationFilename: document.getElementById("citation-modal-filename"),
    citationContent: document.getElementById("citation-modal-content"),
    btnCloseCitation: document.getElementById("btn-close-citation"),
    btnDismissCitation: document.getElementById("btn-dismiss-citation"),
    btnCopyCitation: document.getElementById("btn-copy-citation"),

    // Modal 2: GPA & Scholarship Calculator
    modalGpaCalc: document.getElementById("modal-gpa-calc"),
    btnCloseGpaCalc: document.getElementById("btn-close-gpa-calc"),
    btnDismissGpaCalc: document.getElementById("btn-dismiss-gpa-calc"),
    inputCalcGpa: document.getElementById("input-calc-gpa"),
    inputCalcDrl: document.getElementById("input-calc-drl"),
    inputCalcCredits: document.getElementById("input-calc-credits"),
    selectCalcYear: document.getElementById("select-calc-year"),
    checkHasFail: document.getElementById("check-has-fail"),
    inputScore10: document.getElementById("input-score-10"),
    convertResultBadge: document.getElementById("convert-result-badge"),
    scholarshipBadge: document.getElementById("scholarship-badge"),
    scholarshipDetail: document.getElementById("scholarship-detail"),
    scholarshipBox: document.getElementById("scholarship-result-box"),
    warningBadge: document.getElementById("warning-badge"),
    warningDetail: document.getElementById("warning-detail"),
    warningBox: document.getElementById("warning-result-box"),

    // Modal 3: Live Camera Scanner
    modalCameraScanner: document.getElementById("modal-camera-scanner"),
    btnCloseScanner: document.getElementById("btn-close-scanner"),
    cameraStream: document.getElementById("camera-stream"),
    cameraCanvas: document.getElementById("camera-canvas"),
    scannerViewContainer: document.getElementById("scanner-view-container"),
    scannerSnapshotView: document.getElementById("scanner-snapshot-view"),
    scannerSnapshotImg: document.getElementById("scanner-snapshot-img"),
    scannerDocTitle: document.getElementById("scanner-doc-title"),
    btnSwitchCamera: document.getElementById("btn-switch-camera"),
    btnCaptureScan: document.getElementById("btn-capture-scan"),
    btnRetakeScan: document.getElementById("btn-retake-scan"),
    btnConfirmUploadScan: document.getElementById("btn-confirm-upload-scan"),

    // Modal 4: Rename Session
    modalRenameSession: document.getElementById("modal-rename-session"),
    btnCloseRename: document.getElementById("btn-close-rename"),
    btnCancelRename: document.getElementById("btn-cancel-rename"),
    btnConfirmRename: document.getElementById("btn-confirm-rename"),
    inputSessionRename: document.getElementById("input-session-rename"),

    // Modal 5: Regulation Documents Library
    modalDocsLibrary: document.getElementById("modal-docs-library"),
    btnCloseDocsModal: document.getElementById("btn-close-docs-modal"),
    btnDismissDocsModal: document.getElementById("btn-dismiss-docs-modal"),
    btnChooseFileModal: document.getElementById("btn-choose-file-modal"),
    fileInput: document.getElementById("file-input"),
    docTitleInput: document.getElementById("doc-title-input"),
    btnUpload: document.getElementById("btn-upload"),
    dropzoneText: document.getElementById("dropzone-text"),
    documentsList: document.getElementById("documents-list"),
    docCountBadge: document.getElementById("doc-count-badge"),

    // Toast Notifications
    toastContainer: document.getElementById("toast-container"),

    // New Modal 6: Confirm Delete History
    modalConfirmDelete: document.getElementById("modal-confirm-delete"),
    confirmDeleteSessionName: document.getElementById("confirm-delete-session-name"),
    btnCancelDeleteHistory: document.getElementById("btn-cancel-delete-history"),
    btnConfirmDeleteHistory: document.getElementById("btn-confirm-delete-history"),

    // New Modal 7: View Document Content
    modalDocContent: document.getElementById("modal-doc-content"),
    docContentModalTitle: document.getElementById("doc-content-modal-title"),
    docContentModalMeta: document.getElementById("doc-content-modal-meta"),
    docContentTextBox: document.getElementById("doc-content-text-box"),
    btnCloseDocContent: document.getElementById("btn-close-doc-content"),
    btnCloseDocContentFooter: document.getElementById("btn-close-doc-content-footer"),

    // New Modal 8: Student Settings
    modalStudentSettings: document.getElementById("modal-student-settings"),
    btnCloseStudentSettings: document.getElementById("btn-close-student-settings"),
    btnCloseSettingsFooter: document.getElementById("btn-close-settings-footer"),
    inputStudentMssv: document.getElementById("input-student-mssv"),
    btnSaveMssv: document.getElementById("btn-save-mssv"),
    rangeTtsSpeed: document.getElementById("range-tts-speed"),
    ttsSpeedLabel: document.getElementById("tts-speed-label"),
    btnClearAllHistory: document.getElementById("btn-clear-all-history"),

    // New Modal 9: Rename Doc
    modalRenameDoc: document.getElementById("modal-rename-doc"),
    btnCloseRenameDoc: document.getElementById("btn-close-rename-doc"),
    btnCancelRenameDoc: document.getElementById("btn-cancel-rename-doc"),
    btnConfirmRenameDoc: document.getElementById("btn-confirm-rename-doc"),
    inputDocRename: document.getElementById("input-doc-rename"),

    // Sidebar search & filter
    btnSidebarSearch: document.getElementById("btn-sidebar-search"),
    sidebarSearchBar: document.getElementById("sidebar-search-bar"),
    inputSearchSessions: document.getElementById("input-search-sessions"),
    btnFilterSessions: document.getElementById("btn-filter-sessions"),

    // RAG mode dropdown
    btnRagMode: document.getElementById("btn-rag-mode"),
    ragModeDropdown: document.getElementById("rag-mode-dropdown"),
  };

  // Initialize Application
  initApp();

  function initApp() {
    // 1. Initialize Academic Dark Theme (Default)
    initTheme();

    // 2. ALWAYS enter fresh Home Mode on load (centered Omnibox, greeting, suggestion pills)
    startNewChatSession(false);

    // 3. Setup All Event Listeners
    setupEventListeners();

    // 4. Check Backend Health
    refreshHealthStatus();

    // 5. Load Chat Sessions list into Sidebar (filtered by student_id if set)
    loadSessionsList();

    // 6. Preload Ingested Documents into Vector Catalog
    loadDocuments();

    // 7. Initialize GPA Calculator values
    calculateGpaAndScholarship();
    convertScore10();

    // 8. Initialize student settings from localStorage
    initStudentSettings();
  }

  // =========================================================================
  // Theme Manager: Dark Slate (Default) / Light Mode
  // =========================================================================
  function initTheme() {
    const savedTheme = localStorage.getItem("ntu_theme") || "dark";
    applyTheme(savedTheme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ntu_theme", theme);
    if (elements.themeIcon) {
      elements.themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
    }
  }

  // =========================================================================
  // State & Session Management
  // =========================================================================
  function createFreshSessionId() {
    return `ntu_session_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
  }

  /**
   * Reset workspace to the Ultra-Minimalist Gemini Home State:
   * Centered Greeting ("Chúng ta nên bắt đầu từ đâu nhỉ?"), Omnibox in the middle,
   * 4 suggestion pills below, empty chat messages area.
   */
  function startNewChatSession(showToastMsg = true) {
    state.sessionId = createFreshSessionId();
    localStorage.setItem("ntu_edubot_session_id", state.sessionId);

    // 1. Enter Home Mode (Center layout)
    if (elements.mainChat) {
      elements.mainChat.classList.add("home-mode");
    }

    // 2. Clear Chat Messages
    if (elements.chatMessages) {
      elements.chatMessages.innerHTML = "";
    }

    // 3. Hide Topbar Word Export Button (only shown when conversation has messages)
    if (elements.btnExportWordTopbar) {
      elements.btnExportWordTopbar.style.display = "none";
    }

    // 4. Clear Omnibox input & cancel any pending attachment
    if (elements.chatInput) {
      elements.chatInput.value = "";
      elements.chatInput.style.height = "auto";
    }
    clearAttachmentBar();

    // 5. Highlight "Cuộc trò chuyện mới" in sidebar
    if (elements.btnNewChat) {
      elements.btnNewChat.classList.add("active-nav");
    }
    document.querySelectorAll(".session-item").forEach((el) => el.classList.remove("active"));

    if (showToastMsg) {
      showToast("Đã bắt đầu cuộc trò chuyện mới.", "info", 2000);
    }
  }

  // =========================================================================
  // Toast Notifications
  // =========================================================================
  function showToast(message, type = "info", duration = 3500) {
    if (!elements.toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.25s ease";
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  // =========================================================================
  // Event Listeners Setup
  // =========================================================================
  function setupEventListeners() {
    // 1. Sidebar Toggle (Desktop & Mobile)
    const toggleSidebar = () => {
      if (!elements.sidebar) return;
      if (window.innerWidth <= 768) {
        elements.sidebar.classList.toggle("open");
      } else {
        elements.sidebar.classList.toggle("collapsed");
      }
    };
    if (elements.btnToggleSidebar) elements.btnToggleSidebar.addEventListener("click", toggleSidebar);
    if (elements.btnToggleSidebarMobile) elements.btnToggleSidebarMobile.addEventListener("click", toggleSidebar);

    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", (e) => {
      if (
        elements.sidebar &&
        elements.sidebar.classList.contains("open") &&
        !elements.sidebar.contains(e.target) &&
        elements.btnToggleSidebarMobile &&
        !elements.btnToggleSidebarMobile.contains(e.target) &&
        elements.btnToggleSidebar &&
        !elements.btnToggleSidebar.contains(e.target)
      ) {
        elements.sidebar.classList.remove("open");
      }
    });

    // 2. New Chat Button
    if (elements.btnNewChat) {
      elements.btnNewChat.addEventListener("click", () => {
        startNewChatSession(true);
      });
    }

    // 3. Open Documents Library Modal
    if (elements.btnOpenDocsModal) {
      elements.btnOpenDocsModal.addEventListener("click", openDocsLibraryModal);
    }

    // 4. Open GPA Calculator Modal
    if (elements.btnSidebarGpaCalc) {
      elements.btnSidebarGpaCalc.addEventListener("click", openGpaCalcModal);
    }

    // 5. Topbar Word Export Button
    if (elements.btnExportWordTopbar) {
      elements.btnExportWordTopbar.addEventListener("click", () => {
        exportWordForSession(state.sessionId);
      });
    }

    // 6. TopK Selector
    if (elements.selectTopK) {
      elements.selectTopK.addEventListener("change", (e) => {
        state.topK = Number(e.target.value);
      });
    }

    // 7. Auto-TTS Toggle
    if (elements.btnToggleTTS) {
      elements.btnToggleTTS.addEventListener("click", () => {
        state.autoTTS = !state.autoTTS;
        if (elements.ttsIcon) {
          elements.ttsIcon.textContent = state.autoTTS ? "🔊" : "🔇";
        }
        showToast(state.autoTTS ? "Đã bật tự động đọc câu trả lời." : "Đã tắt tự động đọc.", "info", 2000);
        if (!state.autoTTS && window.VoiceManager) {
          window.VoiceManager.stopSpeaking();
        }
      });
    }

    // 8. Theme Toggle Listener
    if (elements.btnToggleTheme) {
      elements.btnToggleTheme.addEventListener("click", () => {
        const active = document.documentElement.getAttribute("data-theme") || "dark";
        const nextTheme = active === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
        showToast(nextTheme === "dark" ? "Đã chuyển sang Giao diện Tối." : "Đã chuyển sang Giao diện Sáng.", "info", 2000);
      });
    }

    // 9. Auto-resizing Chat Textarea
    if (elements.chatInput) {
      elements.chatInput.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = `${Math.min(this.scrollHeight, 180)}px`;
      });

      // Submit on Enter (Shift+Enter for newline)
      elements.chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      });
    }

    // 10. Form Submit
    if (elements.chatForm) {
      elements.chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        handleSendMessage();
      });
    }

    // 11. Home Suggestion Pills (4 Ultra-clean Pills)
    document.querySelectorAll(".gemini-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const promptText = pill.getAttribute("data-prompt");
        if (promptText && elements.chatInput) {
          elements.chatInput.value = promptText;
          handleSendMessage();
        }
      });
    });

    // 12. Omnibox Plus Button & Multimodal Upload Popover Menu
    setupGeminiOmniboxMenuEvents();

    // 13. Attachment Preview Bar Events
    setupAttachmentBarEvents();

    // 14. Mic / Voice Input Button
    if (elements.btnMic && window.VoiceManager) {
      elements.btnMic.addEventListener("click", () => {
        window.VoiceManager.toggleRecording(
          (recognizedText) => {
            if (elements.chatInput) {
              elements.chatInput.value = recognizedText;
              handleSendMessage();
            }
          },
          (isRecording) => {
            if (isRecording) {
              elements.btnMic.classList.add("recording");
              showToast("Đang lắng nghe... Nói câu hỏi quy chế của bạn.", "info", 3000);
            } else {
              elements.btnMic.classList.remove("recording");
            }
          }
        );
      });
    }

    // 15. Setup Modals Events
    setupCitationModalEvents();
    setupGpaCalculatorEvents();
    setupCameraScannerEvents();
    setupRenameSessionModalEvents();
    setupDocsLibraryModalEvents();
    setupConfirmDeleteModalEvents();
    setupDocContentModalEvents();
    setupStudentSettingsModalEvents();
    setupDocRenameModalEvents();

    // 16. Sidebar Search Icon
    if (elements.btnSidebarSearch) {
      elements.btnSidebarSearch.addEventListener("click", (e) => {
        e.stopPropagation();
        if (elements.sidebar && elements.sidebar.classList.contains("collapsed")) {
          elements.sidebar.classList.remove("collapsed");
        }
        const bar = elements.sidebarSearchBar;
        if (bar) {
          bar.style.display = "block";
          if (elements.inputSearchSessions) {
            setTimeout(() => elements.inputSearchSessions.focus(), 60);
          }
        }
      });
    }

    // 17. Sidebar Search Input - Real-time filter
    if (elements.inputSearchSessions) {
      elements.inputSearchSessions.addEventListener("input", (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        renderSessionsFromState();
      });
    }

    // 18. Filter Sessions (Tất cả / Chỉ ghim)
    if (elements.btnFilterSessions) {
      elements.btnFilterSessions.addEventListener("click", (e) => {
        e.stopPropagation();
        state.filterMode = state.filterMode === "all" ? "pinned" : "all";
        elements.btnFilterSessions.innerHTML = state.filterMode === "pinned"
          ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`
          : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>`;
        elements.btnFilterSessions.title = state.filterMode === "pinned"
          ? "Đang lọc: Chỉ ghim - Bấm để xem tất cả"
          : "Lọc: Tất cả / Chỉ ghim";
        showToast(
          state.filterMode === "pinned" ? "Đang hiện các hội thoại đã ghim." : "Hiện tất cả hội thoại.",
          "info",
          1800
        );
        renderSessionsFromState();
      });
    }

    // 19. Sidebar Settings Gear → Open Student Settings Modal
    if (elements.btnSidebarSettings) {
      elements.btnSidebarSettings.addEventListener("click", () => {
        openStudentSettingsModal();
      });
    }

    // 20. RAG Mode Badge Button → Open/close dropdown
    if (elements.btnRagMode && elements.ragModeDropdown) {
      elements.btnRagMode.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = elements.ragModeDropdown.style.display === "block";
        elements.ragModeDropdown.style.display = isOpen ? "none" : "block";
      });

      // Close on outside click
      document.addEventListener("click", (e) => {
        if (
          elements.ragModeDropdown &&
          elements.ragModeDropdown.style.display === "block" &&
          !elements.ragModeDropdown.contains(e.target) &&
          !elements.btnRagMode.contains(e.target)
        ) {
          elements.ragModeDropdown.style.display = "none";
        }
      });

      // RAG mode items
      elements.ragModeDropdown.querySelectorAll(".rag-mode-item").forEach((btn) => {
        btn.addEventListener("click", () => {
          const mode = btn.getAttribute("data-mode");
          state.ragMode = mode;
          elements.ragModeDropdown.querySelectorAll(".rag-mode-item").forEach((b) => b.classList.remove("active-mode"));
          btn.classList.add("active-mode");
          elements.ragModeDropdown.style.display = "none";
          const modeLabel = mode === "fast" ? "⚡ Trả lời nhanh" : "📖 Phân tích chi tiết";
          if (elements.btnRagMode) {
            elements.btnRagMode.innerHTML = `${modeLabel} <span>⌄</span>`;
          }
          showToast(
            mode === "fast"
              ? "Chế độ: Trả lời nhanh súc tích đã bật."
              : "Chế độ: Phân tích chi tiết kèm điều khoản đã bật.",
            "info",
            2000
          );
        });
      });
    }

    // 16. Global Keyboard Shortcuts
    document.addEventListener("keydown", (e) => {
      // Alt+C: Toggle GPA Calculator Modal
      if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        if (elements.modalGpaCalc && elements.modalGpaCalc.style.display === "flex") {
          closeGpaCalcModal();
        } else {
          openGpaCalcModal();
        }
      }
      // Esc: Close any popovers or modals
      if (e.key === "Escape") {
        closeGeminiUploadMenu();
        if (elements.ragModeDropdown) elements.ragModeDropdown.style.display = "none";
      }
    });
  } // end setupEventListeners

  // =========================================================================
  // Gemini Omnibox: Plus Button & Popover Menu Events
  // =========================================================================

  function setupGeminiOmniboxMenuEvents() {
    if (!elements.btnPlusMenu || !elements.geminiUploadMenu) return;

    elements.btnPlusMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = elements.geminiUploadMenu.style.display === "block";
      if (isOpen) {
        closeGeminiUploadMenu();
      } else {
        openGeminiUploadMenu();
      }
    });

    document.addEventListener("click", (e) => {
      if (
        elements.geminiUploadMenu &&
        elements.geminiUploadMenu.style.display === "block" &&
        !elements.geminiUploadMenu.contains(e.target) &&
        !elements.btnPlusMenu.contains(e.target)
      ) {
        closeGeminiUploadMenu();
      }
    });

    // 1. Document (.pdf, .txt)
    if (elements.menuOptDoc && elements.menuInputDoc) {
      elements.menuOptDoc.addEventListener("click", () => {
        closeGeminiUploadMenu();
        elements.menuInputDoc.click();
      });
      elements.menuInputDoc.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileAttachmentSelected(e.target.files[0], "doc");
        }
      });
    }

    // 2. Image / Scan OCR (.png, .jpg, .webp)
    if (elements.menuOptImage && elements.menuInputImage) {
      elements.menuOptImage.addEventListener("click", () => {
        closeGeminiUploadMenu();
        elements.menuInputImage.click();
      });
      elements.menuInputImage.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileAttachmentSelected(e.target.files[0], "image");
        }
      });
    }

    // 3. Live Camera Scan
    if (elements.menuOptCamera) {
      elements.menuOptCamera.addEventListener("click", () => {
        closeGeminiUploadMenu();
        openCameraScannerModal();
      });
    }

    // 4. Video / Audio Lecture (.mp4, .webm, .mp3, .wav)
    if (elements.menuOptMedia && elements.menuInputMedia) {
      elements.menuOptMedia.addEventListener("click", () => {
        closeGeminiUploadMenu();
        elements.menuInputMedia.click();
      });
      elements.menuInputMedia.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileAttachmentSelected(e.target.files[0], "media");
        }
      });
    }

    // 5. Voice Dictation Mode
    if (elements.menuOptVoice) {
      elements.menuOptVoice.addEventListener("click", () => {
        closeGeminiUploadMenu();
        if (window.VoiceManager) {
          window.VoiceManager.toggleRecording(
            (recognizedText) => {
              if (elements.chatInput) {
                elements.chatInput.value = recognizedText;
                handleSendMessage();
              }
            },
            (isRecording) => {
              if (isRecording) {
                elements.btnMic?.classList.add("recording");
                showToast("Đang lắng nghe... Nói nội dung quy chế cần tra cứu.", "info", 3500);
              } else {
                elements.btnMic?.classList.remove("recording");
              }
            }
          );
        } else {
          showToast("Trình duyệt không hỗ trợ Web Speech API.", "error");
        }
      });
    }

    // 6. GPA Calculator
    if (elements.menuOptGpa) {
      elements.menuOptGpa.addEventListener("click", () => {
        closeGeminiUploadMenu();
        openGpaCalcModal();
      });
    }
  }

  function openGeminiUploadMenu() {
    if (!elements.geminiUploadMenu || !elements.btnPlusMenu) return;
    elements.geminiUploadMenu.style.display = "block";
    elements.btnPlusMenu.classList.add("open");
    elements.btnPlusMenu.setAttribute("aria-expanded", "true");
  }

  function closeGeminiUploadMenu() {
    if (!elements.geminiUploadMenu || !elements.btnPlusMenu) return;
    elements.geminiUploadMenu.style.display = "none";
    elements.btnPlusMenu.classList.remove("open");
    elements.btnPlusMenu.setAttribute("aria-expanded", "false");
  }

  // =========================================================================
  // Attachment Preview Bar Handling
  // =========================================================================
  function setupAttachmentBarEvents() {
    if (elements.btnCancelAttachment) {
      elements.btnCancelAttachment.addEventListener("click", clearAttachmentBar);
    }
    if (elements.btnUploadAttachment) {
      elements.btnUploadAttachment.addEventListener("click", handleUploadAttachmentToVectorDB);
    }
  }

  function handleFileAttachmentSelected(file, type = "doc") {
    state.selectedAttachmentFile = file;

    let icon = "📎";
    if (type === "doc") {
      icon = file.name.endsWith(".pdf") ? "📄" : "📝";
    } else if (type === "image") {
      icon = "🖼️";
    } else if (type === "media") {
      icon = file.name.match(/\.(mp4|webm)$/i) ? "🎬" : "🎵";
    }

    if (elements.attachmentIcon) elements.attachmentIcon.textContent = icon;
    if (elements.attachmentName) elements.attachmentName.textContent = file.name;

    const sizeKb = (file.size / 1024);
    const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(2)} MB` : `${sizeKb.toFixed(1)} KB`;
    if (elements.attachmentSize) elements.attachmentSize.textContent = sizeStr;

    if (elements.attachmentTitleInput) {
      const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      elements.attachmentTitleInput.value = baseName;
    }

    if (elements.chatAttachmentBar) {
      elements.chatAttachmentBar.style.display = "flex";
    }

    showToast(`Đã đính kèm "${file.name}". Bấm 'Nạp ngay' để lập chỉ mục.`, "info", 3500);
  }

  function clearAttachmentBar() {
    state.selectedAttachmentFile = null;
    if (elements.chatAttachmentBar) {
      elements.chatAttachmentBar.style.display = "none";
    }
    if (elements.attachmentTitleInput) {
      elements.attachmentTitleInput.value = "";
    }
    if (elements.menuInputDoc) elements.menuInputDoc.value = "";
    if (elements.menuInputImage) elements.menuInputImage.value = "";
    if (elements.menuInputMedia) elements.menuInputMedia.value = "";
  }

  async function handleUploadAttachmentToVectorDB() {
    if (!state.selectedAttachmentFile) {
      showToast("Vui lòng chọn tệp đính kèm.", "info");
      return;
    }

    const file = state.selectedAttachmentFile;
    const title = elements.attachmentTitleInput ? elements.attachmentTitleInput.value.trim() : "";
    const uploadBtn = elements.btnUploadAttachment;

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `<span>⏳ Đang xử lý...</span>`;

    try {
      showToast(`Đang phân tích và nạp tệp "${file.name}" vào cơ sở tri thức...`, "info", 8000);
      const res = await window.ApiService.uploadDocument(file, title, state.studentId);
      showToast(`Nạp thành công! Đã trích xuất ${res.total_chunks || 0} đoạn quy chế.`, "success", 4500);

      clearAttachmentBar();
      await loadDocuments();
    } catch (err) {
      showToast(`Lỗi khi nạp tệp: ${err.message}`, "error", 6000);
    } finally {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = `<span>🚀 Nạp ngay</span>`;
      }
    }
  }

  // =========================================================================
  // Chat Sessions History (Sidebar: Single-Line Titles Only)
  // =========================================================================
  async function loadSessionsList() {
    if (!elements.chatSessionsList) return;

    try {
      const data = await window.ApiService.getSessions(50, state.studentId);
      const sessions = data.sessions || [];
      state.allSessionsList = sessions;
      state.sessionsList = sessions;
      renderSessionsFromState();
    } catch (err) {
      console.warn("Could not load sessions list:", err);
    }
  }

  function renderSessionsFromState() {
    let sessions = [...(state.allSessionsList || [])];

    // Real-time filter by search query
    if (state.searchQuery && state.searchQuery.trim()) {
      const q = state.searchQuery.trim().toLowerCase();
      sessions = sessions.filter((s) => (s.title || "").toLowerCase().includes(q));
    }

    // Filter by pinned mode
    if (state.filterMode === "pinned") {
      sessions = sessions.filter((s) => s.is_pinned);
    }

    const pinnedSessions = sessions.filter((s) => s.is_pinned);
    const recentSessions = sessions.filter((s) => !s.is_pinned);

    // 1. Render Pinned Group
    if (elements.sessionsPinnedGroup && elements.sessionsPinnedList) {
      if (pinnedSessions.length > 0) {
        elements.sessionsPinnedGroup.style.display = "block";
        elements.sessionsPinnedList.innerHTML = "";
        pinnedSessions.forEach((s) => {
          elements.sessionsPinnedList.appendChild(createSessionItemElement(s));
        });
      } else {
        elements.sessionsPinnedGroup.style.display = "none";
        elements.sessionsPinnedList.innerHTML = "";
      }
    }

    // 2. Render Recent Group
    if (elements.sessionsRecentGroup && elements.sessionsRecentList) {
      elements.sessionsRecentList.innerHTML = "";
      if (recentSessions.length > 0) {
        recentSessions.forEach((s) => {
          elements.sessionsRecentList.appendChild(createSessionItemElement(s));
        });
      } else if (pinnedSessions.length === 0) {
        const hintText = state.searchQuery
          ? "Không tìm thấy cuộc trò chuyện phù hợp"
          : (state.filterMode === "pinned" ? "Chưa có cuộc trò chuyện nào được ghim" : "Chưa có lịch sử cuộc trò chuyện");
        elements.sessionsRecentList.innerHTML = `<div class="empty-sessions-hint">${hintText}</div>`;
      }
    }
  }

  function createSessionItemElement(session) {
    const item = document.createElement("div");
    item.className = `session-item ${session.session_id === state.sessionId ? "active" : ""}`;
    item.setAttribute("data-session-id", session.session_id);

    const titleText = session.title || "Cuộc trò chuyện mới";

    // ULTRA-MINIMALIST SINGLE LINE (No subtext, no timestamps, no bubble icons)
    item.innerHTML = `
      <span class="session-title" title="${escapeHtml(titleText)}">${escapeHtml(titleText)}</span>
      <div class="session-actions">
        <button type="button" class="btn-session-action btn-pin-session ${session.is_pinned ? 'is-pinned' : ''}" title="${session.is_pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="17" x2="12" y2="22"></line>
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
          </svg>
        </button>
        <button type="button" class="btn-session-action btn-rename-session" title="Đổi tên cuộc trò chuyện">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>
        <button type="button" class="btn-session-action btn-word-session" title="Xuất file Word (.doc)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </button>
        <button type="button" class="btn-session-action btn-delete-session" title="Xóa cuộc trò chuyện này">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>
    `;

    // Click item to switch conversation
    item.addEventListener("click", () => {
      switchSession(session.session_id);
    });

    // Action: Pin / Unpin
    const btnPin = item.querySelector(".btn-pin-session");
    btnPin.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePinSession(session.session_id, !session.is_pinned);
    });

    // Action: Rename
    const btnRename = item.querySelector(".btn-rename-session");
    btnRename.addEventListener("click", (e) => {
      e.stopPropagation();
      openRenameModal(session.session_id, session.title);
    });

    // Action: Word Export
    const btnWord = item.querySelector(".btn-word-session");
    btnWord.addEventListener("click", (e) => {
      e.stopPropagation();
      exportWordForSession(session.session_id);
    });

    // Action: Delete
    const btnDelete = item.querySelector(".btn-delete-session");
    btnDelete.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSession(session.session_id);
    });

    return item;
  }

  async function switchSession(targetSessionId) {
    state.sessionId = targetSessionId;
    localStorage.setItem("ntu_edubot_session_id", targetSessionId);

    // Update active highlight in sidebar
    if (elements.btnNewChat) {
      elements.btnNewChat.classList.remove("active-nav");
    }
    document.querySelectorAll(".session-item").forEach((el) => {
      if (el.getAttribute("data-session-id") === targetSessionId) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });

    // Clear current chat display
    if (elements.chatMessages) {
      elements.chatMessages.innerHTML = "";
    }

    try {
      const history = await window.ApiService.getChatHistory(targetSessionId);
      if (history && history.messages && history.messages.length > 0) {
        // Exit Home Mode -> Active Chat Mode
        if (elements.mainChat) {
          elements.mainChat.classList.remove("home-mode");
        }

        // Show Word Export Button in Topbar
        if (elements.btnExportWordTopbar) {
          elements.btnExportWordTopbar.style.display = "inline-flex";
        }

        history.messages.forEach((msg) => {
          renderMessageBubble(msg.role, msg.content, msg.sources);
        });
        scrollToBottom();
      } else {
        // Empty session -> Return to Home Mode
        if (elements.mainChat) {
          elements.mainChat.classList.add("home-mode");
        }
        if (elements.btnExportWordTopbar) {
          elements.btnExportWordTopbar.style.display = "none";
        }
      }
    } catch (e) {
      console.warn("Could not switch to session:", e);
      showToast("Không thể tải tin nhắn của phiên này.", "error");
    }
  }

  async function togglePinSession(sessionId, newPinnedState) {
    try {
      await window.ApiService.updateSession(sessionId, { is_pinned: newPinnedState });
      showToast(newPinnedState ? "Đã ghim cuộc trò chuyện lên đầu." : "Đã bỏ ghim cuộc trò chuyện.", "success", 2000);
      await loadSessionsList();
    } catch (err) {
      showToast(`Không thể thay đổi ghim: ${err.message}`, "error");
    }
  }

  function exportWordForSession(sessionId) {
    try {
      showToast("Đang kết xuất và tải về file Word (.doc)...", "info", 3000);
      window.ApiService.exportSessionWord(sessionId);
    } catch (err) {
      showToast(`Lỗi xuất file Word: ${err.message}`, "error");
    }
  }

  function deleteSession(sessionId) {
    const s = (state.allSessionsList || []).find((item) => item.session_id === sessionId);
    const title = s ? s.title : "Cuộc trò chuyện này";
    openConfirmDeleteModal(sessionId, title);
  }

  // =========================================================================
  // Chat Message Sending & Streaming Execution
  // =========================================================================
  async function handleSendMessage() {
    if (state.isProcessing) return;

    const question = elements.chatInput.value.trim();
    if (!question) return;

    state.currentQuestion = question;

    // Reset input box height
    elements.chatInput.value = "";
    elements.chatInput.style.height = "auto";

    // 1. Transition immediately from Home Mode to Active Chat Mode!
    if (elements.mainChat) {
      elements.mainChat.classList.remove("home-mode");
    }

    // 2. Render User message bubble
    renderMessageBubble("user", question);
    scrollToBottom();

    // 3. Prepare Bot response placeholder
    state.isProcessing = true;
    elements.btnSend.disabled = true;

    const botMsgElements = createBotMessagePlaceholder();
    scrollToBottom();

    let fullAnswer = "";
    let accumulatedSources = [];

    const removeTypingDots = () => {
      if (botMsgElements.typingIndicator && botMsgElements.typingIndicator.parentNode) {
        botMsgElements.typingIndicator.remove();
      }
      botMsgElements.bubble.querySelectorAll(".typing-indicator").forEach((el) => el.remove());
    };

    // 4. Initiate SSE Streaming
    await window.ApiService.streamChat(state.sessionId, question, state.topK, {
      onSources: (sources) => {
        accumulatedSources = sources || [];
        renderSourcesCard(botMsgElements.sourcesContainer, accumulatedSources, question);
        scrollToBottom();
      },
      onToken: (token) => {
        removeTypingDots();
        fullAnswer += token;
        botMsgElements.contentBox.innerHTML = formatMarkdown(fullAnswer);
        botMsgElements.contentBox.appendChild(botMsgElements.cursor);
        scrollToBottom();
      },
      onDone: () => {
        removeTypingDots();
        if (botMsgElements.cursor) {
          botMsgElements.cursor.remove();
        }

        // Add Action Buttons: Copy & TTS
        attachMessageActions(botMsgElements.actionsContainer, fullAnswer, question);

        // Add 3 Dynamic Follow-up Question Chips
        attachFollowupChips(botMsgElements.followupContainer, question, fullAnswer);

        // Show Word Export button in Topbar
        if (elements.btnExportWordTopbar) {
          elements.btnExportWordTopbar.style.display = "inline-flex";
        }

        // Auto-TTS if enabled
        if (state.autoTTS && window.VoiceManager) {
          window.VoiceManager.speak(fullAnswer);
        }

        state.isProcessing = false;
        elements.btnSend.disabled = false;
        elements.chatInput.focus();
        scrollToBottom();

        // Refresh Sidebar Sessions List
        loadSessionsList();
      },
      onError: (err) => {
        removeTypingDots();
        if (botMsgElements.cursor) {
          botMsgElements.cursor.remove();
        }

        const friendlyNotice = "Sever đang bảo trì sinh viên vui lòng chờ !!!";
        botMsgElements.contentBox.innerHTML = `
          <div class="maintenance-notice-card">
            <span class="notice-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </span>
            <div>
              <div class="notice-title">Thông báo hệ thống</div>
              <div class="notice-body">${friendlyNotice}</div>
            </div>
          </div>
        `;
        state.isProcessing = false;
        elements.btnSend.disabled = false;
        showToast(friendlyNotice, "error", 6000);
      },
    });
  }

  // =========================================================================
  // DOM Message Rendering Helpers
  // =========================================================================
  function renderMessageBubble(role, content, sources = []) {
    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    if (role === "user") {
      row.innerHTML = `
        <div class="bubble">${escapeHtml(content).replace(/\n/g, "<br>")}</div>
      `;
    } else {
      const bubble = document.createElement("div");
      bubble.className = "bubble";

      const contentDiv = document.createElement("div");
      contentDiv.className = "bot-markdown";
      contentDiv.innerHTML = formatMarkdown(content);
      bubble.appendChild(contentDiv);

      if (sources && sources.length > 0) {
        const sourcesDiv = document.createElement("div");
        renderSourcesCard(sourcesDiv, sources, content);
        bubble.appendChild(sourcesDiv);
      }

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "message-actions";
      attachMessageActions(actionsDiv, content, "");
      bubble.appendChild(actionsDiv);

      const followupDiv = document.createElement("div");
      followupDiv.className = "followup-container";
      attachFollowupChips(followupDiv, "", content);
      bubble.appendChild(followupDiv);

      row.innerHTML = `
        <div class="avatar bot-avatar">
          <img src="/assets/ntu-logo.svg" alt="NTU Logo">
        </div>
      `;
      row.appendChild(bubble);
    }

    elements.chatMessages.appendChild(row);
  }

  function createBotMessagePlaceholder() {
    const row = document.createElement("div");
    row.className = "message-row bot";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const contentBox = document.createElement("div");
    contentBox.className = "bot-markdown";

    const typingIndicator = document.createElement("div");
    typingIndicator.className = "typing-indicator";
    typingIndicator.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
    contentBox.appendChild(typingIndicator);

    const cursor = document.createElement("span");
    cursor.className = "streaming-cursor";

    const sourcesContainer = document.createElement("div");
    const actionsContainer = document.createElement("div");
    actionsContainer.className = "message-actions";

    const followupContainer = document.createElement("div");
    followupContainer.className = "followup-container";

    bubble.appendChild(contentBox);
    bubble.appendChild(sourcesContainer);
    bubble.appendChild(actionsContainer);
    bubble.appendChild(followupContainer);

    row.innerHTML = `
      <div class="avatar bot-avatar">
        <img src="/assets/ntu-logo.svg" alt="NTU Logo">
      </div>
    `;
    row.appendChild(bubble);

    elements.chatMessages.appendChild(row);

    return {
      row,
      bubble,
      contentBox,
      typingIndicator,
      cursor,
      sourcesContainer,
      actionsContainer,
      followupContainer,
    };
  }

  function renderSourcesCard(container, sources, queryText = "") {
    if (!sources || sources.length === 0) return;

    container.className = "sources-card";
    container.innerHTML = `
      <div class="sources-toggle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
          <path d="M7 7h.01"/>
        </svg>
        <span>Căn cứ pháp lý trích dẫn (${sources.length} tài liệu)</span>
      </div>
      <div class="sources-list">
        ${sources
          .map((src, idx) => {
            const articleBadge = src.article ? src.article : "Quy chế NTU";
            const docTitle = src.title || src.doc_title || "Quy chế Đào tạo NTU";
            const clauseText = src.clause ? ` - ${src.clause}` : "";
            const displayTitle = `${docTitle}${clauseText}`;
            const numScore = Number(src.score || 0.85);
            const scorePercent = (numScore * 100).toFixed(1);

            return `
              <div class="source-item" data-index="${idx}" title="Bấm để xem nguyên văn căn cứ pháp lý">
                <span class="source-article-badge">${escapeHtml(articleBadge)}</span>
                <span class="source-title-line" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</span>
                <div class="source-meter-wrap">
                  <div class="source-progress-bar">
                    <div class="source-progress-fill" style="width: ${scorePercent}%"></div>
                  </div>
                  <span class="source-score-text">${scorePercent}%</span>
                </div>
                <span class="btn-source-view">Xem ➔</span>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    const sourceElements = container.querySelectorAll(".source-item");
    sourceElements.forEach((el) => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.getAttribute("data-index"), 10);
        if (!isNaN(idx) && sources[idx]) {
          openCitationModal(sources[idx], queryText);
        }
      });
    });
  }

  function attachMessageActions(container, text, question) {
    container.innerHTML = "";

    // 1. Copy Button
    const btnCopy = document.createElement("button");
    btnCopy.type = "button";
    btnCopy.className = "btn-msg-action";
    btnCopy.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Sao chép</span>
    `;

    btnCopy.addEventListener("click", () => {
      const plainText = text.replace(/[*_#`>]/g, "").trim();
      navigator.clipboard.writeText(plainText).then(() => {
        btnCopy.querySelector("span").textContent = "Đã chép";
        showToast("Đã sao chép câu trả lời vào clipboard!", "success");
        setTimeout(() => {
          btnCopy.querySelector("span").textContent = "Sao chép";
        }, 2500);
      }).catch(() => {
        showToast("Không thể sao chép văn bản.", "error");
      });
    });
    container.appendChild(btnCopy);

    // 2. TTS Button
    const btnTTS = document.createElement("button");
    btnTTS.type = "button";
    btnTTS.className = "btn-msg-action";
    btnTTS.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
      <span>Nghe đọc</span>
    `;

    btnTTS.addEventListener("click", () => {
      if (!window.VoiceManager) return;

      if (window.VoiceManager.isSpeaking()) {
        window.VoiceManager.stopSpeaking();
        btnTTS.querySelector("span").textContent = "Nghe đọc";
      } else {
        btnTTS.querySelector("span").textContent = "Đang đọc...";
        window.VoiceManager.speak(
          text,
          () => {},
          () => {
            btnTTS.querySelector("span").textContent = "Nghe đọc";
          }
        );
      }
    });
    container.appendChild(btnTTS);
  }

  function attachFollowupChips(container, question, answer) {
    container.innerHTML = "";
    const chips = generateFollowupQuestions(question, answer);
    if (!chips || chips.length === 0) return;

    container.innerHTML = `
      <div class="followup-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 16 16 12 12 8"></polyline>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <span>Gợi ý câu hỏi tiếp theo:</span>
      </div>
      <div class="followup-chips"></div>
    `;

    const chipsContainer = container.querySelector(".followup-chips");
    chips.forEach((chipText) => {
      const chipBtn = document.createElement("button");
      chipBtn.type = "button";
      chipBtn.className = "followup-chip";
      chipBtn.innerHTML = `<span>💬</span><span>${escapeHtml(chipText)}</span>`;

      chipBtn.addEventListener("click", () => {
        if (elements.chatInput) {
          elements.chatInput.value = chipText;
          elements.chatInput.focus();
          handleSendMessage();
        }
      });

      chipsContainer.appendChild(chipBtn);
    });
  }

  function generateFollowupQuestions(question, answer) {
    const combined = `${question} ${answer}`.toLowerCase();

    if (combined.includes("học bổng") || combined.includes("rèn luyện") || combined.includes("điều 12") || combined.includes("điều 13")) {
      return [
        "Học bổng Xuất sắc được hỗ trợ bao nhiêu % học phí?",
        "Điểm rèn luyện từ bao nhiêu điểm thì đủ điều kiện học bổng?",
        "Sinh viên có môn phải học lại có được xét học bổng không?",
      ];
    }

    if (combined.includes("cảnh báo") || combined.includes("buộc thôi học") || combined.includes("điều 7")) {
      return [
        "Bị cảnh báo học vụ mấy lần liên tiếp thì bị buộc thôi học?",
        "Sinh viên bị cảnh báo học vụ được đăng ký tối đa bao nhiêu tín chỉ?",
        "Điều kiện để được xóa cảnh báo học vụ trong kỳ tiếp theo?",
      ];
    }

    if (combined.includes("học lại") || combined.includes("cải thiện") || combined.includes("điểm f")) {
      return [
        "Học phần bị điểm F có bắt buộc phải đăng ký học lại không?",
        "Điểm C có được đăng ký học cải thiện điểm không?",
        "Điểm sau khi học cải thiện được tính vào ĐTBCTL như thế nào?",
      ];
    }

    if (combined.includes("tốt nghiệp") || combined.includes("đồ án") || combined.includes("khóa luận")) {
      return [
        "Điều kiện về số tín chỉ tích lũy để được làm đồ án tốt nghiệp?",
        "Chuẩn đầu ra Ngoại ngữ (tiếng Anh) tốt nghiệp NTU yêu cầu gì?",
        "Trường hợp nào sinh viên tốt nghiệp loại Giỏi bị hạ một bậc xếp loại?",
      ];
    }

    return [
      "Điều kiện xét học bổng khuyến khích học tập tại NTU?",
      "Sinh viên bị cảnh báo học vụ khi điểm TBHK dưới bao nhiêu?",
      "Quy định về chuẩn đầu ra ngoại ngữ và tin học khi tốt nghiệp?",
    ];
  }

  function scrollToBottom() {
    if (elements.chatMessages) {
      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
  }

  // =========================================================================
  // Modal 5: Regulation Documents Library (Thư viện Quy chế NTU)
  // =========================================================================
  function setupDocsLibraryModalEvents() {
    if (elements.btnCloseDocsModal) {
      elements.btnCloseDocsModal.addEventListener("click", closeDocsLibraryModal);
    }
    if (elements.btnDismissDocsModal) {
      elements.btnDismissDocsModal.addEventListener("click", closeDocsLibraryModal);
    }
    if (elements.modalDocsLibrary) {
      elements.modalDocsLibrary.addEventListener("click", (e) => {
        if (e.target === elements.modalDocsLibrary) closeDocsLibraryModal();
      });
    }

    // Choose File Button
    if (elements.btnChooseFileModal && elements.fileInput) {
      elements.btnChooseFileModal.addEventListener("click", () => {
        elements.fileInput.click();
      });
    }

    // File Input Change
    if (elements.fileInput) {
      elements.fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          state.selectedFile = file;
          if (elements.dropzoneText) {
            elements.dropzoneText.textContent = `Đã chọn: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
          }
          if (elements.docTitleInput && !elements.docTitleInput.value) {
            elements.docTitleInput.value = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          }
          if (elements.btnUpload) elements.btnUpload.disabled = false;
        }
      });
    }

    // Upload Button inside Modal
    if (elements.btnUpload) {
      elements.btnUpload.addEventListener("click", handleModalDocumentUpload);
    }
  }

  function openDocsLibraryModal() {
    if (elements.modalDocsLibrary) {
      elements.modalDocsLibrary.style.display = "flex";
      elements.modalDocsLibrary.setAttribute("aria-hidden", "false");
      loadDocuments();
    }
  }

  function closeDocsLibraryModal() {
    if (elements.modalDocsLibrary) {
      elements.modalDocsLibrary.style.display = "none";
      elements.modalDocsLibrary.setAttribute("aria-hidden", "true");
    }
  }

  async function handleModalDocumentUpload() {
    if (!state.selectedFile) {
      showToast("Vui lòng chọn tệp tài liệu trước.", "info");
      return;
    }

    const title = elements.docTitleInput ? elements.docTitleInput.value.trim() : "";
    const uploadBtn = elements.btnUpload;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `<span>⏳ Đang xử lý...</span>`;

    try {
      showToast(`Đang phân tích và nạp tệp "${state.selectedFile.name}"...`, "info", 8000);
      const res = await window.ApiService.uploadDocument(state.selectedFile, title, state.studentId);
      showToast(`Nạp thành công! Đã trích xuất ${res.total_chunks || 0} đoạn trích.`, "success");

      state.selectedFile = null;
      if (elements.fileInput) elements.fileInput.value = "";
      if (elements.docTitleInput) elements.docTitleInput.value = "";
      if (elements.dropzoneText) elements.dropzoneText.textContent = "Hỗ trợ PDF, Text, Ảnh Scan OCR hoặc Video/Audio bài giảng.";

      await loadDocuments();
    } catch (err) {
      showToast(`Lỗi nạp tài liệu: ${err.message}`, "error", 6000);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = `<span>🚀 Nạp vào Kho Tri thức</span>`;
    }
  }

  async function loadDocuments() {
    if (!elements.documentsList) return;

    try {
      const rawDocs = await window.ApiService.getDocuments(state.studentId);
      elements.documentsList.innerHTML = "";

      // Phân quyền: Lọc bỏ hoàn toàn tài liệu gốc Nhà trường (ntu_quy_che_2026) khỏi danh sách chỉnh sửa/xóa của sinh viên
      const studentDocs = (rawDocs || []).filter(
        (doc) =>
          !doc.is_system_doc &&
          doc.doc_id !== "ntu_quy_che_2026" &&
          doc.filename !== "quy_che_dao_tao_ntu.txt"
      );

      if (elements.docCountBadge) {
        elements.docCountBadge.textContent = `${studentDocs.length}`;
      }

      if (studentDocs.length === 0) {
        elements.documentsList.innerHTML = `
          <div style="font-size:0.85rem; color:#8e918f; padding:22px 0; text-align:center;">
            Bạn chưa nạp tài liệu riêng nào.<br>
            <span style="font-size:0.78rem; color:#6b7280;">(Tài liệu gốc của Nhà trường vẫn được hệ thống RAG dùng trả lời tự động ngầm).</span>
          </div>`;
        return;
      }

      studentDocs.forEach((doc) => {
        const item = document.createElement("div");
        item.className = "doc-item";

        const titleText = doc.title || doc.filename || "Tài liệu sinh viên";
        const chunksCount = doc.total_chunks || 0;

        item.innerHTML = `
          <div class="doc-info" title="${escapeHtml(titleText)}">
            <span class="doc-name">${escapeHtml(titleText)}</span>
            <span class="doc-meta">
              <span>${chunksCount} đoạn trích</span>
              <span>•</span>
              <span>${doc.filename ? escapeHtml(doc.filename.slice(0, 26)) : "Tài liệu"}</span>
            </span>
          </div>
          <div class="doc-actions" style="display:flex; gap:6px; align-items:center;">
            <button type="button" class="btn-session-action btn-doc-action-view" title="Xem nội dung đã trích xuất" data-docid="${doc.doc_id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button type="button" class="btn-session-action btn-doc-action-rename" title="Đổi tên tài liệu" data-docid="${doc.doc_id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            <button type="button" class="btn-session-action btn-doc-action-delete" title="Xóa tài liệu này" data-docid="${doc.doc_id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        `;

        // 1. Xem nội dung
        const viewBtn = item.querySelector(".btn-doc-action-view");
        viewBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openDocContentModal(doc.doc_id, titleText, doc.filename);
        });

        // 2. Sửa tên
        const renameBtn = item.querySelector(".btn-doc-action-rename");
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openDocRenameModal(doc.doc_id, titleText);
        });

        // 3. Xóa tài liệu
        const deleteBtn = item.querySelector(".btn-doc-action-delete");
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          deleteBtn.disabled = true;
          deleteBtn.innerHTML = `...`;

          try {
            await window.ApiService.deleteDocument(doc.doc_id);
            showToast("Đã xóa tài liệu khỏi cơ sở tri thức.", "success", 2500);
            await loadDocuments();
          } catch (delErr) {
            showToast(`Lỗi khi xóa: ${delErr.message}`, "error");
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
          }
        });

        elements.documentsList.appendChild(item);
      });
    } catch (e) {
      console.warn("Could not load documents list:", e);
    }
  }

  // =========================================================================
  // Citation Modal Logic
  // =========================================================================
  function setupCitationModalEvents() {
    if (elements.btnCloseCitation) elements.btnCloseCitation.addEventListener("click", closeCitationModal);
    if (elements.btnDismissCitation) elements.btnDismissCitation.addEventListener("click", closeCitationModal);
    if (elements.modalCitation) {
      elements.modalCitation.addEventListener("click", (e) => {
        if (e.target === elements.modalCitation) closeCitationModal();
      });
    }

    if (elements.btnCopyCitation) {
      elements.btnCopyCitation.addEventListener("click", () => {
        if (!state.activeCitation) return;
        const c = state.activeCitation;
        const textToCopy = `[CĂN CỨ PHÁP LÝ TRÍCH DẪN - ĐẠI HỌC NGUYỄN TRÃI]\n` +
          `Văn bản: ${c.title || c.doc_title || "Quy chế Đào tạo NTU"}\n` +
          `Điều/Khoản: ${c.article || ""}${c.clause ? " - " + c.clause : ""}\n` +
          `Độ tin cậy: ${c.score ? (c.score * 100).toFixed(1) + "%" : "Cao"}\n\n` +
          `NỘI DUNG NGUYÊN VĂN:\n${c.content || ""}`;

        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast("Đã sao chép trích dẫn căn cứ vào clipboard!", "success");
        }).catch(() => {
          showToast("Không thể sao chép vào clipboard.", "error");
        });
      });
    }
  }

  function openCitationModal(sourceItem, queryText = "") {
    state.activeCitation = sourceItem;

    if (elements.citationDocTitle) {
      elements.citationDocTitle.textContent = sourceItem.title || sourceItem.doc_title || "Quy chế Đào tạo trình độ Đại học - NTU";
    }

    const locText = [sourceItem.article, sourceItem.clause].filter(Boolean).join(" - ");
    if (elements.citationLocation) {
      elements.citationLocation.textContent = locText ? `Căn cứ: ${locText}` : "Căn cứ pháp lý trích dẫn";
    }

    if (elements.citationScore) {
      const scoreNum = sourceItem.score ? Number(sourceItem.score) : 0.85;
      elements.citationScore.textContent = `Độ tin cậy: ${(scoreNum * 100).toFixed(1)}%`;
    }

    if (elements.citationFilename) {
      elements.citationFilename.textContent = sourceItem.filename || "quy_che_dao_tao_ntu.txt";
    }

    if (elements.citationContent) {
      const rawContent = sourceItem.content || "(Không có nội dung nguyên văn trích xuất)";
      elements.citationContent.innerHTML = highlightKeywordsInText(rawContent, queryText || state.currentQuestion);
    }

    if (elements.modalCitation) {
      elements.modalCitation.style.display = "flex";
      elements.modalCitation.setAttribute("aria-hidden", "false");
    }
  }

  function closeCitationModal() {
    if (elements.modalCitation) {
      elements.modalCitation.style.display = "none";
      elements.modalCitation.setAttribute("aria-hidden", "true");
    }
  }

  function highlightKeywordsInText(text, query) {
    if (!text) return "";
    let safe = escapeHtml(text);
    if (!query) return safe;

    const tokens = query
      .toLowerCase()
      .split(/[\s,?\.\!]+/)
      .filter((w) => w.length > 2 && !["sinh", "viên", "trường", "được", "không", "cho", "của", "và"].includes(w));

    tokens.forEach((token) => {
      try {
        const regex = new RegExp(`(${token})`, "gi");
        safe = safe.replace(regex, '<span class="badge-legal">$1</span>');
      } catch {
        // Ignore
      }
    });

    return safe;
  }

  // =========================================================================
  // GPA & Scholarship Calculator Logic
  // =========================================================================
  function setupGpaCalculatorEvents() {
    if (elements.btnCloseGpaCalc) elements.btnCloseGpaCalc.addEventListener("click", closeGpaCalcModal);
    if (elements.btnDismissGpaCalc) elements.btnDismissGpaCalc.addEventListener("click", closeGpaCalcModal);
    if (elements.modalGpaCalc) {
      elements.modalGpaCalc.addEventListener("click", (e) => {
        if (e.target === elements.modalGpaCalc) closeGpaCalcModal();
      });
    }

    const calcInputs = [
      elements.inputCalcGpa,
      elements.inputCalcDrl,
      elements.inputCalcCredits,
      elements.selectCalcYear,
      elements.checkHasFail,
    ];
    calcInputs.forEach((input) => {
      if (input) {
        input.addEventListener("input", calculateGpaAndScholarship);
        input.addEventListener("change", calculateGpaAndScholarship);
      }
    });

    if (elements.inputScore10) {
      elements.inputScore10.addEventListener("input", convertScore10);
    }
  }

  function openGpaCalcModal() {
    if (elements.modalGpaCalc) {
      elements.modalGpaCalc.style.display = "flex";
      elements.modalGpaCalc.setAttribute("aria-hidden", "false");
      calculateGpaAndScholarship();
      convertScore10();
    }
  }

  function closeGpaCalcModal() {
    if (elements.modalGpaCalc) {
      elements.modalGpaCalc.style.display = "none";
      elements.modalGpaCalc.setAttribute("aria-hidden", "true");
    }
  }

  function calculateGpaAndScholarship() {
    const gpa = parseFloat(elements.inputCalcGpa?.value) || 0.0;
    const drl = parseInt(elements.inputCalcDrl?.value, 10) || 0;
    const credits = parseInt(elements.inputCalcCredits?.value, 10) || 0;
    const year = parseInt(elements.selectCalcYear?.value, 10) || 1;
    const hasFail = elements.checkHasFail ? elements.checkHasFail.checked : false;

    // Evaluate Scholarship
    let sBadgeText = "Chưa đạt";
    let sBadgeClass = "status-none";
    let sDetailText = "";

    if (credits < 15) {
      sBadgeText = "Không đủ điều kiện";
      sBadgeClass = "status-none";
      sDetailText = `Khối lượng tín chỉ (${credits} TC) chưa đạt mức tối thiểu 15 tín chỉ theo Khoản 2 Điều 12.`;
    } else if (hasFail) {
      sBadgeText = "Không đủ điều kiện";
      sBadgeClass = "status-none";
      sDetailText = `Không xét cấp học bổng do có môn điểm dưới C (D+, D, F) hoặc thi lại theo Điểm c Khoản 2 Điều 12.`;
    } else if (gpa >= 3.60 && drl >= 90) {
      sBadgeText = "Học bổng Xuất sắc";
      sBadgeClass = "status-excellent";
      sDetailText = `Đủ điều kiện xét cấp Học bổng loại Xuất sắc (Thưởng bằng 120% học phí kỳ theo Điều 13 NTU).`;
    } else if (gpa >= 3.20 && drl >= 80) {
      sBadgeText = "Học bổng Giỏi";
      sBadgeClass = "status-good";
      sDetailText = `Đủ điều kiện xét cấp Học bổng loại Giỏi (Thưởng bằng 100% học phí kỳ theo Điều 13 NTU).`;
    } else if (gpa >= 2.50 && drl >= 80) {
      sBadgeText = "Học bổng Khá";
      sBadgeClass = "status-safe";
      sDetailText = `Đủ điều kiện xét cấp Học bổng loại Khá (Thưởng bằng 80% học phí kỳ theo Điều 13 NTU).`;
    } else {
      sBadgeText = "Chưa đạt Học bổng";
      sBadgeClass = "status-none";
      sDetailText = `Cần ĐTBCHK ≥ 2.50 và Điểm rèn luyện ≥ 80 điểm để xét học bổng theo Điều 12.`;
    }

    if (elements.scholarshipBadge) {
      elements.scholarshipBadge.textContent = sBadgeText;
      elements.scholarshipBadge.className = `badge-status ${sBadgeClass}`;
    }
    if (elements.scholarshipDetail) {
      elements.scholarshipDetail.textContent = sDetailText;
    }

    // Evaluate Academic Warning
    let wBadgeText = "An toàn";
    let wBadgeClass = "status-safe";
    let wDetailText = "";

    if (gpa < 1.0) {
      wBadgeText = "Cảnh báo học vụ";
      wBadgeClass = "status-danger";
      wDetailText = `Cảnh báo: Điểm TBHK đạt ${gpa.toFixed(2)} (< 1.00) thuộc diện CẢNH BÁO HỌC VỤ theo Điều 7 NTU.`;
    } else if (gpa < (1.0 + year * 0.15)) {
      wBadgeText = "Cần nỗ lực";
      wBadgeClass = "status-none";
      wDetailText = `Điểm TBHK đạt ${gpa.toFixed(2)} ở mức cận an toàn cho Năm ${year}. Bạn nên học cải thiện môn điểm D.`;
    } else {
      wBadgeText = "Học lực An toàn";
      wBadgeClass = "status-safe";
      wDetailText = `Điểm TBHK đạt ${gpa.toFixed(2)} vững vàng trên ngưỡng cảnh báo học vụ.`;
    }

    if (elements.warningBadge) {
      elements.warningBadge.textContent = wBadgeText;
      elements.warningBadge.className = `badge-status ${wBadgeClass}`;
    }
    if (elements.warningDetail) {
      elements.warningDetail.textContent = wDetailText;
    }
  }

  function convertScore10() {
    const s10 = parseFloat(elements.inputScore10?.value) || 0.0;
    let gradeLetter = "F";
    let grade4 = "0.0";
    let rank = "Kém (Học lại)";
    let rowId = "row-grade-f";

    if (s10 >= 8.5) {
      gradeLetter = "A"; grade4 = "4.0"; rank = "Giỏi / Xuất sắc"; rowId = "row-grade-a";
    } else if (s10 >= 8.0) {
      gradeLetter = "B+"; grade4 = "3.5"; rank = "Khá giỏi"; rowId = "row-grade-bp";
    } else if (s10 >= 7.0) {
      gradeLetter = "B"; grade4 = "3.0"; rank = "Khá"; rowId = "row-grade-b";
    } else if (s10 >= 6.5) {
      gradeLetter = "C+"; grade4 = "2.5"; rank = "Trung bình khá"; rowId = "row-grade-cp";
    } else if (s10 >= 5.5) {
      gradeLetter = "C"; grade4 = "2.0"; rank = "Trung bình"; rowId = "row-grade-c";
    } else if (s10 >= 5.0) {
      gradeLetter = "D+"; grade4 = "1.5"; rank = "Trung bình yếu"; rowId = "row-grade-dp";
    } else if (s10 >= 4.0) {
      gradeLetter = "D"; grade4 = "1.0"; rank = "Đạt (Tích lũy)"; rowId = "row-grade-d";
    } else {
      gradeLetter = "F"; grade4 = "0.0"; rank = "Không đạt (Học lại)"; rowId = "row-grade-f";
    }

    if (elements.convertResultBadge) {
      elements.convertResultBadge.textContent = `Điểm ${gradeLetter} (${grade4}) - ${rank}`;
    }

    const allGradeRows = document.querySelectorAll(".mini-grade-table tbody tr");
    allGradeRows.forEach((r) => r.classList.remove("highlight-grade-row"));
    const targetRow = document.getElementById(rowId);
    if (targetRow) {
      targetRow.classList.add("highlight-grade-row");
    }
  }

  // =========================================================================
  // Live Camera Scanner Logic
  // =========================================================================
  function setupCameraScannerEvents() {
    if (elements.btnCloseScanner) elements.btnCloseScanner.addEventListener("click", closeCameraScannerModal);
    if (elements.modalCameraScanner) {
      elements.modalCameraScanner.addEventListener("click", (e) => {
        if (e.target === elements.modalCameraScanner) closeCameraScannerModal();
      });
    }

    if (elements.btnSwitchCamera) {
      elements.btnSwitchCamera.addEventListener("click", async () => {
        state.cameraFacingMode = state.cameraFacingMode === "environment" ? "user" : "environment";
        await startCameraStream();
      });
    }

    if (elements.btnCaptureScan) elements.btnCaptureScan.addEventListener("click", handleCaptureFrame);
    if (elements.btnRetakeScan) elements.btnRetakeScan.addEventListener("click", handleRetakeScan);
    if (elements.btnConfirmUploadScan) elements.btnConfirmUploadScan.addEventListener("click", handleConfirmUploadScan);
  }

  async function openCameraScannerModal() {
    if (!elements.modalCameraScanner) return;
    elements.modalCameraScanner.style.display = "flex";
    elements.modalCameraScanner.setAttribute("aria-hidden", "false");

    if (elements.scannerViewContainer) elements.scannerViewContainer.style.display = "flex";
    if (elements.scannerSnapshotView) elements.scannerSnapshotView.style.display = "none";
    if (elements.btnCaptureScan) elements.btnCaptureScan.style.display = "inline-flex";
    if (elements.btnConfirmUploadScan) elements.btnConfirmUploadScan.style.display = "none";

    const dateStr = new Date().toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (elements.scannerDocTitle) {
      elements.scannerDocTitle.value = `Tài liệu Scan Camera - ${dateStr}`;
    }

    await startCameraStream();
  }

  function closeCameraScannerModal() {
    stopCameraStream();
    if (elements.modalCameraScanner) {
      elements.modalCameraScanner.style.display = "none";
      elements.modalCameraScanner.setAttribute("aria-hidden", "true");
    }
  }

  async function startCameraStream() {
    stopCameraStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast("Trình duyệt không hỗ trợ WebRTC Camera trực tiếp.", "error", 5000);
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: state.cameraFacingMode || "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      state.mediaStream = stream;
      if (elements.cameraStream) {
        elements.cameraStream.srcObject = stream;
        elements.cameraStream.play().catch(() => {});
      }
    } catch (err) {
      showToast("Không thể mở Camera (chưa cấp quyền hoặc qua HTTP).", "error", 5000);
    }
  }

  function stopCameraStream() {
    if (state.mediaStream) {
      try {
        state.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {}
      state.mediaStream = null;
    }
    if (elements.cameraStream) {
      elements.cameraStream.srcObject = null;
    }
  }

  function handleCaptureFrame() {
    if (!elements.cameraStream || !elements.cameraCanvas) return;

    const video = elements.cameraStream;
    const canvas = elements.cameraCanvas;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        state.capturedBlob = blob;

        if (elements.scannerSnapshotImg) {
          elements.scannerSnapshotImg.src = URL.createObjectURL(blob);
        }
        if (elements.scannerViewContainer) elements.scannerViewContainer.style.display = "none";
        if (elements.scannerSnapshotView) elements.scannerSnapshotView.style.display = "flex";

        if (elements.btnCaptureScan) elements.btnCaptureScan.style.display = "none";
        if (elements.btnConfirmUploadScan) elements.btnConfirmUploadScan.style.display = "inline-flex";

        stopCameraStream();
        showToast("Đã chụp khung hình văn bản! Nhấn 'Nạp vào Kho Tri thức'.", "success");
      },
      "image/jpeg",
      0.95
    );
  }

  async function handleRetakeScan() {
    state.capturedBlob = null;
    if (elements.scannerSnapshotView) elements.scannerSnapshotView.style.display = "none";
    if (elements.scannerViewContainer) elements.scannerViewContainer.style.display = "flex";
    if (elements.btnConfirmUploadScan) elements.btnConfirmUploadScan.style.display = "none";
    if (elements.btnCaptureScan) elements.btnCaptureScan.style.display = "inline-flex";

    await startCameraStream();
  }

  async function handleConfirmUploadScan() {
    if (!state.capturedBlob) return;

    const title = elements.scannerDocTitle ? elements.scannerDocTitle.value.trim() : "";
    const uploadBtn = elements.btnConfirmUploadScan;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `<span>⏳ Đang nhận diện OCR...</span>`;

    try {
      showToast("Đang gửi ảnh lên máy chủ để xử lý OCR & Vector...", "info", 8000);
      const res = await window.ApiService.scanCameraDocument(state.capturedBlob, title, state.studentId);
      showToast(`Quét thành công! Đã trích xuất ${res.total_chunks} đoạn quy chế.`, "success", 4000);

      closeCameraScannerModal();
      await loadDocuments();
    } catch (err) {
      showToast(`Lỗi khi quét tài liệu: ${err.message}`, "error", 6000);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = `<span>🚀 Nạp vào Kho Tri thức</span>`;
    }
  }

  // =========================================================================
  // Rename Session Modal Logic
  // =========================================================================
  function setupRenameSessionModalEvents() {
    if (elements.btnCloseRename) elements.btnCloseRename.addEventListener("click", closeRenameModal);
    if (elements.btnCancelRename) elements.btnCancelRename.addEventListener("click", closeRenameModal);
    if (elements.modalRenameSession) {
      elements.modalRenameSession.addEventListener("click", (e) => {
        if (e.target === elements.modalRenameSession) closeRenameModal();
      });
    }
    if (elements.btnConfirmRename) elements.btnConfirmRename.addEventListener("click", handleConfirmRenameSession);
    if (elements.inputSessionRename) {
      elements.inputSessionRename.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleConfirmRenameSession();
        }
      });
    }
  }

  function openRenameModal(sessionId, currentTitle) {
    state.renamingSessionId = sessionId;
    if (elements.inputSessionRename) {
      elements.inputSessionRename.value = currentTitle || "";
    }
    if (elements.modalRenameSession) {
      elements.modalRenameSession.style.display = "flex";
      elements.modalRenameSession.setAttribute("aria-hidden", "false");
      setTimeout(() => elements.inputSessionRename?.focus(), 50);
    }
  }

  function closeRenameModal() {
    state.renamingSessionId = null;
    if (elements.modalRenameSession) {
      elements.modalRenameSession.style.display = "none";
      elements.modalRenameSession.setAttribute("aria-hidden", "true");
    }
  }

  async function handleConfirmRenameSession() {
    if (!state.renamingSessionId) return;

    const newTitle = elements.inputSessionRename ? elements.inputSessionRename.value.trim() : "";
    if (!newTitle) {
      showToast("Vui lòng nhập tiêu đề cho cuộc trò chuyện.", "info");
      return;
    }

    try {
      await window.ApiService.updateSession(state.renamingSessionId, { title: newTitle });
      showToast("Đã đổi tên cuộc trò chuyện thành công.", "success", 2000);
      closeRenameModal();
      await loadSessionsList();
    } catch (err) {
      showToast(`Lỗi khi đổi tên: ${err.message}`, "error");
    }
  }

  // =========================================================================
  // Health Status
  // =========================================================================
  async function refreshHealthStatus() {
    try {
      const health = await window.ApiService.checkHealth();
      if (elements.statusDot && elements.statusText) {
        if (health.status === "healthy") {
          elements.statusDot.className = "status-dot online";
          elements.statusText.textContent = "Hệ thống NTU RAG sẵn sàng";
        } else {
          elements.statusDot.className = "status-dot degraded";
          elements.statusText.textContent = "Chế độ RAG suy giảm";
        }
      }
    } catch {
      if (elements.statusDot && elements.statusText) {
        elements.statusDot.className = "status-dot offline";
        elements.statusText.textContent = "Không thể kết nối máy chủ";
      }
    }
  }

  // =========================================================================
  // Lightweight Markdown Parser
  // =========================================================================
  function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMarkdown(text) {
    if (!text) return "";

    const lines = text.split("\n");
    const result = [];
    let inList = false;
    let listType = "";
    let inTable = false;
    let tableRows = [];

    const closeList = () => {
      if (inList) {
        result.push(listType === "ol" ? "</ol>" : "</ul>");
        inList = false;
        listType = "";
      }
    };

    const flushTable = () => {
      if (!inTable || tableRows.length === 0) return;
      let tableHtml = '<div class="bot-table-wrap"><table class="bot-markdown-table">';

      const isHeaderSep = (row) => row.every((cell) => /^:?-+:?$/.test(cell.trim()));
      let headerRow = null;
      let bodyRows = [];

      if (tableRows.length >= 2 && isHeaderSep(tableRows[1])) {
        headerRow = tableRows[0];
        bodyRows = tableRows.slice(2);
      } else {
        bodyRows = tableRows;
      }

      if (headerRow) {
        tableHtml += "<thead><tr>";
        for (const th of headerRow) {
          tableHtml += `<th>${inlineFormat(th)}</th>`;
        }
        tableHtml += "</tr></thead>";
      }

      if (bodyRows.length > 0) {
        tableHtml += "<tbody>";
        for (const row of bodyRows) {
          tableHtml += "<tr>";
          for (const td of row) {
            tableHtml += `<td>${inlineFormat(td)}</td>`;
          }
          tableHtml += "</tr>";
        }
        tableHtml += "</tbody>";
      }

      tableHtml += "</table></div>";
      result.push(tableHtml);
      inTable = false;
      tableRows = [];
    };

    const inlineFormat = (str) => {
      if (!str) return "";
      let s = escapeHtml(str);
      s = s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/\*(.*?)\*/g, "<em>$1</em>");
      s = s.replace(/`([^`]+)`/g, '<code class="badge-legal">$1</code>');
      s = s.replace(/\b(Điều\s+\d+[\.:]?)/gi, '<span class="badge-legal">$1</span>');
      s = s.replace(/\b(Khoản\s+\d+[\.:]?)/gi, '<span class="badge-legal">$1</span>');
      s = s.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline;">$1</a>'
      );
      return s;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith("|") && line.endsWith("|")) {
        closeList();
        inTable = true;
        const cells = line.slice(1, -1).split("|").map((c) => c.trim());
        tableRows.push(cells);
        continue;
      } else if (inTable) {
        flushTable();
      }

      if (/^(\*{3,}|-{3,}|_{3,})$/.test(line)) {
        closeList();
        result.push('<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:14px 0;">');
        continue;
      }

      if (line.startsWith("### ")) {
        closeList();
        result.push(`<h3 style="font-size:1.05rem;font-weight:600;color:#fff;margin:12px 0 6px;">${inlineFormat(line.slice(4))}</h3>`);
        continue;
      }
      if (line.startsWith("## ") || line.startsWith("# ")) {
        closeList();
        result.push(`<h2 style="font-size:1.15rem;font-weight:600;color:#fff;margin:14px 0 8px;">${inlineFormat(line.replace(/^#+\s*/, ""))}</h2>`);
        continue;
      }

      const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (olMatch) {
        if (!inList || listType !== "ol") {
          closeList();
          result.push('<ol class="bot-ol">');
          inList = true;
          listType = "ol";
        }
        result.push(`<li>${inlineFormat(olMatch[2])}</li>`);
        continue;
      }

      const ulMatch = line.match(/^[-*]\s+(.*)$/);
      if (ulMatch) {
        if (!inList || listType !== "ul") {
          closeList();
          result.push('<ul class="bot-ul">');
          inList = true;
          listType = "ul";
        }
        result.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
        continue;
      }

      closeList();
      if (!line) continue;

      if (line.startsWith("&gt; ") || line.startsWith("> ")) {
        const quoteText = line.replace(/^(&gt;|>)\s+/, "");
        result.push(`<blockquote style="border-left:3px solid #38bdf8;padding-left:12px;color:#c4c7c5;margin:8px 0;">${inlineFormat(quoteText)}</blockquote>`);
        continue;
      }

      result.push(`<p>${inlineFormat(line)}</p>`);
    }

    closeList();
    if (inTable) flushTable();

    return result.join("");
  }

  // =========================================================================
  // MODAL 6: Custom UI Confirmation for Deleting History (No window.confirm)
  // =========================================================================
  function setupConfirmDeleteModalEvents() {
    if (elements.btnCancelDeleteHistory) {
      elements.btnCancelDeleteHistory.addEventListener("click", closeConfirmDeleteModal);
    }
    if (elements.btnConfirmDeleteHistory) {
      elements.btnConfirmDeleteHistory.addEventListener("click", handleConfirmDeleteHistory);
    }
    const modalDelete = elements.modalConfirmDelete || document.getElementById("modal-history-action");
    if (modalDelete) {
      modalDelete.addEventListener("click", (e) => {
        if (e.target === modalDelete) closeConfirmDeleteModal();
      });
    }
  }

  function openConfirmDeleteModal(sessionId, sessionTitle) {
    state.deletingSessionId = sessionId;
    state.deletingSessionName = sessionTitle || "Cuộc trò chuyện";
    if (elements.confirmDeleteSessionName) {
      elements.confirmDeleteSessionName.textContent = state.deletingSessionName;
    }
    const modalDelete = elements.modalConfirmDelete || document.getElementById("modal-history-action");
    if (modalDelete) {
      modalDelete.style.display = "flex";
      modalDelete.setAttribute("aria-hidden", "false");
    }
  }

  function closeConfirmDeleteModal() {
    state.deletingSessionId = null;
    state.deletingSessionName = "";
    const modalDelete = elements.modalConfirmDelete || document.getElementById("modal-history-action");
    if (modalDelete) {
      modalDelete.style.display = "none";
      modalDelete.setAttribute("aria-hidden", "true");
    }
  }

  async function handleConfirmDeleteHistory() {
    if (!state.deletingSessionId) return;
    const targetId = state.deletingSessionId;
    closeConfirmDeleteModal();

    try {
      await window.ApiService.deleteChatHistory(targetId);
      showToast("Đã xóa vĩnh viễn cuộc trò chuyện.", "info", 2000);

      if (state.sessionId === targetId) {
        startNewChatSession(false);
      }
      await loadSessionsList();
    } catch (err) {
      showToast(`Lỗi khi xóa cuộc trò chuyện: ${err.message}`, "error");
    }
  }

  // =========================================================================
  // MODAL 7: View Student Document Extracted Content (GET /detail)
  // =========================================================================
  function setupDocContentModalEvents() {
    if (elements.btnCloseDocContent) elements.btnCloseDocContent.addEventListener("click", closeDocContentModal);
    if (elements.btnCloseDocContentFooter) elements.btnCloseDocContentFooter.addEventListener("click", closeDocContentModal);
    if (elements.modalDocContent) {
      elements.modalDocContent.addEventListener("click", (e) => {
        if (e.target === elements.modalDocContent) closeDocContentModal();
      });
    }
  }

  async function openDocContentModal(docId, docTitle, filename) {
    if (!elements.modalDocContent) return;
    elements.modalDocContent.style.display = "flex";
    elements.modalDocContent.setAttribute("aria-hidden", "false");

    if (elements.docContentModalTitle) {
      elements.docContentModalTitle.textContent = docTitle || "Chi tiết tài liệu sinh viên";
    }
    if (elements.docContentModalMeta) {
      elements.docContentModalMeta.textContent = `Tệp: ${filename || docId} • Đang tải nội dung văn bản...`;
    }
    if (elements.docContentTextBox) {
      elements.docContentTextBox.textContent = "⏳ Đang kết xuất toàn bộ nội dung văn bản đã trích xuất...";
    }

    try {
      const detail = await window.ApiService.getDocumentDetail(docId);
      if (elements.docContentModalTitle) {
        elements.docContentModalTitle.textContent = detail.title || docTitle || "Chi tiết tài liệu";
      }
      if (elements.docContentModalMeta) {
        elements.docContentModalMeta.textContent = `Tệp: ${detail.filename || filename || "Tài liệu"} • ${detail.total_chunks || 0} đoạn trích • ${detail.char_count || 0} ký tự`;
      }
      if (elements.docContentTextBox) {
        elements.docContentTextBox.textContent = detail.content || "(Tài liệu trống hoặc chưa có nội dung văn bản)";
      }
    } catch (err) {
      if (elements.docContentTextBox) {
        elements.docContentTextBox.textContent = `Lỗi trích xuất: ${err.message}`;
      }
      showToast(`Không thể tải nội dung tài liệu: ${err.message}`, "error");
    }
  }

  function closeDocContentModal() {
    if (elements.modalDocContent) {
      elements.modalDocContent.style.display = "none";
      elements.modalDocContent.setAttribute("aria-hidden", "true");
    }
  }

  // =========================================================================
  // MODAL 8: Student Settings & Profile (MSSV, TTS Speed, Clear All History)
  // =========================================================================
  function initStudentSettings() {
    state.studentId = localStorage.getItem("ntu_student_id") || "";
    state.ttsSpeed = parseFloat(localStorage.getItem("ntu_tts_speed") || "1.0");

    if (elements.inputStudentMssv) {
      elements.inputStudentMssv.value = state.studentId;
    }
    if (elements.rangeTtsSpeed) {
      elements.rangeTtsSpeed.value = state.ttsSpeed;
    }
    if (elements.ttsSpeedLabel) {
      elements.ttsSpeedLabel.textContent = `${state.ttsSpeed.toFixed(1)}x`;
    }
    if (window.VoiceManager && typeof window.VoiceManager.setSpeechRate === "function") {
      window.VoiceManager.setSpeechRate(state.ttsSpeed);
    }
  }

  function setupStudentSettingsModalEvents() {
    if (elements.btnCloseStudentSettings) elements.btnCloseStudentSettings.addEventListener("click", closeStudentSettingsModal);
    if (elements.btnCloseSettingsFooter) elements.btnCloseSettingsFooter.addEventListener("click", closeStudentSettingsModal);
    if (elements.modalStudentSettings) {
      elements.modalStudentSettings.addEventListener("click", (e) => {
        if (e.target === elements.modalStudentSettings) closeStudentSettingsModal();
      });
    }

    // Save MSSV
    if (elements.btnSaveMssv && elements.inputStudentMssv) {
      elements.btnSaveMssv.addEventListener("click", () => {
        const val = elements.inputStudentMssv.value.trim();
        state.studentId = val;
        localStorage.setItem("ntu_student_id", val);
        showToast(val ? `Đã lưu MSSV: ${val}` : "Đã xóa MSSV (chế độ ẩn danh).", "success", 2500);
        // Reload conversations and documents isolated for this student
        loadSessionsList();
        loadDocuments();
      });

      elements.inputStudentMssv.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          elements.btnSaveMssv.click();
        }
      });
    }

    // Adjust TTS Speed Slider
    if (elements.rangeTtsSpeed) {
      elements.rangeTtsSpeed.addEventListener("input", (e) => {
        const speed = parseFloat(e.target.value) || 1.0;
        state.ttsSpeed = speed;
        localStorage.setItem("ntu_tts_speed", speed.toString());
        if (elements.ttsSpeedLabel) {
          elements.ttsSpeedLabel.textContent = `${speed.toFixed(1)}x`;
        }
        if (window.VoiceManager && typeof window.VoiceManager.setSpeechRate === "function") {
          window.VoiceManager.setSpeechRate(speed);
        }
      });
    }

    // Clear All Personal History
    if (elements.btnClearAllHistory) {
      elements.btnClearAllHistory.addEventListener("click", async () => {
        try {
          elements.btnClearAllHistory.disabled = true;
          elements.btnClearAllHistory.textContent = "⏳ Đang xóa toàn bộ...";
          await window.ApiService.clearAllSessions(state.studentId);
          showToast("Đã xóa toàn bộ lịch sử cá nhân.", "success", 3000);
          startNewChatSession(false);
          await loadSessionsList();
          closeStudentSettingsModal();
        } catch (err) {
          showToast(`Lỗi khi xóa lịch sử: ${err.message}`, "error");
        } finally {
          if (elements.btnClearAllHistory) {
            elements.btnClearAllHistory.disabled = false;
            elements.btnClearAllHistory.textContent = "Xóa toàn bộ lịch sử trò chuyện";
          }
        }
      });
    }
  }

  function openStudentSettingsModal() {
    if (!elements.modalStudentSettings) return;
    if (elements.inputStudentMssv) {
      elements.inputStudentMssv.value = state.studentId || "";
    }
    if (elements.rangeTtsSpeed) {
      elements.rangeTtsSpeed.value = state.ttsSpeed || 1.0;
    }
    if (elements.ttsSpeedLabel) {
      elements.ttsSpeedLabel.textContent = `${(state.ttsSpeed || 1.0).toFixed(1)}x`;
    }
    elements.modalStudentSettings.style.display = "flex";
    elements.modalStudentSettings.setAttribute("aria-hidden", "false");
  }

  function closeStudentSettingsModal() {
    if (elements.modalStudentSettings) {
      elements.modalStudentSettings.style.display = "none";
      elements.modalStudentSettings.setAttribute("aria-hidden", "true");
    }
  }

  // =========================================================================
  // MODAL 9: Rename Student Document (PATCH /documents/{doc_id})
  // =========================================================================
  function setupDocRenameModalEvents() {
    if (elements.btnCloseRenameDoc) elements.btnCloseRenameDoc.addEventListener("click", closeDocRenameModal);
    if (elements.btnCancelRenameDoc) elements.btnCancelRenameDoc.addEventListener("click", closeDocRenameModal);
    if (elements.modalRenameDoc) {
      elements.modalRenameDoc.addEventListener("click", (e) => {
        if (e.target === elements.modalRenameDoc) closeDocRenameModal();
      });
    }
    if (elements.btnConfirmRenameDoc) elements.btnConfirmRenameDoc.addEventListener("click", handleConfirmRenameDoc);
    if (elements.inputDocRename) {
      elements.inputDocRename.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleConfirmRenameDoc();
        }
      });
    }
  }

  function openDocRenameModal(docId, currentTitle) {
    state.renamingDocId = docId;
    if (elements.inputDocRename) {
      elements.inputDocRename.value = currentTitle || "";
    }
    if (elements.modalRenameDoc) {
      elements.modalRenameDoc.style.display = "flex";
      elements.modalRenameDoc.setAttribute("aria-hidden", "false");
      setTimeout(() => elements.inputDocRename?.focus(), 50);
    }
  }

  function closeDocRenameModal() {
    state.renamingDocId = null;
    if (elements.modalRenameDoc) {
      elements.modalRenameDoc.style.display = "none";
      elements.modalRenameDoc.setAttribute("aria-hidden", "true");
    }
  }

  async function handleConfirmRenameDoc() {
    if (!state.renamingDocId) return;
    const newTitle = elements.inputDocRename ? elements.inputDocRename.value.trim() : "";
    if (!newTitle) {
      showToast("Vui lòng nhập tiêu đề cho tài liệu.", "info");
      return;
    }

    try {
      await window.ApiService.updateDocumentTitle(state.renamingDocId, newTitle);
      showToast("Đã đổi tên tài liệu thành công.", "success", 2000);
      closeDocRenameModal();
      await loadDocuments();
    } catch (err) {
      showToast(`Lỗi khi đổi tên tài liệu: ${err.message}`, "error");
    }
  }
});
