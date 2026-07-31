"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ChatEvent, useChatHistory } from "./use-chat-history";

type PageName = "Trợ lý sự kiện" | "Thông báo" | "Lịch của tôi";
type AuthMode = "signin" | "signup";

type AuthAccount = {
  name: string;
  email: string;
  password: string;
  role: string;
};

type EventItem = {
  id: string;
  title: string;
  date: string;
  day: number;
  time: string;
  place: string;
  organizer: string;
  category: string;
  status: string;
};

type NoticeItem = {
  id: string | number;
  icon: string;
  tone: string;
  title: string;
  text: string;
  time: string;
  category: string;
  is_read?: boolean;
};

const navItems: { icon: string; label: PageName; badge?: boolean }[] = [
  { icon: "✦", label: "Trợ lý sự kiện" },
  { icon: "🔔", label: "Thông báo", badge: true },
  { icon: "▫", label: "Lịch của tôi" },
];

const suggestions = [
  "Cuối tuần này có workshop nào?",
  "Sự kiện nào sắp hết hạn?",
  "Có sự kiện miễn phí hôm nay không?",
];

const pageCopy: Record<PageName, { title: string; subtitle: string }> = {
  "Trợ lý sự kiện": {
    title: "Trợ lý sự kiện VLearn",
    subtitle: "Hỏi về workshop, hoạt động và deadline đăng ký.",
  },
  "Thông báo": {
    title: "Thông báo",
    subtitle: "Theo dõi deadline, cập nhật và lời nhắc sự kiện.",
  },
  "Lịch của tôi": {
    title: "Lịch của tôi",
    subtitle: "Xem toàn bộ sự kiện và lời nhắc theo thời gian.",
  },
};

const AUTH_DB_KEY = "vlearn-event-ai:auth-db:v1";
const AUTH_SESSION_KEY = "vlearn-event-ai:auth-session:v1";

const DEFAULT_AUTH_ACCOUNTS: AuthAccount[] = [
  {
    name: "Demo User",
    email: "demo@vlearn.local",
    password: "demo123",
    role: "Demo",
  },
  {
    name: "Huy Quốc",
    email: "huyquoc@vlearn.edu.vn",
    password: "huy12345",
    role: "Sinh viên",
  },
  {
    name: "Ban CTSV",
    email: "ctsv@vlearn.edu.vn",
    password: "ctsv2026",
    role: "Điều phối",
  },
];

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

