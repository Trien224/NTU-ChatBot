/**
 * NTU EduBot v2.0 - Main Application Controller
 * Orchestrates DOM interactions, SSE streaming, Vietnamese Hybrid Search citation viewer,
 * Academic GPA & Scholarship Calculator modal, Category Pills, and dynamic follow-up chips.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Application State
  const state = {
    sessionId: getOrCreateSessionId(),
    topK: 5,
    autoTTS: false,
    isProcessing: false,
    selectedFile: null,
    selectedCameraFile: null,
    cameraFacingMode: "environment",
    mediaStream: null,
    capturedBlob: null,
    currentQuestion: "",
    activeCitation: null,
  };

  // DOM Elements
  const elements = {
    // Sidebar
    sidebar: document.getElementById("sidebar"),
    btnToggleSidebar: document.getElementById("btn-toggle-sidebar"),
    statusDot: document.getElementById("status-dot"),
    statusText: document.getElementById("status-text"),
    docTitleInput: document.getElementById("doc-title-input"),
    fileInput: document.getElementById("file-input"),
    fileDropzone: document.getElementById("file-dropzone"),
    dropzoneText: document.getElementById("dropzone-text"),
    btnUpload: document.getElementById("btn-upload"),
    documentsList: document.getElementById("documents-list"),
    btnClearChat: document.getElementById("btn-clear-chat"),
    btnToggleUpload: document.getElementById("btn-toggle-upload"),
    uploadAccordionBody: document.getElementById("upload-accordion-body"),
    btnSidebarGpaCalc: document.getElementById("btn-sidebar-gpa-calc"),
    docCountBadge: document.getElementById("doc-count-badge"),

    // Chat Area
    sessionDisplay: document.getElementById("session-display"),
    selectTopK: document.getElementById("select-topk"),
    toggleAutoTTS: document.getElementById("toggle-auto-tts"),
    btnOpenGpaCalc: document.getElementById("btn-open-gpa-calc"),
    chatMessages: document.getElementById("chat-messages"),
    welcomeScreen: document.getElementById("welcome-screen"),
    promptCards: document.querySelectorAll(".prompt-card"),

    // Category Pills & Input Bar
    categoryPills: document.getElementById("category-pills"),
    chatForm: document.getElementById("chat-form"),
    chatInput: document.getElementById("chat-input"),
    btnMic: document.getElementById("btn-mic"),
    btnSend: document.getElementById("btn-send"),
    toastContainer: document.getElementById("toast-container"),
    btnToggleTheme: document.getElementById("btn-toggle-theme"),
    themeIcon: document.getElementById("theme-icon"),

    // Citation Preview Modal Elements
    modalCitation: document.getElementById("modal-citation"),
    citationDocTitle: document.getElementById("citation-modal-doc-title"),
    citationLocation: document.getElementById("citation-modal-location"),
    citationScore: document.getElementById("citation-modal-score"),
    citationFilename: document.getElementById("citation-modal-filename"),
    citationContent: document.getElementById("citation-modal-content"),
    btnCloseCitation: document.getElementById("btn-close-citation"),
    btnDismissCitation: document.getElementById("btn-dismiss-citation"),
    btnCopyCitation: document.getElementById("btn-copy-citation"),

    // GPA & Scholarship Calculator Modal Elements
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

    // Smartphone & Live Camera Elements
    btnSmartphoneCamera: document.getElementById("btn-smartphone-camera"),
    smartphoneCameraInput: document.getElementById("smartphone-camera-input"),
    cameraPreviewBox: document.getElementById("camera-preview-box"),
    cameraPreviewImg: document.getElementById("camera-preview-img"),
    cameraPreviewName: document.getElementById("camera-preview-name"),
    btnCancelCamPreview: document.getElementById("btn-cancel-cam-preview"),

    btnTopbarCamera: document.getElementById("btn-topbar-camera"),
    btnOpenLiveScanner: document.getElementById("btn-open-live-scanner"),
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
  };

  // Initialize Application
  initApp();

  function initApp() {
    // Initialize Academic Theme (Dark Slate default)
    initTheme();

    // Set Session ID display
    if (elements.sessionDisplay) {
      elements.sessionDisplay.textContent = `Phiên: ${state.sessionId.slice(0, 12)}...`;
    }

    // Attach Event Listeners
    setupEventListeners();

    // Check Backend Health
    refreshHealthStatus();

    // Load Ingested Documents
    loadDocuments();

    // Load Chat History
    loadChatHistory();

    // Initialize Calculator Values
    calculateGpaAndScholarship();
    convertScore10();
  }

  // =========================================================================
  // Theme Manager: Dark Slate (Default) / Light Mode Toggle
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
    if (elements.btnToggleTheme) {
      elements.btnToggleTheme.setAttribute(
        "title",
        theme === "dark" ? "Chuyển sang Giao diện Sáng" : "Chuyển sang Giao diện Tối"
      );
    }
  }

  // =========================================================================
  // State & Storage Helpers
  // =========================================================================
  function getOrCreateSessionId() {
    let sid = localStorage.getItem("ntu_edubot_session_id");
    if (!sid) {
      sid = `ntu_session_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
      localStorage.setItem("ntu_edubot_session_id", sid);
    }
    return sid;
  }

  function resetSessionId() {
    const sid = `ntu_session_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
    localStorage.setItem("ntu_edubot_session_id", sid);
    state.sessionId = sid;
    if (elements.sessionDisplay) {
      elements.sessionDisplay.textContent = `Phiên: ${sid.slice(0, 12)}...`;
    }
    return sid;
  }

  // =========================================================================
  // Toast Notifications
  // =========================================================================
  function showToast(message, type = "info", duration = 4000) {
    if (!elements.toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // =========================================================================
  // Event Listeners Setup
  // =========================================================================
  function setupEventListeners() {
    // Mobile Sidebar Toggle
    if (elements.btnToggleSidebar && elements.sidebar) {
      elements.btnToggleSidebar.addEventListener("click", () => {
        elements.sidebar.classList.toggle("open");
      });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", (e) => {
      if (
        elements.sidebar &&
        elements.sidebar.classList.contains("open") &&
        !elements.sidebar.contains(e.target) &&
        !elements.btnToggleSidebar.contains(e.target)
      ) {
        elements.sidebar.classList.remove("open");
      }
    });

    // TopK Selector
    if (elements.selectTopK) {
      elements.selectTopK.addEventListener("change", (e) => {
        state.topK = Number(e.target.value);
      });
    }

    // Auto-TTS Toggle
    if (elements.toggleAutoTTS) {
      elements.toggleAutoTTS.addEventListener("change", (e) => {
        state.autoTTS = e.target.checked;
        if (!state.autoTTS && window.VoiceManager) {
          window.VoiceManager.stopSpeaking();
        }
      });
    }

    // Auto-resizing Chat Textarea
    if (elements.chatInput) {
      elements.chatInput.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = `${Math.min(this.scrollHeight, 140)}px`;
      });

      // Submit on Enter (Shift+Enter for newline)
      elements.chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      });
    }

    // Form Submit
    if (elements.chatForm) {
      elements.chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        handleSendMessage();
      });
    }

    // Prompt Suggestions Cards
    elements.promptCards.forEach((card) => {
      card.addEventListener("click", () => {
        const text = card.getAttribute("data-prompt") || card.querySelector(".prompt-card-text")?.textContent;
        if (text) {
          elements.chatInput.value = text.trim();
          handleSendMessage();
        }
      });
    });

    // Clear Chat / Reset Session
    if (elements.btnClearChat) {
      elements.btnClearChat.addEventListener("click", async () => {
        if (!confirm("Bạn có chắc muốn làm mới cuộc trò chuyện và bắt đầu phiên mới?")) return;
        try {
          await window.ApiService.deleteChatHistory(state.sessionId);
        } catch {
          // Ignore if session had no history
        }
        resetSessionId();
        if (elements.chatMessages) {
          elements.chatMessages.innerHTML = "";
          if (elements.welcomeScreen) {
            elements.chatMessages.appendChild(elements.welcomeScreen);
          }
        }
        showToast("Đã khởi tạo phiên trò chuyện mới.", "info");
      });
    }

    // Admin Upload Accordion Toggle
    if (elements.btnToggleUpload && elements.uploadAccordionBody) {
      elements.btnToggleUpload.addEventListener("click", () => {
        const isCollapsed = elements.uploadAccordionBody.classList.contains("collapsed");
        if (isCollapsed) {
          elements.uploadAccordionBody.classList.remove("collapsed");
          elements.btnToggleUpload.classList.add("expanded");
          elements.btnToggleUpload.setAttribute("aria-expanded", "true");
        } else {
          elements.uploadAccordionBody.classList.add("collapsed");
          elements.btnToggleUpload.classList.remove("expanded");
          elements.btnToggleUpload.setAttribute("aria-expanded", "false");
        }
      });
    }

    // Dropzone & File Input
    if (elements.fileDropzone && elements.fileInput) {
      elements.fileDropzone.addEventListener("click", () => {
        elements.fileInput.click();
      });

      elements.fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileSelected(e.target.files[0]);
        }
      });

      elements.fileDropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        elements.fileDropzone.classList.add("dragover");
      });

      elements.fileDropzone.addEventListener("dragleave", () => {
        elements.fileDropzone.classList.remove("dragover");
      });

      elements.fileDropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        elements.fileDropzone.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFileSelected(e.dataTransfer.files[0]);
        }
      });
    }

    // Upload Button
    if (elements.btnUpload) {
      elements.btnUpload.addEventListener("click", handleDocumentUpload);
    }

    // Mic / Voice Input Button
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
              showToast("Đang lắng nghe... Nói câu hỏi của bạn.", "info", 3000);
            } else {
              elements.btnMic.classList.remove("recording");
            }
          }
        );
      });
    }

    // Category Pills Filter Handlers
    if (elements.categoryPills) {
      elements.categoryPills.querySelectorAll(".pill-item").forEach((pill) => {
        pill.addEventListener("click", () => {
          elements.categoryPills.querySelectorAll(".pill-item").forEach((p) => p.classList.remove("active"));
          pill.classList.add("active");

          const topic = pill.getAttribute("data-topic");
          handleCategoryPillSelect(topic);
        });
      });
    }

    // Citation Modal Event Handlers
    setupCitationModalEvents();

    // GPA Calculator Modal Event Handlers
    setupGpaCalculatorEvents();

    // Live Camera & Smartphone Scanner Event Handlers
    setupCameraScannerEvents();

    // Theme Toggle Listener
    if (elements.btnToggleTheme) {
      elements.btnToggleTheme.addEventListener("click", () => {
        const active = document.documentElement.getAttribute("data-theme") || "dark";
        const nextTheme = active === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
        showToast(nextTheme === "dark" ? "Đã chuyển sang Giao diện Tối." : "Đã chuyển sang Giao diện Sáng.", "info", 2000);
      });
    }

    // Keyboard Shortcut Alt+C to Toggle GPA & Scholarship Calculator Modal
    document.addEventListener("keydown", (e) => {
      if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        if (elements.modalGpaCalc && elements.modalGpaCalc.style.display === "flex") {
          closeGpaCalcModal();
        } else {
          openGpaCalcModal();
        }
      }
    });
  }

  // =========================================================================
  // Citation Modal Logic
  // =========================================================================
  function setupCitationModalEvents() {
    if (elements.btnCloseCitation) {
      elements.btnCloseCitation.addEventListener("click", closeCitationModal);
    }
    if (elements.btnDismissCitation) {
      elements.btnDismissCitation.addEventListener("click", closeCitationModal);
    }
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
      const scorePct = (scoreNum * 100).toFixed(1);
      elements.citationScore.textContent = `Độ tin cậy: ${scorePct}%`;
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
        safe = safe.replace(regex, '<span class="highlight-keyword">$1</span>');
      } catch {
        // Ignore regex compile errors on special chars
      }
    });

    return safe;
  }

  // =========================================================================
  // GPA & Scholarship Calculator Logic
  // =========================================================================
  function setupGpaCalculatorEvents() {
    // Open modal buttons (topbar & sidebar)
    if (elements.btnOpenGpaCalc) {
      elements.btnOpenGpaCalc.addEventListener("click", openGpaCalcModal);
    }
    if (elements.btnSidebarGpaCalc) {
      elements.btnSidebarGpaCalc.addEventListener("click", openGpaCalcModal);
    }

    // Close buttons
    if (elements.btnCloseGpaCalc) {
      elements.btnCloseGpaCalc.addEventListener("click", closeGpaCalcModal);
    }
    if (elements.btnDismissGpaCalc) {
      elements.btnDismissGpaCalc.addEventListener("click", closeGpaCalcModal);
    }
    if (elements.modalGpaCalc) {
      elements.modalGpaCalc.addEventListener("click", (e) => {
        if (e.target === elements.modalGpaCalc) closeGpaCalcModal();
      });
    }

    // Live calculation listeners
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

    // 10-to-4 Converter
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

    // 1. Evaluate Scholarship KKHT (Điều 12, Điều 13 Quy chế NTU)
    let sBadgeText = "Chưa đạt";
    let sBadgeClass = "status-none";
    let sDetailText = "";

    if (credits < 15) {
      sBadgeText = "Không đủ điều kiện";
      sBadgeClass = "status-none";
      sDetailText = `Khối lượng tín chỉ tích lũy trong kỳ (${credits} TC) chưa đạt mức tối thiểu 15 tín chỉ theo quy định tại Khoản 2 Điều 12.`;
    } else if (hasFail) {
      sBadgeText = "Không đủ điều kiện";
      sBadgeClass = "status-none";
      sDetailText = `Không xét cấp học bổng do có môn điểm dưới C (D+, D, F) hoặc phải thi lại theo quy định tại Điểm c Khoản 2 Điều 12.`;
    } else if (gpa >= 3.60 && drl >= 90) {
      sBadgeText = "Học bổng Xuất sắc";
      sBadgeClass = "status-excellent";
      sDetailText = `Chúc mừng bạn! Bạn đủ điều kiện xét cấp Học bổng loại Xuất sắc (Mức thưởng bằng 120% học phí kỳ theo Điều 13 NTU).`;
    } else if (gpa >= 3.20 && drl >= 80) {
      sBadgeText = "Học bổng Giỏi";
      sBadgeClass = "status-good";
      sDetailText = `Chúc mừng bạn! Bạn đủ điều kiện xét cấp Học bổng loại Giỏi (Mức thưởng bằng 100% học phí kỳ theo Điều 13 NTU).`;
    } else if (gpa >= 2.50 && drl >= 80) {
      sBadgeText = "Học bổng Khá";
      sBadgeClass = "status-fair";
      sDetailText = `Chúc mừng bạn! Bạn đủ điều kiện xét cấp Học bổng loại Khá (Mức thưởng bằng 80% học phí kỳ theo Điều 13 NTU).`;
    } else {
      sBadgeText = "Chưa đạt Học bổng";
      sBadgeClass = "status-none";
      sDetailText = `Chưa đủ điều kiện: Cần ĐTBCHK ≥ 2.50 và Điểm rèn luyện ≥ 80 điểm để xét cấp học bổng KKHT theo Điều 12.`;
    }

    if (elements.scholarshipBadge) {
      elements.scholarshipBadge.textContent = sBadgeText;
      elements.scholarshipBadge.className = `badge-status ${sBadgeClass}`;
    }
    if (elements.scholarshipDetail) {
      elements.scholarshipDetail.textContent = sDetailText;
    }

    // 2. Evaluate Academic Warning (Điều 7 Quy chế NTU)
    let wBadgeText = "An toàn";
    let wBadgeClass = "status-safe";
    let wDetailText = "";
    let isWarningDanger = false;

    if (gpa < 1.0) {
      wBadgeText = "⚠️ Cảnh báo học vụ";
      wBadgeClass = "status-danger";
      isWarningDanger = true;
      wDetailText = `Cảnh báo: Điểm TBHK đạt ${gpa.toFixed(2)} (< 1.00) thuộc diện CẢNH BÁO HỌC VỤ theo Điều 7 NTU. Kỳ tới bạn chỉ được đăng ký tối đa 14 tín chỉ!`;
    } else if (gpa < (1.0 + year * 0.15)) {
      wBadgeText = "Cần nỗ lực";
      wBadgeClass = "status-fair";
      wDetailText = `Điểm TBHK đạt ${gpa.toFixed(2)} ở mức cận an toàn cho sinh viên Năm ${year}. Bạn nên đăng ký học cải thiện các môn điểm D để nâng cao ĐTBCTL.`;
    } else {
      wBadgeText = "Học lực An toàn";
      wBadgeClass = "status-safe";
      wDetailText = `Điểm TBHK đạt ${gpa.toFixed(2)} vững vàng trên ngưỡng cảnh báo. Tiếp tục giữ vững phong độ học tập tốt!`;
    }

    if (elements.warningBadge) {
      elements.warningBadge.textContent = wBadgeText;
      elements.warningBadge.className = `badge-status ${wBadgeClass}`;
    }
    if (elements.warningDetail) {
      elements.warningDetail.textContent = wDetailText;
    }
    if (elements.warningBox) {
      if (isWarningDanger) {
        elements.warningBox.classList.add("danger");
      } else {
        elements.warningBox.classList.remove("danger");
      }
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

    // Dynamic Row Highlight in Grade Reference Table
    const allGradeRows = document.querySelectorAll(".mini-grade-table tbody tr");
    allGradeRows.forEach((r) => r.classList.remove("highlight-grade-row"));
    const targetRow = document.getElementById(rowId);
    if (targetRow) {
      targetRow.classList.add("highlight-grade-row");
    }
  }

  // =========================================================================
  // Category Pills Quick Selection
  // =========================================================================
  function handleCategoryPillSelect(topic) {
    const topicPrompts = {
      scholarship: "Điều kiện xét học bổng khuyến khích học tập và điểm rèn luyện tại Đại học Nguyễn Trãi là gì?",
      registration: "Quy định về đăng ký khối lượng tín chỉ tối thiểu tối đa và rút bớt học phần?",
      warning: "Sinh viên bị cảnh báo học vụ khi điểm dưới bao nhiêu và mấy lần thì bị buộc thôi học?",
      graduation: "Điều kiện để sinh viên được nhận đồ án tốt nghiệp và chuẩn đầu ra ngoại ngữ tin học?",
      all: "",
    };

    const targetPrompt = topicPrompts[topic];
    if (targetPrompt && elements.chatInput) {
      elements.chatInput.value = targetPrompt;
      elements.chatInput.focus();
      handleSendMessage();
    }
  }

  // =========================================================================
  // Document Upload & Management
  // =========================================================================
  async function refreshHealthStatus() {
    try {
      const health = await window.ApiService.checkHealth();
      if (elements.statusDot && elements.statusText) {
        if (health.status === "healthy") {
          elements.statusDot.className = "status-dot online";
          elements.statusText.textContent = "Hệ thống RAG sẵn sàng";
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

  function handleFileSelected(file) {
    state.selectedFile = file;
    if (elements.dropzoneText) {
      elements.dropzoneText.textContent = `Đã chọn: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    }
    if (elements.btnUpload) {
      elements.btnUpload.disabled = false;
    }
  }

  async function handleDocumentUpload() {
    if (!state.selectedFile && !state.selectedCameraFile) {
      showToast("Vui lòng chọn tệp tài liệu hoặc chụp ảnh từ Camera.", "info");
      return;
    }

    const title = elements.docTitleInput ? elements.docTitleInput.value.trim() : "";
    elements.btnUpload.disabled = true;
    elements.btnUpload.innerHTML = `<span>Đang xử lý & tạo Vector...</span>`;

    try {
      showToast("Đang bóc tách văn bản, OCR và tạo Vector...", "info", 6000);
      let res;
      if (state.selectedCameraFile) {
        res = await window.ApiService.scanCameraDocument(state.selectedCameraFile, title);
      } else {
        res = await window.ApiService.uploadDocument(state.selectedFile, title);
      }
      showToast(`Nạp thành công! Đã lập chỉ mục ${res.total_chunks} đoạn trích.`, "success");

      // Reset upload inputs
      state.selectedFile = null;
      state.selectedCameraFile = null;
      if (elements.fileInput) elements.fileInput.value = "";
      if (elements.smartphoneCameraInput) elements.smartphoneCameraInput.value = "";
      if (elements.docTitleInput) elements.docTitleInput.value = "";
      if (elements.dropzoneText) {
        elements.dropzoneText.textContent = "Kéo thả PDF, Scan ảnh hoặc bấm để chọn";
      }
      if (elements.cameraPreviewBox) {
        elements.cameraPreviewBox.style.display = "none";
      }

      // Refresh documents catalog
      await loadDocuments();
    } catch (err) {
      showToast(`Lỗi nạp tài liệu: ${err.message}`, "error", 6000);
    } finally {
      if (elements.btnUpload) {
        elements.btnUpload.disabled = false;
        elements.btnUpload.innerHTML = `<span>Nạp vào Kho Tri thức</span>`;
      }
    }
  }

  async function loadDocuments() {
    if (!elements.documentsList) return;

    try {
      const docs = await window.ApiService.getDocuments();
      elements.documentsList.innerHTML = "";

      if (!docs || docs.length === 0) {
        elements.documentsList.innerHTML = `<div style="font-size:0.75rem; color:#64748b; padding:8px 0;">Chưa có tài liệu quy chế nào trong kho tri thức.</div>`;
        return;
      }

      if (elements.docCountBadge) {
        elements.docCountBadge.textContent = `${docs.length} tài liệu`;
      }

      docs.forEach((doc) => {
        const item = document.createElement("div");
        item.className = "doc-item";

        const titleText = doc.title || doc.filename || "Quy chế";
        const chunksCount = doc.total_chunks || 0;

        item.innerHTML = `
          <div class="doc-info" title="${escapeHtml(titleText)}">
            <span class="doc-name">${escapeHtml(titleText)}</span>
            <span class="doc-meta">
              <span>${chunksCount} chunks</span>
              <span>•</span>
              <span>${doc.filename ? escapeHtml(doc.filename.slice(0, 18)) : "PDF"}</span>
            </span>
          </div>
          <button class="btn-delete-doc" title="Xóa tài liệu này" data-docid="${doc.doc_id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
            </svg>
          </button>
        `;

        const deleteBtn = item.querySelector(".btn-delete-doc");
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const docId = deleteBtn.getAttribute("data-docid");
          if (!confirm(`Bạn có chắc muốn xóa tài liệu này khỏi kho tri thức?`)) return;

          try {
            await window.ApiService.deleteDocument(docId);
            showToast("Đã xóa tài liệu khỏi cơ sở tri thức.", "success");
            await loadDocuments();
          } catch (delErr) {
            showToast(`Lỗi khi xóa: ${delErr.message}`, "error");
          }
        });

        elements.documentsList.appendChild(item);
      });
    } catch (e) {
      console.warn("Could not load documents list:", e);
    }
  }

  // =========================================================================
  // Smartphone & Live Camera Document Scanner Logic
  // =========================================================================
  function setupCameraScannerEvents() {
    // 1. Native Smartphone Camera Integration
    if (elements.btnSmartphoneCamera && elements.smartphoneCameraInput) {
      elements.btnSmartphoneCamera.addEventListener("click", () => {
        elements.smartphoneCameraInput.click();
      });
    }

    if (elements.smartphoneCameraInput) {
      elements.smartphoneCameraInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        state.selectedCameraFile = file;
        state.selectedFile = file;

        // Display thumbnail preview
        if (elements.cameraPreviewImg) {
          elements.cameraPreviewImg.src = URL.createObjectURL(file);
        }
        if (elements.cameraPreviewName) {
          elements.cameraPreviewName.textContent = file.name || "anh_camera_smartphone.jpg";
        }
        if (elements.cameraPreviewBox) {
          elements.cameraPreviewBox.style.display = "flex";
        }

        // Auto-generate suggested document title
        const dateStr = new Date().toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        if (elements.docTitleInput && !elements.docTitleInput.value) {
          elements.docTitleInput.value = `Tài liệu Scan Camera - ${dateStr}`;
        }

        if (elements.dropzoneText) {
          elements.dropzoneText.textContent = `Ảnh Camera: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        }
        if (elements.btnUpload) {
          elements.btnUpload.disabled = false;
        }

        showToast("Đã chụp ảnh từ Camera điện thoại. Nhấn 'Nạp vào Kho Tri thức' để OCR.", "success");
      });
    }

    if (elements.btnCancelCamPreview) {
      elements.btnCancelCamPreview.addEventListener("click", () => {
        state.selectedCameraFile = null;
        state.selectedFile = null;
        if (elements.smartphoneCameraInput) elements.smartphoneCameraInput.value = "";
        if (elements.cameraPreviewBox) elements.cameraPreviewBox.style.display = "none";
        if (elements.dropzoneText) {
          elements.dropzoneText.textContent = "Kéo thả PDF, Scan ảnh hoặc bấm để chọn";
        }
      });
    }

    // 2. Live Camera / Webcam Scanner Modal
    if (elements.btnOpenLiveScanner) {
      elements.btnOpenLiveScanner.addEventListener("click", openCameraScannerModal);
    }
    if (elements.btnTopbarCamera) {
      elements.btnTopbarCamera.addEventListener("click", openCameraScannerModal);
    }
    if (elements.btnCloseScanner) {
      elements.btnCloseScanner.addEventListener("click", closeCameraScannerModal);
    }
    if (elements.modalCameraScanner) {
      elements.modalCameraScanner.addEventListener("click", (e) => {
        if (e.target === elements.modalCameraScanner) {
          closeCameraScannerModal();
        }
      });
    }

    // Camera Switch Front/Back
    if (elements.btnSwitchCamera) {
      elements.btnSwitchCamera.addEventListener("click", async () => {
        state.cameraFacingMode = state.cameraFacingMode === "environment" ? "user" : "environment";
        await startCameraStream();
        showToast(
          state.cameraFacingMode === "environment" ? "Đã chuyển Camera sau." : "Đã chuyển Camera trước.",
          "info",
          2000
        );
      });
    }

    // Capture Frame & Preview
    if (elements.btnCaptureScan) {
      elements.btnCaptureScan.addEventListener("click", handleCaptureFrame);
    }

    // Retake Scan
    if (elements.btnRetakeScan) {
      elements.btnRetakeScan.addEventListener("click", handleRetakeScan);
    }

    // Confirm & Upload Scan to MongoDB
    if (elements.btnConfirmUploadScan) {
      elements.btnConfirmUploadScan.addEventListener("click", handleConfirmUploadScan);
    }
  }

  async function openCameraScannerModal() {
    if (!elements.modalCameraScanner) return;
    elements.modalCameraScanner.style.display = "flex";
    elements.modalCameraScanner.setAttribute("aria-hidden", "false");

    // Reset views
    if (elements.scannerViewContainer) elements.scannerViewContainer.style.display = "flex";
    if (elements.scannerSnapshotView) elements.scannerSnapshotView.style.display = "none";
    if (elements.btnCaptureScan) elements.btnCaptureScan.style.display = "inline-flex";
    if (elements.btnConfirmUploadScan) elements.btnConfirmUploadScan.style.display = "none";

    // Set suggested title
    const dateStr = new Date().toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (elements.scannerDocTitle) {
      elements.scannerDocTitle.value = `Tài liệu Scan Live Camera - ${dateStr}`;
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
      showToast("Trình duyệt không hỗ trợ WebRTC Camera trực tiếp. Vui lòng dùng nút 'Camera Điện thoại'.", "error", 6000);
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
        // Fallback without exact constraints
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      state.mediaStream = stream;
      if (elements.cameraStream) {
        elements.cameraStream.srcObject = stream;
        elements.cameraStream.play().catch((err) => console.warn("Video play error:", err));
      }
    } catch (err) {
      console.error("Camera access error:", err);
      showToast(
        "Không thể mở Camera (Có thể do chưa cấp quyền hoặc đang kết nối qua HTTP). Hãy dùng nút 'Camera Điện thoại' để chụp ảnh trực tiếp!",
        "error",
        6000
      );
    }
  }

  function stopCameraStream() {
    if (state.mediaStream) {
      try {
        state.mediaStream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (err) {
        console.warn("Error stopping camera tracks:", err);
      }
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
        if (!blob) {
          showToast("Không thể xuất ảnh từ camera canvas.", "error");
          return;
        }

        state.capturedBlob = blob;

        // Show captured snapshot preview
        if (elements.scannerSnapshotImg) {
          elements.scannerSnapshotImg.src = URL.createObjectURL(blob);
        }
        if (elements.scannerViewContainer) {
          elements.scannerViewContainer.style.display = "none";
        }
        if (elements.scannerSnapshotView) {
          elements.scannerSnapshotView.style.display = "flex";
        }

        // Toggle action buttons
        if (elements.btnCaptureScan) elements.btnCaptureScan.style.display = "none";
        if (elements.btnConfirmUploadScan) elements.btnConfirmUploadScan.style.display = "inline-flex";

        // Stop camera hardware stream right after snapshot to save battery/privacy!
        stopCameraStream();

        showToast("Đã chụp khung hình văn bản! Kiểm tra ảnh và nhấn 'Nạp vào Kho Tri thức'.", "success");
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
    if (!state.capturedBlob) {
      showToast("Chưa có ảnh chụp tài liệu để nạp.", "info");
      return;
    }

    const title = elements.scannerDocTitle ? elements.scannerDocTitle.value.trim() : "";
    const uploadBtn = elements.btnConfirmUploadScan;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `<span>⏳ Đang nhận diện OCR & nạp...</span>`;

    try {
      showToast("Đang gửi ảnh lên máy chủ để xử lý OCR & Vector...", "info", 8000);
      const res = await window.ApiService.scanCameraDocument(state.capturedBlob, title);
      showToast(`Quét thành công! Đã trích xuất & lập chỉ mục ${res.total_chunks} đoạn quy chế.`, "success", 5000);

      // Close modal and refresh doc catalog
      closeCameraScannerModal();
      await loadDocuments();
    } catch (err) {
      showToast(`Lỗi khi quét tài liệu: ${err.message}`, "error", 7000);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = `<span>🚀 Nạp vào Kho Tri thức</span>`;
    }
  }

  // =========================================================================
  // Chat History Loader
  // =========================================================================
  async function loadChatHistory() {
    try {
      const history = await window.ApiService.getChatHistory(state.sessionId);
      if (history && history.messages && history.messages.length > 0) {
        if (elements.welcomeScreen && elements.welcomeScreen.parentNode) {
          elements.welcomeScreen.remove();
        }

        history.messages.forEach((msg) => {
          renderMessageBubble(msg.role, msg.content, msg.sources);
        });

        scrollToBottom();
      }
    } catch (e) {
      console.warn("Could not load past chat history:", e);
    }
  }

  // =========================================================================
  // Chat Message Sending & Streaming Execution
  // =========================================================================
  async function handleSendMessage() {
    if (state.isProcessing) return;

    const question = elements.chatInput.value.trim();
    if (!question) return;

    state.currentQuestion = question;

    // Reset input box
    elements.chatInput.value = "";
    elements.chatInput.style.height = "auto";

    // Hide welcome card if present
    if (elements.welcomeScreen && elements.welcomeScreen.parentNode) {
      elements.welcomeScreen.remove();
    }

    // 1. Render User message bubble
    renderMessageBubble("user", question);
    scrollToBottom();

    // 2. Prepare Bot response container
    state.isProcessing = true;
    elements.btnSend.disabled = true;

    const botMsgElements = createBotMessagePlaceholder();
    scrollToBottom();

    let fullAnswer = "";
    let accumulatedSources = [];

    // Helper: Safely and permanently remove typing dots
    const removeTypingDots = () => {
      if (botMsgElements.typingIndicator && botMsgElements.typingIndicator.parentNode) {
        botMsgElements.typingIndicator.remove();
      }
      botMsgElements.bubble.querySelectorAll(".typing-indicator").forEach((el) => el.remove());
    };

    // 3. Initiate SSE Streaming
    await window.ApiService.streamChat(state.sessionId, question, state.topK, {
      onSources: (sources) => {
        accumulatedSources = sources || [];
        renderSourcesCard(botMsgElements.sourcesContainer, accumulatedSources, question);
        scrollToBottom();
      },
      onToken: (token) => {
        // Crucial fix: Remove typing dots immediately on first token
        removeTypingDots();

        fullAnswer += token;
        botMsgElements.contentBox.innerHTML = formatMarkdown(fullAnswer);
        botMsgElements.contentBox.appendChild(botMsgElements.cursor);
        scrollToBottom();
      },
      onDone: () => {
        // Remove typing dots and blinking cursor
        removeTypingDots();
        if (botMsgElements.cursor) {
          botMsgElements.cursor.remove();
        }

        // Add Action Buttons: Copy & TTS
        attachMessageActions(botMsgElements.actionsContainer, fullAnswer, question);

        // Add 3 Dynamic Follow-up Question Chips
        attachFollowupChips(botMsgElements.followupContainer, question, fullAnswer);

        // Auto-TTS if enabled
        if (state.autoTTS && window.VoiceManager) {
          window.VoiceManager.speak(fullAnswer);
        }

        state.isProcessing = false;
        elements.btnSend.disabled = false;
        elements.chatInput.focus();
        scrollToBottom();
      },
      onError: (err) => {
        removeTypingDots();
        if (botMsgElements.cursor) {
          botMsgElements.cursor.remove();
        }

        botMsgElements.contentBox.innerHTML = `<span style="color:#ef4444;">Xin lỗi, đã xảy ra lỗi kết nối: ${escapeHtml(err.message)}</span>`;
        state.isProcessing = false;
        elements.btnSend.disabled = false;
        showToast("Không thể nhận câu trả lời từ máy chủ.", "error");
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
        <div class="avatar user-avatar">SV</div>
        <div class="bubble">${escapeHtml(content).replace(/\n/g, "<br>")}</div>
      `;
    } else {
      const bubble = document.createElement("div");
      bubble.className = "bubble";

      const contentDiv = document.createElement("div");
      contentDiv.className = "bot-markdown";
      contentDiv.innerHTML = formatMarkdown(content);
      bubble.appendChild(contentDiv);

      // Sources citation card
      if (sources && sources.length > 0) {
        const sourcesDiv = document.createElement("div");
        renderSourcesCard(sourcesDiv, sources, content);
        bubble.appendChild(sourcesDiv);
      }

      // Actions (Copy, TTS)
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "message-actions";
      attachMessageActions(actionsDiv, content, "");
      bubble.appendChild(actionsDiv);

      // Follow-up chips
      const followupDiv = document.createElement("div");
      followupDiv.className = "followup-container";
      attachFollowupChips(followupDiv, "", content);
      bubble.appendChild(followupDiv);

      row.innerHTML = `
        <div class="avatar bot-avatar">
          <img src="/assets/ntu-logo.svg" alt="NTU EduBot">
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
        <img src="/assets/ntu-logo.svg" alt="NTU EduBot">
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
        <span>Căn cứ pháp lý trích dẫn (${sources.length} tài liệu - Bấm để xem nguyên văn)</span>
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
                <div class="source-badge-wrap">
                  <span class="source-article-badge">${escapeHtml(articleBadge)}</span>
                </div>
                <div class="source-content-wrap">
                  <div class="source-title-line" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</div>
                  <div class="source-meter-wrap">
                    <div class="source-progress-bar">
                      <div class="source-progress-fill" style="width: ${scorePercent}%"></div>
                    </div>
                    <span class="source-score-text">${scorePercent}% tin cậy</span>
                  </div>
                </div>
                <div class="source-action-wrap">
                  <span class="btn-source-view">Xem nguyên văn ➔</span>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    // Attach click listeners to all source items to open Citation Preview Modal
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

  // =========================================================================
  // Message Actions: Copy, TTS & Follow-up Chips
  // =========================================================================
  function attachMessageActions(container, text, question) {
    container.innerHTML = "";

    // 1. Copy Answer Button
    const btnCopy = document.createElement("button");
    btnCopy.type = "button";
    btnCopy.className = "btn-msg-action btn-copy-msg";
    btnCopy.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Sao chép</span>
    `;

    btnCopy.addEventListener("click", () => {
      // Strip markdown syntax for clean copying
      const plainText = text.replace(/[*_#`>]/g, "").trim();
      navigator.clipboard.writeText(plainText).then(() => {
        btnCopy.classList.add("copied");
        btnCopy.querySelector("span").textContent = "Đã sao chép";
        showToast("Đã sao chép câu trả lời vào clipboard!", "success");
        setTimeout(() => {
          btnCopy.classList.remove("copied");
          btnCopy.querySelector("span").textContent = "Sao chép";
        }, 2500);
      }).catch(() => {
        showToast("Không thể sao chép văn bản.", "error");
      });
    });
    container.appendChild(btnCopy);

    // 2. Text-to-Speech (TTS) Button
    const btnTTS = document.createElement("button");
    btnTTS.type = "button";
    btnTTS.className = "btn-msg-action btn-tts";
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
        btnTTS.classList.remove("speaking");
        btnTTS.querySelector("span").textContent = "Nghe đọc";
      } else {
        btnTTS.classList.add("speaking");
        btnTTS.querySelector("span").textContent = "Đang đọc...";
        window.VoiceManager.speak(
          text,
          () => {},
          () => {
            btnTTS.classList.remove("speaking");
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

    // 1. Scholarship & Conduct
    if (combined.includes("học bổng") || combined.includes("rèn luyện") || combined.includes("điều 9") || combined.includes("điều 10") || combined.includes("điều 12") || combined.includes("điều 13")) {
      return [
        "Học bổng Xuất sắc được hỗ trợ bao nhiêu % học phí?",
        "Điểm rèn luyện từ bao nhiêu điểm thì đủ điều kiện học bổng?",
        "Sinh viên có môn phải học lại có được xét học bổng không?",
      ];
    }

    // 2. Warning & Expulsion
    if (combined.includes("cảnh báo") || combined.includes("buộc thôi học") || combined.includes("điều 7") || combined.includes("điều 8")) {
      return [
        "Bị cảnh báo học vụ mấy lần liên tiếp thì bị buộc thôi học?",
        "Sinh viên bị cảnh báo học vụ được đăng ký tối đa bao nhiêu tín chỉ?",
        "Điều kiện để được xóa cảnh báo học vụ trong kỳ tiếp theo?",
      ];
    }

    // 3. Retake & Improvement
    if (combined.includes("học lại") || combined.includes("cải thiện") || combined.includes("điểm f") || combined.includes("điều 5") || combined.includes("điều 6")) {
      return [
        "Học phần bị điểm F có bắt buộc phải đăng ký học lại không?",
        "Điểm C có được đăng ký học cải thiện điểm không?",
        "Điểm sau khi học cải thiện được tính vào ĐTBCTL như thế nào?",
      ];
    }

    // 4. Graduation & Thesis
    if (combined.includes("tốt nghiệp") || combined.includes("đồ án") || combined.includes("khóa luận") || combined.includes("chuẩn đầu ra") || combined.includes("điều 14") || combined.includes("điều 15") || combined.includes("điều 16")) {
      return [
        "Điều kiện về số tín chỉ tích lũy để được làm đồ án tốt nghiệp?",
        "Chuẩn đầu ra Ngoại ngữ (tiếng Anh) tốt nghiệp NTU yêu cầu gì?",
        "Trường hợp nào sinh viên tốt nghiệp loại Giỏi bị hạ một bậc xếp loại?",
      ];
    }

    // 5. Tuition & Academic Leave
    if (combined.includes("học phí") || combined.includes("bảo lưu") || combined.includes("nghỉ học") || combined.includes("tạm thời")) {
      return [
        "Thời hạn đóng học phí và thủ tục xin gia hạn học phí?",
        "Thời gian nghỉ học tạm thời và bảo lưu kết quả tối đa mấy kỳ?",
        "Thủ tục xin trở lại học tập sau khi hết thời gian bảo lưu?",
      ];
    }

    // 6. NTU General Introduction
    if (combined.includes("nguyễn trãi") || combined.includes("ntu") || combined.includes("giới thiệu") || combined.includes("khoa")) {
      return [
        "Trường Đại học Nguyễn Trãi có những ngành đào tạo mũi nhọn nào?",
        "Mô hình Đại học Ứng dụng tại NTU có những ưu điểm gì nổi bật?",
        "Địa chỉ trụ sở chính và các kênh hỗ trợ sinh viên của NTU?",
      ];
    }

    // Default Fallback Chips
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
  // Lightweight & Secure Markdown Parser with Legal Badge Highlighting
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
    let listType = ""; // 'ul' or 'ol'
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
      // Bold
      s = s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      // Italic
      s = s.replace(/\*(.*?)\*/g, "<em>$1</em>");
      // Inline Code
      s = s.replace(/`([^`]+)`/g, '<code class="bot-code">$1</code>');
      // Legal term badges
      s = s.replace(/\b(Điều\s+\d+[\.:]?)/gi, '<span class="badge-legal">$1</span>');
      s = s.replace(/\b(Khoản\s+\d+[\.:]?)/gi, '<span class="badge-legal">$1</span>');
      s = s.replace(
        /\b(CHƯƠNG\s+[IVXLCDM\d]+)/gi,
        '<span class="badge-legal" style="background:rgba(245,158,11,0.2);color:#fbbf24;border-color:rgba(245,158,11,0.4);">$1</span>'
      );
      // Markdown links: [text](url)
      s = s.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline;">$1</a>'
      );
      return s;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Table line: starts and ends with |
      if (line.startsWith("|") && line.endsWith("|")) {
        closeList();
        inTable = true;
        const cells = line.slice(1, -1).split("|").map((c) => c.trim());
        tableRows.push(cells);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // Horizontal Divider: --- or ***
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(line)) {
        closeList();
        result.push('<hr class="bot-divider">');
        continue;
      }

      // Headings
      if (line.startsWith("### ")) {
        closeList();
        result.push(`<h3 class="bot-heading-3">${inlineFormat(line.slice(4))}</h3>`);
        continue;
      }
      if (line.startsWith("## ")) {
        closeList();
        result.push(`<h2 class="bot-heading-2">${inlineFormat(line.slice(3))}</h2>`);
        continue;
      }
      if (line.startsWith("# ")) {
        closeList();
        result.push(`<h2 class="bot-heading-2">${inlineFormat(line.slice(2))}</h2>`);
        continue;
      }

      // Ordered list (1. , 2. )
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

      // Unordered list (- , * )
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

      // Empty line / paragraph break
      closeList();
      if (!line) {
        continue;
      }

      // Blockquote
      if (line.startsWith("&gt; ") || line.startsWith("> ")) {
        const quoteText = line.replace(/^(&gt;|>)\s+/, "");
        result.push(`<blockquote>${inlineFormat(quoteText)}</blockquote>`);
        continue;
      }

      // Standard paragraph
      result.push(`<p>${inlineFormat(line)}</p>`);
    }

    closeList();
    if (inTable) {
      flushTable();
    }

    return result.join("");
  }
});
