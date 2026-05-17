import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

const API_BASE = 'http://localhost:8000/api'

function formatTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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

  const [readingHistory, setReadingHistory] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [currentView, setCurrentView] = useState('books')
  const [readingDetail, setReadingDetail] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(false)

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
  }, [messages, isLoading, readingDetail])

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    if (currentView !== 'books') setCurrentView('books')

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
      const body = {
        query: text,
        book_filter: activeBook || null,
      }
      if (activeConversationId) {
        body.conversation_id = activeConversationId
      }

      const res = await fetch(`${API_BASE}/notes/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

      if (data.conversation_id && !activeConversationId) {
        setActiveConversationId(data.conversation_id)
      }
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
  }, [inputValue, isLoading, activeBook, activeConversationId, currentView, showToast])

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
          const exists = prev.find((b) => b.title === data.title)
          if (exists) return prev
          return [
            ...prev,
            {
              title: data.title || file.name.replace('.md', ''),
              author: '',
              historyId: data.id,
            },
          ]
        })
        showToast(`"${data.title || file.name}" 上传成功`, 'success')
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

  const fetchReadingHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`${API_BASE}/history/reading?user_id=laixiaoming`)
      if (res.ok) {
        const data = await res.json()
        setReadingHistory(data.items || [])
      }
    } catch {
      // silent
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  const fetchConversations = useCallback(async () => {
    setLoadingConversations(true)
    try {
      const res = await fetch(`${API_BASE}/history/conversations?user_id=laixiaoming`)
      if (res.ok) {
        const data = await res.json()
        setConversations(data.items || [])
      }
    } catch {
      // silent
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  const handleSwitchView = useCallback((view) => {
    setCurrentView(view)
    setReadingDetail(null)
    if (view === 'history') fetchReadingHistory()
    if (view === 'conversations') fetchConversations()
  }, [fetchReadingHistory, fetchConversations])

  const handleViewReadingDetail = useCallback(async (item) => {
    try {
      const res = await fetch(`${API_BASE}/history/reading/${item.id}`)
      if (res.ok) {
        const data = await res.json()
        setReadingDetail(data)
      }
    } catch {
      showToast('获取详情失败', 'error')
    }
  }, [showToast])

  const handleDeleteReading = useCallback(async (item) => {
    setConfirmDelete({ type: 'reading', item, message: `确定要删除"${item.book_title || item.filename}"的阅读记录吗？` })
  }, [])

  const handleDeleteConversation = useCallback((item) => {
    setConfirmDelete({ type: 'conversation', item, message: `确定要删除"${item.title}"这个对话吗？` })
  }, [])

  const executeDelete = useCallback(async () => {
    if (!confirmDelete) return
    const { type, item } = confirmDelete
    setConfirmDelete(null)

    try {
      if (type === 'reading') {
        const res = await fetch(`${API_BASE}/history/reading/${item.id}`, { method: 'DELETE' })
        if (res.ok) {
          showToast('已删除', 'success')
          fetchReadingHistory()
          setReadingDetail(null)
        } else {
          showToast('删除失败', 'error')
        }
      } else if (type === 'conversation') {
        const res = await fetch(`${API_BASE}/history/conversations/${item.id}`, { method: 'DELETE' })
        if (res.ok) {
          showToast('对话已删除', 'success')
          fetchConversations()
        } else {
          showToast('删除失败', 'error')
        }
      }
    } catch {
      showToast('删除失败', 'error')
    }
  }, [confirmDelete, fetchReadingHistory, fetchConversations, showToast])

  const handleLoadConversation = useCallback(async (conv) => {
    try {
      const res = await fetch(`${API_BASE}/history/conversations/${conv.id}`)
      if (res.ok) {
        const data = await res.json()
        const msgs = (data.messages || []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          time: formatDate(m.created_at),
        }))
        setMessages(msgs)
        setActiveConversationId(conv.id)
        setCurrentView('books')
        setSidebarOpen(false)
      }
    } catch {
      showToast('加载对话失败', 'error')
    }
  }, [showToast])

  const handleStartNewChat = useCallback(() => {
    setMessages([])
    setActiveConversationId(null)
    setCurrentView('books')
  }, [])

  const hasMessages = messages.length > 0

  const renderSidebarContent = () => {
    switch (currentView) {
      case 'history':
        return (
          <>
            <div className="book-list-label">阅读历史 ({readingHistory.length})</div>
            {loadingHistory ? (
              <div className="book-empty"><span className="book-empty-icon">⏳</span>加载中...</div>
            ) : readingHistory.length === 0 ? (
              <div className="book-empty">
                <span className="book-empty-icon">📭</span>
                暂无阅读记录
              </div>
            ) : (
              readingHistory.map((item) => (
                <div
                  key={item.id}
                  className="history-item"
                  onClick={() => handleViewReadingDetail(item)}
                >
                  <div className="history-item-icon">📄</div>
                  <div className="history-item-info">
                    <div className="history-item-title">{item.book_title || item.filename}</div>
                    {item.author && <div className="history-item-sub">{item.author}</div>}
                    <div className="history-item-time">{formatDate(item.uploaded_at)}</div>
                  </div>
                  <button
                    className="history-item-delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteReading(item) }}
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </>
        )

      case 'conversations':
        return (
          <>
            <div className="book-list-label">对话记录 ({conversations.length})</div>
            {loadingConversations ? (
              <div className="book-empty"><span className="book-empty-icon">⏳</span>加载中...</div>
            ) : conversations.length === 0 ? (
              <div className="book-empty">
                <span className="book-empty-icon">💬</span>
                暂无对话记录
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`conversation-item${activeConversationId === conv.id ? ' active' : ''}`}
                  onClick={() => handleLoadConversation(conv)}
                >
                  <div className="conversation-item-icon">💬</div>
                  <div className="conversation-item-info">
                    <div className="conversation-item-title">{conv.title}</div>
                    <div className="conversation-item-sub">
                      {conv.message_count} 条消息 · {formatDate(conv.updated_at)}
                    </div>
                  </div>
                  <button
                    className="history-item-delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv) }}
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </>
        )

      case 'books':
      default:
        return (
          <>
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
          </>
        )
    }
  }

  const renderMainContent = () => {
    if (readingDetail) {
      return (
        <div className="reading-detail">
          <button className="reading-detail-back" onClick={() => setReadingDetail(null)}>
            ← 返回
          </button>
          <div className="reading-detail-header">
            <h2>{readingDetail.book_title || readingDetail.filename}</h2>
            {readingDetail.author && (
              <div className="reading-detail-author">{readingDetail.author}</div>
            )}
            <div className="reading-detail-time">
              上传时间: {readingDetail.uploaded_at}
            </div>
          </div>
          <div className="reading-detail-content markdown-content">
            {readingDetail.content_md?.split('\n').map((line, i) => (
              <div key={i}>{line || '\u00A0'}</div>
            ))}
          </div>
          <div className="reading-detail-actions">
            <button
              className="delete-btn"
              onClick={() => handleDeleteReading(readingDetail)}
            >
              删除笔记
            </button>
          </div>
        </div>
      )
    }

    if (!hasMessages) {
      return (
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
      )
    }

    return (
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
    )
  }

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {confirmDelete && (
        <div className="confirm-dialog-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>{confirmDelete.message}</p>
            <div className="confirm-dialog-actions">
              <button className="confirm-btn cancel" onClick={() => setConfirmDelete(null)}>取消</button>
              <button className="confirm-btn danger" onClick={executeDelete}>删除</button>
            </div>
          </div>
        </div>
      )}

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <h1>读书笔记助手</h1>
          <p>你的AI阅读伙伴</p>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-nav-item${currentView === 'books' ? ' active' : ''}`}
            onClick={() => handleSwitchView('books')}
          >
            当前对话
          </button>
          <button
            className={`sidebar-nav-item${currentView === 'history' ? ' active' : ''}`}
            onClick={() => handleSwitchView('history')}
          >
            阅读历史
          </button>
          <button
            className={`sidebar-nav-item${currentView === 'conversations' ? ' active' : ''}`}
            onClick={() => handleSwitchView('conversations')}
          >
            对话记录
          </button>
        </nav>

        <div className="sidebar-books">
          {renderSidebarContent()}
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

      <main className="main-content">
        {isDragging && (
          <div className="drag-overlay">
            <div className="drag-overlay-content">
              📂 释放文件以上传读书笔记
            </div>
          </div>
        )}

        <header className="chat-header">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <div style={{ flex: 1 }}>
            <div className="chat-header-title">
              {readingDetail
                ? '阅读详情'
                : activeBook
                  ? `正在提问: ${activeBook}`
                  : '基于笔记问答'}
            </div>
            <div className="chat-header-subtitle">
              {readingDetail
                ? readingDetail.book_title || readingDetail.filename
                : activeBook
                  ? '回答将基于该书笔记'
                  : books.length > 0
                    ? `已加载 ${books.length} 本书的笔记`
                    : '请先上传读书笔记'}
            </div>
          </div>
          {activeConversationId && !readingDetail && (
            <button className="new-chat-btn" onClick={handleStartNewChat}>
              新对话
            </button>
          )}
        </header>

        {renderMainContent()}

        {!readingDetail && (
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
        )}
      </main>

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  )
}

export default App