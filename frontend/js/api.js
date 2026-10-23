/**
 * NTU EduBot - API Client Service
 * Encapsulates all asynchronous RESTful and Server-Sent Events (SSE) interactions with the backend.
 * 
 * Error handling: All connection errors display user-friendly Vietnamese messages.
 * "Sever đang bảo trì sinh viên vui lòng chờ !!!" - never shows raw English error text.
 */

const SERVER_MAINTENANCE_MSG = "Sever đang bảo trì sinh viên vui lòng chờ !!!";

class ApiService {
  constructor(baseUrl = "") {
    // Relative URL works seamlessly when served from FastAPI root
    this.baseUrl = baseUrl;
  }

  /**
   * Internal fetch wrapper that converts any network/fetch error into
   * the friendly Vietnamese maintenance message.
   * @private
   */
  async _safeFetch(url, options = {}) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      // Convert "Failed to fetch", network errors, CORS errors to friendly message
      const friendlyError = new Error(SERVER_MAINTENANCE_MSG);
      friendlyError.isServerMaintenance = true;
      throw friendlyError;
    }
  }

  /**
   * Check backend health and operational status.
   * @returns {Promise<Object>} Health report object.
   */
  async checkHealth() {
    const res = await this._safeFetch(`${this.baseUrl}/health`);
    if (!res.ok) throw new Error(SERVER_MAINTENANCE_MSG);
    return await res.json();
  }

  /**
   * Stream chat inquiry using Server-Sent Events (SSE).
   * @param {string} sessionId - Active session ID.
   * @param {string} question - Student inquiry text.
   * @param {number} topK - Number of source contexts to retrieve.
   * @param {Object} callbacks - Handlers for onSources, onToken, onDone, onError.
   */
  async streamChat(sessionId, question, topK = 5, callbacks = {}) {
    const { onSources, onToken, onDone, onError } = callbacks;

    // Safely invoke callbacks to prevent UI errors from disrupting network flow
    const safeCall = (fn, ...args) => {
      if (typeof fn === "function") {
        try {
          fn(...args);
        } catch (callbackErr) {
          console.warn("Callback error inside streamChat:", callbackErr);
        }
      }
    };

    let receivedTokens = false;
    let isDone = false;

    const triggerDone = (data) => {
      if (!isDone) {
        isDone = true;
        safeCall(onDone, data);
      }
    };

    try {
      const response = await this._safeFetch(`${this.baseUrl}/api/v1/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question: question,
          top_k: Number(topK),
        }),
      });

      if (!response.ok) {
        throw new Error(SERVER_MAINTENANCE_MSG);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      const processRawEvent = (rawEvent) => {
        if (!rawEvent || !rawEvent.trim()) return;

        let eventName = "message";
        let dataStr = "";

        const lines = rawEvent.split("\n");
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.replace("event:", "").trim();
          } else if (line.startsWith("data:")) {
            dataStr += line.replace("data:", "").trim();
          }
        }

        if (!dataStr) return;

        try {
          const parsedData = JSON.parse(dataStr);
          if (eventName === "sources") {
            // Valid sources event, even if empty array [] for greetings
            safeCall(onSources, parsedData);
          } else if (eventName === "message") {
            if (parsedData && parsedData.token) {
              receivedTokens = true;
              safeCall(onToken, parsedData.token);
            }
          } else if (eventName === "done") {
            triggerDone(parsedData);
          }
        } catch (jsonErr) {
          console.warn("Failed to parse SSE JSON payload:", dataStr, jsonErr);
        }
      };

      while (true) {
        let readResult;
        try {
          readResult = await reader.read();
        } catch (streamErr) {
          if (receivedTokens) {
            triggerDone();
            return;
          }
          throw new Error(SERVER_MAINTENANCE_MSG);
        }

        const { value, done } = readResult;
        if (done) {
          if (buffer && buffer.trim()) {
            processRawEvent(buffer);
            buffer = "";
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop(); // Keep incomplete slice

        for (const rawEvent of events) {
          processRawEvent(rawEvent);
        }
      }

      triggerDone();

    } catch (err) {
      // If we already received tokens, do not throw false error
      if (receivedTokens) {
        triggerDone();
        return;
      }

      console.warn("Stream unavailable, attempting non-streaming fallback...");
      try {
        const fallbackRes = await this._safeFetch(`${this.baseUrl}/api/v1/chat/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            question: question,
            top_k: Number(topK),
          }),
        });

        if (!fallbackRes.ok) throw new Error(SERVER_MAINTENANCE_MSG);
        const data = await fallbackRes.json();

        if (data.sources) {
          safeCall(onSources, data.sources);
        }
        if (data.answer) {
          safeCall(onToken, data.answer);
        }
        triggerDone(data);
      } catch (fallbackErr) {
        const finalError = new Error(SERVER_MAINTENANCE_MSG);
        safeCall(onError, finalError);
      }
    }
  }

  /**
   * Retrieve conversation history for a session.
   * @param {string} sessionId - Target session ID.
   * @returns {Promise<Object>} Object containing messages array.
   */
  async getChatHistory(sessionId) {
    const res = await this._safeFetch(`${this.baseUrl}/api/v1/chat/history/${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error(SERVER_MAINTENANCE_MSG);
    return await res.json();
  }

  /**
   * Clear all stored conversation history for a session.
   * @param {string} sessionId - Target session ID.
   * @returns {Promise<Object>} Deletion result.
   */
  async clearChatHistory(sessionId) {
    const res = await this._safeFetch(`${this.baseUrl}/api/v1/chat/history/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(SERVER_MAINTENANCE_MSG);
    return await res.json();
  }

  /**
   * Alias for clearChatHistory to ensure seamless compatibility with main.js callers.
   * @param {string} sessionId - Target session ID.
   * @returns {Promise<Object>} Deletion result.
   */
  async deleteChatHistory(sessionId) {
    return await this.clearChatHistory(sessionId);
  }

  /**
   * Clear all chat sessions and history, optionally filtered by student ID.
   * @param {string} [studentId] - Optional student ID.
   * @returns {Promise<Object>} Deletion result.
   */
  async clearAllSessions(studentId = "") {
    let url = `${this.baseUrl}/api/v1/chat/sessions/all`;
    if (studentId && studentId.trim()) {
      url += `?student_id=${encodeURIComponent(studentId.trim())}`;
    }
    const res = await this._safeFetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error(SERVER_MAINTENANCE_MSG);
    return await res.json();
  }

  /**
   * Ingest a new regulation document into MongoDB Atlas vector storage.
   * @param {File} file - PDF, image, or text file.
   * @param {string} [title] - Optional document title.
   * @param {string} [studentId] - Optional student ID (MSSV) for ownership tracking.
   * @returns {Promise<Object>} Upload metrics.
   */
  async uploadDocument(file, title = "", studentId = "") {
    const formData = new FormData();
    formData.append("file", file);
    if (title && title.trim()) {
      formData.append("title", title.trim());
    }
    if (studentId && studentId.trim()) {
      formData.append("student_id", studentId.trim());
    }

    const res = await this._safeFetch(`${this.baseUrl}/api/v1/documents/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || SERVER_MAINTENANCE_MSG);
    }
    return await res.json();
  }

  /**
   * Scan and ingest document directly from camera snapshot (Live Webcam / Smartphone).
   * @param {File|Blob} imageFileOrBlob - Captured image file or blob.
   * @param {string} [title] - Optional document title.
   * @param {string} [studentId] - Optional student ID (MSSV).
   * @returns {Promise<Object>} Upload metrics.
   */
  async scanCameraDocument(imageFileOrBlob, title = "", studentId = "") {
    const formData = new FormData();
    const filename = imageFileOrBlob.name || `camera_scan_${Date.now()}.jpg`;
    formData.append("file", imageFileOrBlob, filename);
    if (title && title.trim()) {
      formData.append("title", title.trim());
    }
    if (studentId && studentId.trim()) {
      formData.append("student_id", studentId.trim());
    }

    const res = await this._safeFetch(`${this.baseUrl}/api/v1/documents/scan-camera`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || SERVER_MAINTENANCE_MSG);
    }
    return await res.json();
  }

  /**
   * Fetch list of all ingested documents in the vector database.
   * @param {string} [studentId] - If provided, only return this student's documents.
   * @returns {Promise<Array>} Array of document records.
   */
  async getDocuments(studentId = "") {
    let url = `${this.baseUrl}/api/v1/documents/list`;
    if (studentId && studentId.trim()) {
      url += `?student_id=${encodeURIComponent(studentId.trim())}`;
    }
    const res = await this._safeFetch(url);
    if (!res.ok) throw new Error(SERVER_MAINTENANCE_MSG);
    return await res.json();
  }

  /**
   * Get full text content of a student-uploaded document.
   * @param {string} docId - Target document identifier.
   * @returns {Promise<Object>} Document detail with content.
   */
  async getDocumentDetail(docId) {
    const res = await this._safeFetch(`${this.baseUrl}/api/v1/documents/${encodeURIComponent(docId)}/detail`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || SERVER_MAINTENANCE_MSG);
    }
    return await res.json();
  }

  /**
   * Update the title of a student-uploaded document.
   * @param {string} docId - Target document identifier.
   * @param {string} newTitle - New display title.
   * @returns {Promise<Object>} Update result.
   */
  async updateDocumentTitle(docId, newTitle) {
    const res = await this._safeFetch(`${this.baseUrl}/api/v1/documents/${encodeURIComponent(docId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || SERVER_MAINTENANCE_MSG);
    }
    return await res.json();
  }

  /**
   * Delete a document and its vector chunks from the database.
   * @param {string} docId - Target document identifier.
   * @returns {Promise<Object>} Result.
   */
  async deleteDocument(docId) {
    const res = await this._safeFetch(`${this.baseUrl}/api/v1/documents/${encodeURIComponent(docId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || SERVER_MAINTENANCE_MSG);
    }
    return await res.json();
  }

  /**
   * Transcribe recorded audio file using Gemini Multimodal Audio.
   * @param {Blob} audioBlob - Audio recording blob.
   * @returns {Promise<string>} Transcribed text string.
   */
  async transcribeAudio(audioBlob) {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    const res = await this._safeFetch(`${this.baseUrl}/api/v1/voice/transcribe`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || SERVER_MAINTENANCE_MSG);
    }
    const data = await res.json();
    return data.text || "";
  }

  /**
   * Retrieve speech synthesis configuration for Web Speech API.
   * @returns {Promise<Object>} Speech parameters.
   */
  async getVoiceConfig() {
    try {
      const res = await this._safeFetch(`${this.baseUrl}/api/v1/voice/config`);
      if (!res.ok) return { lang: "vi-VN", rate: 1.0, pitch: 1.0 };
      return await res.json();
    } catch {
      return { lang: "vi-VN", rate: 1.0, pitch: 1.0 };
    }
  }

  /**
   * Fetch list of all conversation sessions with titles and pinned status.
   * @param {number} limit - Maximum number of sessions.
   * @param {string} [studentId] - Optional student ID to filter sessions.
   * @returns {Promise<Object>} Object with sessions array.
   */
  async getSessions(limit = 50, studentId = "") {
    let url = `${this.baseUrl}/api/v1/chat/sessions?limit=${limit}`;
    if (studentId && studentId.trim()) {
      url += `&student_id=${encodeURIComponent(studentId.trim())}`;
    }
    const res = await this._safeFetch(url);
    if (!res.ok) throw new Error(SERVER_MAINTENANCE_MSG);
    return await res.json();
  }

  /**
   * Update session title or pinned status.
   * @param {string} sessionId - Target session ID.
   * @param {Object} updateData - Object with optional title and/or is_pinned.
   * @returns {Promise<Object>} Updated SessionMetadata.
   */
  async updateSession(sessionId, updateData = {}) {
    const res = await this._safeFetch(`${this.baseUrl}/api/v1/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || SERVER_MAINTENANCE_MSG);
    }
    return await res.json();
  }

  /**
   * Trigger download of Microsoft Word (.doc) consultation record for a session.
   * @param {string} sessionId - Target session ID.
   */
  exportSessionWordUrl(sessionId) {
    return `${this.baseUrl}/api/v1/chat/sessions/${encodeURIComponent(sessionId)}/export-word`;
  }

  async exportSessionWord(sessionId) {
    const url = this.exportSessionWordUrl(sessionId);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `NTU_EduBot_TuVanHocVu_${sessionId.slice(0, 12)}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Attach globally
window.ApiService = new ApiService();