function mapReminderToEventItem(reminder: any): EventItem {
  const startsAt = reminder.starts_at ? new Date(reminder.starts_at) : new Date();
  const categoryRaw = reminder.category || "Sự kiện";
  return {
    id: reminder.event_id,
    title: reminder.event_title,
    date: startsAt.toLocaleDateString("vi-VN"),
    day: startsAt.getDate(),
    time: startsAt.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    place: reminder.place || "Chưa cập nhật",
    organizer: reminder.organizer || "Chưa rõ",
    category: categoryRaw.charAt(0).toUpperCase() + categoryRaw.slice(1),
    status: reminder.status === "published" ? "Sắp diễn ra" : reminder.status || "Chưa rõ",
  };
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authAccounts, setAuthAccounts] = useState<AuthAccount[]>(DEFAULT_AUTH_ACCOUNTS);
  const [currentUser, setCurrentUser] = useState<AuthAccount | null>(null);
  const [active, setActive] = useState<PageName>("Trợ lý sự kiện");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<EventItem | null>(null);
  const [toast, setToast] = useState("");
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [readNotices, setReadNotices] = useState<(string | number)[]>([]);
  const [myEvents, setMyEvents] = useState<EventItem[]>([]);
  const [remindedEvents, setRemindedEvents] = useState<string[]>([]);
  const [monthOffset, setMonthOffset] = useState(0);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const {
    conversations,
    activeConversation,
    activeId,
    loading,
    streamStatus,
    historyReady,
    ask,
    newConversation,
    selectConversation,
    deleteConversation,
  } = useChatHistory();

  const monthLabels = ["Tháng 7, 2026", "Tháng 8, 2026", "Tháng 9, 2026"];
  const monthLabel = monthLabels[monthOffset + 1];
  const unreadCount = Math.max(0, notices.length - readNotices.length);

  async function fetchData() {
    try {
      const baseUrl = getApiBaseUrl();

      const [notificationsResponse, remindersResponse] = await Promise.all([
        fetch(`${baseUrl}/api/notifications`),
        fetch(`${baseUrl}/api/reminders`),
      ]);

      if (notificationsResponse.ok) {
        const notificationData = (await notificationsResponse.json()) as NoticeItem[];
        setNotices(notificationData);
        setReadNotices(
          notificationData.filter((item) => item.is_read).map((item) => item.id),
        );
      }

      if (remindersResponse.ok) {
        const reminderData = (await remindersResponse.json()) as any[];
        const mappedEvents = reminderData.map(mapReminderToEventItem);
        setMyEvents(mappedEvents);
        setRemindedEvents(reminderData.map((item) => item.event_id));
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    }
  }

  useEffect(() => {
    void fetchData();
    const interval = window.setInterval(() => {
      void fetchData();
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const storedAccounts = window.localStorage.getItem(AUTH_DB_KEY);
      const parsedAccounts = storedAccounts
        ? (JSON.parse(storedAccounts) as AuthAccount[])
        : DEFAULT_AUTH_ACCOUNTS;
      const safeAccounts =
        Array.isArray(parsedAccounts) && parsedAccounts.length
          ? parsedAccounts
          : DEFAULT_AUTH_ACCOUNTS;
      setAuthAccounts(safeAccounts);
      window.localStorage.setItem(AUTH_DB_KEY, JSON.stringify(safeAccounts));

      const storedSession = window.localStorage.getItem(AUTH_SESSION_KEY);
      if (storedSession) {
        const session = JSON.parse(storedSession) as AuthAccount;
        setCurrentUser(session);
        setAuthenticated(true);
        setAuthEmail(session.email);
      }
    } catch {
      window.localStorage.setItem(AUTH_DB_KEY, JSON.stringify(DEFAULT_AUTH_ACCOUNTS));
      setAuthAccounts(DEFAULT_AUTH_ACCOUNTS);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeConversation?.messages, loading]);

  function notify(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2200);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim() || loading) return;
    const nextQuery = query.trim();
    setQuery("");
    void ask(nextQuery);
  }

  function submitAuth(event: FormEvent) {
    event.preventDefault();
    const email = authEmail.trim();
    const password = authPassword.trim();
    const name = authName.trim();

    if (!email || !password || (authMode === "signup" && !name)) {
      notify("Vui lòng điền đủ thông tin để tiếp tục");
      return;
    }

    if (authMode === "signup") {
      const existed = authAccounts.some(
        (account) => account.email.toLowerCase() === email.toLowerCase(),
      );
      if (existed) {
        notify("Email này đã tồn tại trong database demo");
        return;
      }

      const nextAccount: AuthAccount = {
        name,
        email,
        password,
        role: "Sinh viên mới",
      };
      const nextAccounts = [...authAccounts, nextAccount];
      setAuthAccounts(nextAccounts);
      window.localStorage.setItem(AUTH_DB_KEY, JSON.stringify(nextAccounts));
      setAuthMode("signin");
      setAuthPassword(password);
      notify(`Đăng ký thành công cho ${name}. Mời bạn đăng nhập.`);
      return;
    }

    const matchedAccount = authAccounts.find(
      (account) =>
        account.email.toLowerCase() === email.toLowerCase() &&
        account.password === password,
    );
    if (!matchedAccount) {
      notify("Sai email hoặc mật khẩu");
      return;
    }

    setCurrentUser(matchedAccount);
    setAuthenticated(true);
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(matchedAccount));
    notify(`Đăng nhập thành công cho ${matchedAccount.email}`);
  }

  function loginDemo() {
    const demoAccount =
      authAccounts.find((account) => account.email === "demo@vlearn.local") ??
      DEFAULT_AUTH_ACCOUNTS[0];
    setAuthMode("signin");
    setAuthName(demoAccount.name);
    setAuthEmail(demoAccount.email);
    setAuthPassword(demoAccount.password);
    setCurrentUser(demoAccount);
    setAuthenticated(true);
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(demoAccount));
    notify("Đã đăng nhập bằng tài khoản demo");
  }

  function logout() {
    setAuthenticated(false);
    setCurrentUser(null);
    setAuthMode("signin");
    setAuthPassword("");
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    notify("Đã đăng xuất");
  }

  function formatEventDate(value: string) {
    return new Intl.DateTimeFormat("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function formatDeadline(event: ChatEvent) {
    if (!event.registration_deadline) return "Chưa rõ hạn đăng ký";
    return `Hạn đăng ký ${new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(event.registration_deadline))}`;
  }

  async function askToRegister(event: ChatEvent) {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: event.id, event_title: event.title }),
      });
      if (!response.ok) {
        throw new Error("register_failed");
      }
      await fetchData();
      notify("Đã đăng ký và thêm vào Lịch của tôi");
      setActive("Lịch của tôi");
      void ask(`Mình muốn đăng ký sự kiện "${event.title}"`);
    } catch {
      notify("Lỗi khi đăng ký sự kiện");
    }
  }

  async function askToRemind(event: ChatEvent) {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: event.id, event_title: event.title }),
      });
      if (!response.ok) {
        throw new Error("reminder_failed");
      }
      await fetchData();
      notify("Đã tạo lời nhắc trong Thông báo");
      setActive("Thông báo");
      void ask(`Lên lịch nhắc mình cho sự kiện "${event.title}"`);
    } catch {
      notify("Lỗi khi tạo lời nhắc");
    }
  }

  function runSuggestedAction(action: string, event?: ChatEvent) {
    const selectedEvent = event ?? activeConversation?.messages.at(-1)?.events?.[0];
    if (!selectedEvent) {
      notify("Chưa có sự kiện cụ thể để thao tác");
      return;
    }

    if (action === "register_event") {
      void askToRegister(selectedEvent);
      return;
    }

    if (action === "create_reminder") {
      void askToRemind(selectedEvent);
    }
  }

  if (!authReady) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card-loading">
          <strong>Đang tải dữ liệu đăng nhập demo…</strong>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="auth-shell">
        <section className="auth-hero">
          <span className="auth-kicker">VLEARN EVENT AI</span>
          <h1>
            Một nơi để tìm sự kiện,
            <br />
            hỏi đáp linh hoạt và lên lịch nhắc nhanh.
          </h1>
          <p>
            Đăng nhập để dùng trợ lý sự kiện VLearn. Bạn có thể tìm workshop,
            hỏi deadline đăng ký, trò chuyện tự nhiên và thử luồng đăng ký hoặc
            nhắc lịch ngay trong demo.
          </p>
          <div className="auth-points">
            <span>Tìm sự kiện theo ngôn ngữ tự nhiên</span>
            <span>Hỏi đáp linh hoạt bằng AI</span>
            <span>Thử flow đăng ký và lên lịch nhắc</span>
          </div>
        </section>

        <section className="auth-card" aria-label="Đăng nhập hoặc đăng ký">
          <div className="auth-tabs">
            <button
              className={authMode === "signin" ? "active" : ""}
              type="button"
              onClick={() => setAuthMode("signin")}
            >
              Đăng nhập
            </button>
            <button
              className={authMode === "signup" ? "active" : ""}
              type="button"
              onClick={() => setAuthMode("signup")}
            >
              Đăng ký
            </button>
          </div>

          <div className="auth-copy">
            <strong>
              {authMode === "signin"
                ? "Chào mừng bạn quay lại"
                : "Tạo tài khoản để bắt đầu"}
            </strong>
            <p>
              {authMode === "signin"
                ? "Đăng nhập để tiếp tục vào trợ lý sự kiện."
                : "Đăng ký nhanh để trải nghiệm bot và các flow demo."}
            </p>
          </div>

          <form className="auth-form" onSubmit={submitAuth}>
            {authMode === "signup" && (
              <label>
                <span>Họ và tên</span>
                <input
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              </label>
            )}
            <label>
              <span>Email</span>
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="ban@vlearn.edu.vn"
              />
            </label>
            <label>
              <span>Mật khẩu</span>
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Tối thiểu 6 ký tự"
              />
            </label>

            <button className="auth-submit" type="submit">
              {authMode === "signin" ? "Vào hệ thống" : "Tạo tài khoản"}
            </button>
          </form>

          <div className="auth-divider">
            <span>hoặc</span>
          </div>

          <button className="auth-demo" type="button" onClick={loginDemo}>
            Đăng nhập demo
            <small>Email: demo@vlearn.local · Mật khẩu: demo123</small>
          </button>
        </section>
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Điều hướng chính">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <strong>VLearn Event AI</strong>
            <span>Event Assistant</span>
          </div>
        </div>

        <nav>
          <p className="nav-heading">CHÍNH</p>
          {navItems.map((item) => (
            <button
              className={`nav-item ${active === item.label ? "active" : ""}`}
              key={item.label}
              onClick={() => setActive(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && unreadCount > 0 && <b className="badge">{unreadCount}</b>}
            </button>
          ))}
        </nav>

        <section className="history-panel" aria-label="Lịch sử trò chuyện">
          <div className="history-heading">
            <span>ĐOẠN CHAT</span>
            <button
              type="button"
              aria-label="Tạo cuộc trò chuyện mới"
              onClick={() => {
                newConversation();
                setActive("Trợ lý sự kiện");
              }}
            >
              +
            </button>
          </div>

          <div className="history-list">
            {!historyReady && <p className="history-empty">Đang tải lịch sử…</p>}
            {historyReady &&
              conversations.map((conversation) => (
                <div
                  className={`history-item ${activeId === conversation.id ? "active" : ""}`}
                  key={conversation.id}
                >
                  <button
                    className="history-open"
                    type="button"
                    onClick={() => {
                      selectConversation(conversation.id);
                      setActive("Trợ lý sự kiện");
                    }}
                  >
                    <span>◌</span>
                    <span>
                      <strong>{conversation.title}</strong>
                      <small>
                        {conversation.messages.length
                          ? `${conversation.messages.length} tin nhắn`
                          : "Chưa có tin nhắn"}
                      </small>
                    </span>
                  </button>
                  <button
                    className="history-delete"
                    type="button"
                    aria-label={`Xóa ${conversation.title}`}
                    onClick={() => deleteConversation(conversation.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
          </div>
          <small className="history-storage">Được lưu tự động</small>
        </section>

        <div className="profile-card">
          <div className="avatar">HQ</div>
          <div>
            <strong>{currentUser?.name ?? "Huy Quốc"}</strong>
            <span>{currentUser?.role ?? "Sinh viên năm nhất"}</span>
          </div>
          <button className="logout-button" type="button" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{pageCopy[active].title}</h1>
            <p>{pageCopy[active].subtitle}</p>
          </div>
          <div className="topbar-actions">
            <button className="logout-chip" type="button" onClick={logout}>
              {currentUser?.email ?? "Đăng xuất"}
            </button>
            {active === "Trợ lý sự kiện" && (
              <button className="new-chat-button" type="button" onClick={newConversation}>
                <span>＋</span> Chat mới
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Mở trang thông báo"
              onClick={() => setActive("Thông báo")}
            >
              🔔{unreadCount > 0 && <i>{unreadCount}</i>}
            </button>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Điều hướng trên thiết bị di động">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={active === item.label ? "active" : ""}
              onClick={() => setActive(item.label)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {active === "Trợ lý sự kiện" && (
          <section className="assistant-page" aria-label="Hội thoại trợ lý sự kiện">
            <div className="mobile-history-bar" aria-label="Chuyển cuộc trò chuyện">
              <span>Lịch sử</span>
              <div>
                {conversations.map((conversation) => (
                  <button
                    className={activeId === conversation.id ? "active" : ""}
                    key={conversation.id}
                    type="button"
                    onClick={() => selectConversation(conversation.id)}
                  >
                    {conversation.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="chat-stage">
              <div
                className={`chat-scroll ${activeConversation?.messages.length ? "has-messages" : ""}`}
                ref={chatScrollRef}
                aria-live="polite"
                aria-busy={loading}
              >
                {!activeConversation?.messages.length && (
                  <div className="chat-empty">
                    <div className="empty-bot-avatar">✦</div>
                    <span className="empty-kicker">VLEARN EVENT AI</span>
                    <h2>Hôm nay bạn muốn tìm sự kiện gì?</h2>
                    <p>
                      Hỏi bằng ngôn ngữ tự nhiên. Mình sẽ lọc theo thời gian,
                      chủ đề, chi phí và địa điểm.
                    </p>
                    <div className="capability-list">
                      <span>✓ Tìm sự kiện có căn cứ</span>
                      <span>✓ Cảnh báo thông tin mâu thuẫn</span>
                      <span>✓ Lưu lại từng cuộc trò chuyện</span>
                    </div>
                  </div>
                )}

                {activeConversation?.messages.map((message, messageIndex) => {
                  const isLast = messageIndex === activeConversation.messages.length - 1;
                  const isStreaming = loading && isLast && message.role === "assistant";

                  if (message.role === "user") {
                    return (
                      <div className="message-row user-row" key={message.id}>
                        <div className="message user-message">{message.content}</div>
                        <div className="user-avatar">HQ</div>
                      </div>
                    );
                  }

                  return (
                    <div className="message-row assistant-row" key={message.id}>
                      <div className="bot-avatar">✦</div>
                      <div
                        className={`message assistant-message result-message ${
                          message.error ? "error-message" : ""
                        }`}
                      >
                        {isStreaming && !message.content && (
                          <div className="stream-state">
                            <span className="typing-dots">
                              <i />
                              <i />
                              <i />
                            </span>
                            <span>{streamStatus || "Đang suy nghĩ…"}</span>
                          </div>
                        )}

                        {message.content && (
                          <div className="assistant-copy">
                            {message.content
                              .split("\n")
                              .filter(Boolean)
                              .map((paragraph, index) => (
                                <p key={`${message.id}-${index}`}>{paragraph}</p>
                              ))}
                            {isStreaming && <span className="stream-caret" />}
                          </div>
                        )}

                        {!!message.suggestedActions?.length && !!message.events.length && (
                          <div className="suggestion-row" aria-label="Hành động gợi ý">
                            {message.suggestedActions.map((action) => (
                              <button
                                key={`${message.id}-${action}`}
                                type="button"
                                onClick={() => runSuggestedAction(action, message.events[0])}
                              >
                                {action === "register_event"
                                  ? "Đăng ký sự kiện đầu tiên"
                                  : "Lên lịch nhắc"}
                              </button>
                            ))}
                          </div>
                        )}

                        {message.warnings.map((warning, index) => (
                          <div
                            key={`${message.id}-warning-${index}`}
                            className="warning-banner"
                          >
                            <span>!</span>
                            <p>{warning}</p>
                          </div>
                        ))}

                        {!!message.events.length && (
                          <div className="event-results-grid">
                            {message.events.map((event) => (
                              <article key={event.id} className="event-result">
                                <div className="event-card-head">
                                  <span className="result-category">
                                    {(event.topics[0] || "Sự kiện").toUpperCase()}
                                  </span>
                                  <span
                                    className={`event-status ${
                                      event.status === "needs_confirmation" ? "warning" : ""
                                    }`}
                                  >
                                    {event.status === "needs_confirmation"
                                      ? "Cần xác nhận"
                                      : "Đang mở"}
                                  </span>
                                </div>
                                <h3>{event.title}</h3>
                                <dl className="event-facts">
                                  <div>
                                    <dt>Thời gian</dt>
                                    <dd>{formatEventDate(event.starts_at)}</dd>
                                  </div>
                                  <div>
                                    <dt>Địa điểm</dt>
                                    <dd>{event.location || "Chưa rõ địa điểm"}</dd>
                                  </div>
                                  <div>
                                    <dt>Đăng ký</dt>
                                    <dd>{formatDeadline(event)}</dd>
                                  </div>
                                  {event.organizer && (
                                    <div>
                                      <dt>Đơn vị</dt>
                                      <dd>{event.organizer}</dd>
                                    </div>
                                  )}
                                </dl>
                                <div className="result-actions">
                                  <button
                                    className="primary-button"
                                    onClick={() => void askToRegister(event)}
                                  >
                                    Đăng ký
                                  </button>
                                  <button
                                    className="secondary-button"
                                    onClick={() => void askToRemind(event)}
                                  >
                                    {remindedEvents.includes(event.id)
                                      ? "✓ Đã lên lịch nhắc"
                                      : "Lên lịch nhắc"}
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="composer-zone">
                <div className="suggestion-row" aria-label="Gợi ý câu hỏi">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      disabled={loading}
                      onClick={() => void ask(suggestion)}
                    >
                      ✦ {suggestion}
                    </button>
                  ))}
                </div>

                <form className="composer" onSubmit={submit}>
                  <input
                    aria-label="Nhập câu hỏi về sự kiện"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Hỏi về một sự kiện..."
                  />
                  <button aria-label="Gửi câu hỏi" disabled={loading}>
                    ↑
                  </button>
                </form>

                <div className="composer-meta">
                  <small>Dữ liệu sự kiện minh hoạ · AI có thể hỏi lại khi chưa đủ thông tin</small>
                  <small>{loading ? streamStatus : "Lịch sử được lưu tự động"}</small>
                </div>
              </div>
            </div>
          </section>
        )}

        {active === "Thông báo" && (
          <section className="page-content notifications-page">
            <div className="page-toolbar">
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    const response = await fetch(`${getApiBaseUrl()}/api/notifications/read`, {
                      method: "POST",
                    });
                    if (!response.ok) {
                      throw new Error("mark_read_failed");
                    }
                    setReadNotices(notices.map((item) => item.id));
                    notify("Đã đánh dấu tất cả là đã đọc");
                  } catch {
                    notify("Lỗi kết nối");
                  }
                }}
              >
                Đánh dấu đã đọc
              </button>
            </div>

            <section className="notification-board">
              <div className="section-title">
                <div>
                  <h2>Gần đây</h2>
                  <p>{unreadCount} thông báo chưa đọc</p>
                </div>
              </div>

              <div className="notification-list full-list">
                {notices.map((notice) => {
                  const isRead = readNotices.includes(notice.id);
                  return (
                    <button
                      className={`notification-item ${isRead ? "read" : ""}`}
                      key={notice.id}
                      onClick={() =>
                        setReadNotices((current) =>
                          current.includes(notice.id) ? current : [...current, notice.id],
                        )
                      }
                    >
                      <span className={`notice-icon ${notice.tone}`}>{notice.icon}</span>
                      <span className="notice-copy">
                        <span className="notice-meta">{notice.category}</span>
                        <strong>
                          {notice.title}
                          {!isRead && <i />}
                        </strong>
                        <small>{notice.text}</small>
                      </span>
                      <time>{notice.time}</time>
                      <span className="notice-arrow">›</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </section>
        )}

        {active === "Lịch của tôi" && (
          <section className="page-content calendar-page">
            <section className="calendar-card">
              <div className="calendar-head">
                <div>
                  <h2>{monthLabel}</h2>
                  <p>{monthOffset === 0 ? `${myEvents.length} sự kiện trong tháng` : "Chưa có sự kiện"}</p>
                </div>
                <div className="calendar-controls">
                  <button
                    aria-label="Tháng trước"
                    disabled={monthOffset === -1}
                    onClick={() => setMonthOffset((value) => value - 1)}
                  >
                    ‹
                  </button>
                  <button onClick={() => setMonthOffset(0)}>Hôm nay</button>
                  <button
                    aria-label="Tháng sau"
                    disabled={monthOffset === 1}
                    onClick={() => setMonthOffset((value) => value + 1)}
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="calendar-grid calendar-weekdays">
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="calendar-grid calendar-days">
                {Array.from({ length: 35 }, (_, index) => {
                  const day = index - 4;
                  const event =
                    monthOffset === 0 ? myEvents.find((item) => item.day === day) : undefined;
                  return (
                    <button
                      key={index}
                      className={`${day === 31 && monthOffset === -1 ? "today" : ""} ${
                        event ? "has-event" : ""
                      }`}
                      disabled={day < 1 || day > 31}
                      onClick={() => event && setDetail(event)}
                    >
                      <span>{day > 0 && day <= 31 ? day : ""}</span>
                      {event && (
                        <i
                          className={`event-dot dot-${event.category
                            .toLowerCase()
                            .replace("ỹ", "y")
                            .replace("ệ", "e")}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="agenda-card">
              <div className="section-title">
                <div>
                  <h2>Sắp tới</h2>
                  <p>Các sự kiện đã thêm vào lịch</p>
                </div>
              </div>
              <div className="agenda-list">
                {(monthOffset === 0 ? myEvents : []).map((event) => (
                  <button
                    className="agenda-item"
                    key={event.id}
                    onClick={() => setDetail(event)}
                  >
                    <span className="agenda-date">
                      <b>{event.day.toString().padStart(2, "0")}</b>
                      <small>THÁNG 8</small>
                    </span>
                    <span className="agenda-copy">
                      <small>{event.time} · {event.category}</small>
                      <strong>{event.title}</strong>
                      <span>{event.place}</span>
                    </span>
                    <span className="notice-arrow">›</span>
                  </button>
                ))}
                {monthOffset !== 0 && (
                  <div className="empty-state">
                    <span>▫</span>
                    <strong>Chưa có sự kiện</strong>
                    <p>Các sự kiện bạn thêm sẽ xuất hiện tại đây.</p>
                  </div>
                )}
              </div>
            </aside>
          </section>
        )}
      </section>

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <section
            className="event-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Đóng"
              onClick={() => setDetail(null)}
            >
              ×
            </button>
            <span className="modal-kicker">
              {detail.category.toUpperCase()} · {detail.date}
            </span>
            <h2 id="event-title">{detail.title}</h2>
            <p>
              {detail.time} · {detail.place}
            </p>
            <div className="detail-grid">
              <div>
                <span>Đơn vị tổ chức</span>
                <strong>{detail.organizer}</strong>
              </div>
              <div>
                <span>Trạng thái</span>
                <strong>{detail.status}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="primary-button"
                onClick={() =>
                  notify("Hãy dùng nút Đăng ký trên thẻ sự kiện trong cuộc chat để bot hỗ trợ tiếp")
                }
              >
                Đăng ký
              </button>
              <button
                className="secondary-button"
                onClick={() =>
                  notify("Hãy dùng nút Lên lịch nhắc trên thẻ sự kiện trong cuộc chat để bot hỗ trợ tiếp")
                }
              >
                Lên lịch nhắc
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
