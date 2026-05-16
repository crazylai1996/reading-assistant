import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

const API_BASE = 'http://localhost:8000'

function formatTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function App() {
  const [books, setBooks] = useState([])
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [activeBook, setActiveBook] = useState(null)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const dragCounter = useRef(0)

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
      time: formatTime(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputValue('')

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    setIsLoading(true)

    try {
      const res = await fetch(`${API_BASE}/notes/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'laixiaoming',
          query: text,
          book_filter: activeBook || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || '请求失败')
      }

      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.answer,
          time: formatTime(),
        },
      ])
    } catch (err) {
      showToast(err.message || '问答失败，请检查服务是否启动', 'error')
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: '抱歉，服务暂不可用。请确认后端服务已启动。',
          time: formatTime(),
          error: true,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [inputValue, isLoading, activeBook, showToast])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleInput = useCallback(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }, [])

  const uploadFile = useCallback(
    async (file) => {
      if (!file.name.endsWith('.md')) {
        showToast('仅支持上传 .md 格式的文件', 'error')
        return
      }

      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch(`${API_BASE}/notes/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.detail || '上传失败')
        }

        const data = await res.json()
        setBooks((prev) => {
          const exists = prev.find((b) => b.title === data.filename)
          if (exists) return prev
          return [
            ...prev,
            {
              title: data.title || file.name.replace('.md', ''),
              author: ''
            },
          ]
        })
        showToast(`"${data.filename || file.name}" 上传成功`, 'success')
      } catch (err) {
        showToast(err.message || '上传失败，请检查服务是否启动', 'error')
      } finally {
        setIsUploading(false)
      }
    },
    [showToast],
  )

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0]
      if (file) uploadFile(file)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [uploadFile],
  )

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current++
      setIsDragging(true)
    }

    const handleDragLeave = (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current--
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setIsDragging(false)
      }
    }

    const handleDragOver = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current = 0
      setIsDragging(false)

      const file = e.dataTransfer?.files?.[0]
      if (file) uploadFile(file)
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [uploadFile])

  const handleHintClick = useCallback(
    (hint) => {
      setInputValue(hint)
      setTimeout(() => {
        textareaRef.current?.focus()
        handleInput()
      }, 50)
    },
    [handleInput],
  )

  const hasMessages = messages.length > 0

  return (
    <div className="app-layout">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <h1>读书笔记助手</h1>
          <p>你的AI阅读伙伴</p>
        </div>

        <div className="sidebar-books">
          <div className="book-list-label">
            已上传笔记 ({books.length})
          </div>

          {books.length === 0 ? (
            <div className="book-empty">
              <span className="book-empty-icon">📚</span>
              还没有上传读书笔记
              <br />
              点击下方按钮或拖拽 .md 文件
            </div>
          ) : (
            books.map((book) => (
              <div
                key={book.title}
                className={`book-item${activeBook === book.title ? ' active' : ''}`}
                onClick={() =>
                  setActiveBook(
                    activeBook === book.title ? null : book.title,
                  )
                }
              >
                <div className="book-icon">📖</div>
                <div className="book-info">
                  <div className="book-title">{book.title}</div>
                  {book.author && (
                    <div className="book-author">{book.author}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            className="upload-btn"
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            {isUploading ? '⏳ 上传中...' : '📤 上传笔记'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Drag overlay */}
        {isDragging && (
          <div className="drag-overlay">
            <div className="drag-overlay-content">
              📂 释放文件以上传读书笔记
            </div>
          </div>
        )}

        {/* Header */}
        <header className="chat-header">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <div>
            <div className="chat-header-title">
              {activeBook ? `正在提问: ${activeBook}` : '基于笔记问答'}
            </div>
            <div className="chat-header-subtitle">
              {activeBook
                ? '回答将基于该书笔记'
                : books.length > 0
                  ? `已加载 ${books.length} 本书的笔记`
                  : '请先上传读书笔记'}
            </div>
          </div>
        </header>

        {/* Messages / Welcome */}
        {!hasMessages ? (
          <div className="welcome-container">
            <div className="welcome-icon">📝</div>
            <h1>读书笔记助手</h1>
            <p>
              上传你的读书笔记，然后向 AI 提问。
              我会基于你的笔记内容，给你精准、有据可依的回答。
            </p>
            <div className="welcome-actions">
              <button className="upload-btn" onClick={handleUploadClick}>
                📤 上传笔记
              </button>
            </div>
            <div className="welcome-hints">
              <div
                className="welcome-hint"
                onClick={() => handleHintClick('这本书的核心观点是什么？')}
              >
                💡 这本书的核心观点是什么？
              </div>
              <div
                className="welcome-hint"
                onClick={() => handleHintClick('我在笔记中提到了哪些关键概念？')}
              >
                💡 我在笔记中提到了哪些关键概念？
              </div>
              <div
                className="welcome-hint"
                onClick={() => handleHintClick('总结一下我的读书笔记')}
              >
                💡 总结一下我的读书笔记
              </div>
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '我' : 'AI'}
                </div>
                <div>
                  <div
                    className={`message-bubble${msg.error ? ' error' : ''}`}
                  >
                    {msg.content}
                  </div>
                  <div className="message-time">{msg.time}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message assistant">
                <div className="message-avatar">AI</div>
                <div>
                  <div className="message-bubble">
                    <div className="typing-indicator">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area */}
        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={
                books.length === 0
                  ? '请先上传读书笔记再提问...'
                  : '输入你的问题，基于笔记内容回答...'
              }
              rows={1}
              disabled={books.length === 0}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading || books.length === 0}
            >
              ↑
            </button>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  )
}

export default App