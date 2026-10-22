/**
 * NTU EduBot - API Client Service
 * Encapsulates all asynchronous RESTful and Server-Sent Events (SSE) interactions with the backend.
 */

class ApiService {
  constructor(baseUrl = "") {
    // Relative URL works seamlessly when served from FastAPI root
    this.baseUrl = baseUrl;
  }

  /**
   * Check backend health and operational status.
   * @returns {Promise<Object>} Health report object.
   */
  async checkHealth() {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`);
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

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question: question,
          top_k: Number(topK),
        }),
      });

      if (!response.ok) {
        throw new Error(`SSE streaming failed with status HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        // Keep the last incomplete slice in the buffer
        buffer = events.pop();

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;

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

          if (!dataStr) continue;

          try {
            const parsedData = JSON.parse(dataStr);
            if (eventName === "sources" && typeof onSources === "function") {
              onSources(parsedData);
            } else if (eventName === "message" && typeof onToken === "function") {
              if (parsedData && parsedData.token) {
                onToken(parsedData.token);
              }
            } else if (eventName === "done" && typeof onDone === "function") {
              onDone(parsedData);
            }
          } catch (jsonErr) {
            console.warn("Failed to parse SSE JSON payload:", dataStr, jsonErr);
          }
        }
      }

      if (typeof onDone === "function") onDone();

    } catch (err) {
      console.warn("Stream error encountered. Attempting non-streaming fallback...", err);
      // Fallback gracefully to non-streaming endpoint
      try {
        const fallbackRes = await fetch(`${this.baseUrl}/api/v1/chat/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            question: question,
            top_k: Number(topK),
          }),
        });

        if (!fallbackRes.ok) throw new Error(`Fallback HTTP ${fallbackRes.status}`);
        const data = await fallbackRes.json();

        if (typeof onSources === "function" && data.sources) {
          onSources(data.sources);
        }
        if (typeof onToken === "function" && data.answer) {
          onToken(data.answer);
        }
        if (typeof onDone === "function") {
          onDone();
        }
      } catch (fallbackErr) {
        if (typeof onError === "function") {
          onError(fallbackErr);
        }
      }
    }
  }

  /**
   * Retrieve conversation history for a session.
   * @param {string} sessionId - Target session ID.
   * @returns {Promise<Object>} Object containing messages array.
   */
  async getChatHistory(sessionId) {
    const res = await fetch(`${this.baseUrl}/api/v1/chat/history/${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error(`Failed to fetch chat history: HTTP ${res.status}`);
    return await res.json();
  }

  /**
   * Clear all stored conversation history for a session.
   * @param {string} sessionId - Target session ID.
   * @returns {Promise<Object>} Deletion result.
   */
  async clearChatHistory(sessionId) {
    const res = await fetch(`${this.baseUrl}/api/v1/chat/history/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Failed to clear history: HTTP ${res.status}`);
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
   * Ingest a new regulation document into MongoDB Atlas vector storage.
   * @param {File} file - PDF, image, or text file.
   * @param {string} [title] - Optional document title.
   * @returns {Promise<Object>} Upload metrics.
   */
  async uploadDocument(file, title = "") {
    const formData = new FormData();
    formData.append("file", file);
    if (title && title.trim()) {
      formData.append("title", title.trim());
    }

    const res = await fetch(`${this.baseUrl}/api/v1/documents/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `Upload failed: HTTP ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Scan and ingest document directly from camera snapshot (Live Webcam / Smartphone).
   * @param {File|Blob} imageFileOrBlob - Captured image file or blob.
   * @param {string} [title] - Optional document title.
   * @returns {Promise<Object>} Upload metrics.
   */
  async scanCameraDocument(imageFileOrBlob, title = "") {
    const formData = new FormData();
    const filename = imageFileOrBlob.name || `camera_scan_${Date.now()}.jpg`;
    formData.append("file", imageFileOrBlob, filename);
    if (title && title.trim()) {
      formData.append("title", title.trim());
    }

    const res = await fetch(`${this.baseUrl}/api/v1/documents/scan-camera`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `Quét tài liệu qua Camera thất bại: HTTP ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Fetch list of all ingested documents in the vector database.
   * @returns {Promise<Array>} Array of document records.
   */
  async getDocuments() {
    const res = await fetch(`${this.baseUrl}/api/v1/documents/list`);
    if (!res.ok) throw new Error(`Failed to list documents: HTTP ${res.status}`);
    return await res.json();
  }

  /**
   * Delete a document and its vector chunks from the database.
   * @param {string} docId - Target document identifier.
   * @returns {Promise<Object>} Result.
   */
  async deleteDocument(docId) {
    const res = await fetch(`${this.baseUrl}/api/v1/documents/${encodeURIComponent(docId)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Failed to delete document: HTTP ${res.status}`);
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

    const res = await fetch(`${this.baseUrl}/api/v1/voice/transcribe`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Audio transcription failed: HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.text || "";
  }

  /**
   * Retrieve speech synthesis configuration for Web Speech API.
   * @returns {Promise<Object>} Speech parameters.
   */
  async getVoiceConfig() {
    const res = await fetch(`${this.baseUrl}/api/v1/voice/config`);
    if (!res.ok) return { lang: "vi-VN", rate: 1.0, pitch: 1.0 };
    return await res.json();
  }
}

// Attach globally
window.ApiService = new ApiService();
