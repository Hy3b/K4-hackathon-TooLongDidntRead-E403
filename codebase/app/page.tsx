"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ChatEvent, useChatHistory } from "./use-chat-history";

type PageName = "Trợ lý sự kiện" | "Thông báo" | "Lịch của tôi";
type EventItem = {
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
  id: number;
  icon: string;
  tone: string;
  title: string;
  text: string;
  time: string;
  category: "Deadline" | "Thay đổi" | "Gợi ý" | "Nhắc lịch";
};

const navItems: { icon: string; label: PageName; badge?: number }[] = [
  { icon: "✦", label: "Trợ lý sự kiện" },
  { icon: "🔔", label: "Thông báo", badge: 3 },
  { icon: "▦", label: "Lịch của tôi" },
];

const suggestions = [
  "Cuối tuần này có workshop nào?",
  "Sự kiện nào sắp hết hạn?",
  "Có sự kiện miễn phí hôm nay không?",
];

const categoryMap: Record<string, string> = {
  technology: "Công nghệ",
  career: "Kỹ năng",
  skills: "Kỹ năng",
  learning: "Học tập",
  community: "Cộng đồng",
};

function formatEventStatus(event: any): string {
  if (event.status === "cancelled") return "Đã hủy";
  if (event.status === "needs_confirmation") return "Cần xác nhận";
  if (event.registration_deadline) {
    const deadline = new Date(event.registration_deadline);
    const now = new Date();
    const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 3600);
    if (diffHours > 0 && diffHours < 48) {
      return `Còn ${Math.ceil(diffHours / 24)} ngày đăng ký`;
    }
  }
  return "Đang mở";
}

function mapRawToEventItems(rawItems: any[]): EventItem[] {
  return rawItems
    .filter((e) => e.status !== "cancelled")
    .map((e) => {
      const dt = new Date(e.starts_at);
      const day = dt.getDate();
      const monthStr = String(dt.getMonth() + 1).padStart(2, "0");
      const dateStr = `${String(day).padStart(2, "0")}/${monthStr}/${dt.getFullYear()}`;
      const timeStr = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
      const topicKey = (e.topics && e.topics[0]) || "technology";
      const category = categoryMap[topicKey] || "Công nghệ";

      return {
        title: e.title,
        date: dateStr,
        day: day,
        time: timeStr,
        place: e.location || "Chưa rõ địa điểm",
        organizer: e.organizer || "Đang cập nhật",
        category: category,
        status: formatEventStatus(e),
      };
    });
}

function mapRawToNotices(rawItems: any[]): NoticeItem[] {
  const noticesList: NoticeItem[] = [];
  let idCounter = 1;

  for (const item of rawItems) {
    if (item.status === "needs_confirmation") {
      noticesList.push({
        id: idCounter++,
        icon: "⚠",
        tone: "red",
        title: `Lịch sự kiện mâu thuẫn`,
        text: `Sự kiện "${item.title}" có mâu thuẫn giờ cần xác nhận.`,
        time: "Mới nhất",
        category: "Thay đổi",
      });
    } else if (item.status === "cancelled") {
      noticesList.push({
        id: idCounter++,
        icon: "⚠",
        tone: "red",
        title: `Sự kiện bị hủy`,
        text: `Buổi "${item.title}" do ${item.organizer} tổ chức đã bị hủy.`,
        time: "Gần đây",
        category: "Thay đổi",
      });
    } else if (item.registration_deadline) {
      const deadline = new Date(item.registration_deadline);
      const now = new Date();
      const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 3600);
      if (diffHours > 0 && diffHours < 72) {
        noticesList.push({
          id: idCounter++,
          icon: "⌛",
          tone: "yellow",
          title: `Hạn đăng ký: ${item.title}`,
          text: `Deadline đăng ký: ${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(deadline)}.`,
          time: `${Math.round(diffHours)} giờ nữa`,
          category: "Deadline",
        });
      }
    }

    if (item.status === "published" && (item.topics?.includes("technology") || item.topics?.includes("skills"))) {
      if (noticesList.length < 8) {
        noticesList.push({
          id: idCounter++,
          icon: "✦",
          tone: "blue",
          title: "Sự kiện mới phù hợp",
          text: `${item.title} (${item.organizer}) phù hợp với quan tâm của bạn.`,
          time: "Gợi ý mới",
          category: "Gợi ý",
        });
      }
    }
  }

  return noticesList.slice(0, 8);
}

const initialEvents: EventItem[] = [];

const initialNotices: NoticeItem[] = [];

const pageCopy: Record<PageName, { title: string; subtitle: string }> = {
  "Trợ lý sự kiện": { title: "Trợ lý sự kiện VLearn", subtitle: "Hỏi về workshop, hoạt động và deadline đăng ký." },
  "Thông báo": { title: "Thông báo", subtitle: "Theo dõi deadline, cập nhật và lời nhắc sự kiện." },
  "Lịch của tôi": { title: "Lịch của tôi", subtitle: "Xem toàn bộ sự kiện và lời nhắc theo thời gian." },
};

export default function Home() {
  const [active, setActive] = useState<PageName>("Trợ lý sự kiện");
  const [query, setQuery] = useState("");
  const [remindedEvents, setRemindedEvents] = useState<string[]>([]);
  const [detail, setDetail] = useState<EventItem | null>(null);
  const [toast, setToast] = useState("");
  const [noticeFilter, setNoticeFilter] = useState("Tất cả");
  const [readNotices, setReadNotices] = useState<number[]>([4]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [notices, setNotices] = useState<NoticeItem[]>(initialNotices);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    fetch(`${baseUrl}/api/events`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
          setEvents(mapRawToEventItems(data.items));
          setNotices(mapRawToNotices(data.items));
        }
      })
      .catch(() => {});
  }, []);


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
    clearActiveMessages,
  } = useChatHistory();

  const filteredNotices = noticeFilter === "Tất cả" ? notices : notices.filter((item) => item.category === noticeFilter);
  const monthLabels = ["Tháng 7, 2026", "Tháng 8, 2026", "Tháng 9, 2026"];
  const monthLabel = monthLabels[monthOffset + 1];

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

  function navigate(page: PageName) {
    setActive(page);
  }

  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeConversation?.messages, loading]);

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

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Điều hướng chính">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div><strong>VLearn Event AI</strong><span>Event Assistant</span></div>
        </div>
        <nav>
          <p className="nav-heading">CHÍNH</p>
          {navItems.map((item) => (
            <button className={`nav-item ${active === item.label ? "active" : ""}`} key={item.label} onClick={() => navigate(item.label)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && <b className="badge">{Math.max(0, notices.length - readNotices.length)}</b>}
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
                navigate("Trợ lý sự kiện");
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
                  className={`history-item ${
                    activeId === conversation.id ? "active" : ""
                  }`}
                  key={conversation.id}
                >
                  <button
                    className="history-open"
                    type="button"
                    onClick={() => {
                      selectConversation(conversation.id);
                      navigate("Trợ lý sự kiện");
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
          <div><strong>Huy Quốc</strong><span>Sinh viên năm nhất</span></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><h1>{pageCopy[active].title}</h1><p>{pageCopy[active].subtitle}</p></div>
          <div className="topbar-actions">
            {active === "Trợ lý sự kiện" && (
              <button
                className="new-chat-button"
                type="button"
                onClick={newConversation}
              >
                <span>＋</span> Chat mới
              </button>
            )}
            <button className="icon-button" aria-label="Mở trang thông báo" onClick={() => navigate("Thông báo")}>🔔<i>{Math.max(0, notices.length - readNotices.length)}</i></button>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Điều hướng trên thiết bị di động">
          {navItems.map((item) => <button key={item.label} className={active === item.label ? "active" : ""} onClick={() => navigate(item.label)}><span>{item.icon}</span>{item.label}</button>)}
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
                className={`chat-scroll ${
                  activeConversation?.messages.length ? "has-messages" : ""
                }`}
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
                  const isLast =
                    messageIndex === activeConversation.messages.length - 1;
                  const isStreaming =
                    loading && isLast && message.role === "assistant";

                  if (message.role === "user") {
                    return (
                      <div className="message-row user-row" key={message.id}>
                        <div className="message user-message">
                          {message.content}
                        </div>
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

                        {message.activities && message.activities.length > 0 && (
                          <div className="activity-timeline">
                            {message.activities.map((activity) => {
                              if (activity.type === "tool_call") {
                                return (
                                  <details key={activity.id} className="tool-card">
                                    <summary>
                                      <div className="tool-card-header">
                                        <span className="tool-icon">🛠</span>
                                        <span className="tool-name">Gọi công cụ: {activity.name}</span>
                                        {activity.duration != null && <span className="tool-duration">{activity.duration}ms</span>}
                                      </div>
                                    </summary>
                                    <div className="tool-card-body">
                                      <div className="tool-section">
                                        <strong>Input</strong>
                                        <pre><code>{JSON.stringify(activity.input, null, 2)}</code></pre>
                                      </div>
                                      <div className="tool-section">
                                        <strong>Output</strong>
                                        <pre><code>{activity.output}</code></pre>
                                      </div>
                                    </div>
                                  </details>
                                );
                              }
                              
                              return (
                                <div key={activity.id} className="activity-item">
                                  <span className="activity-dot"></span>
                                  <div className="activity-content">
                                    <span className="activity-title">{activity.title}</span>
                                    {activity.details && <span className="activity-details">{activity.details}</span>}
                                    {activity.duration != null && <span className="activity-duration">{activity.duration}ms</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {message.content && (
                          <div className="assistant-copy">
                            {message.content
                              .split("\n")
                              .filter(Boolean)
                              .map((paragraph, index) => (
                                <p key={`${message.id}-${index}`}>
                                  {paragraph}
                                </p>
                              ))}
                            {isStreaming && <span className="stream-caret" />}
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
                                      event.status === "needs_confirmation"
                                        ? "warning"
                                        : ""
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
                                    <dd>
                                      {event.location || "Chưa rõ địa điểm"}
                                    </dd>
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
                                    onClick={() => {
                                      setRemindedEvents((current) =>
                                        current.includes(event.id)
                                          ? current
                                          : [...current, event.id],
                                      );
                                      notify("Đã tạo lời nhắc (Mock)");
                                    }}
                                  >
                                    {remindedEvents.includes(event.id)
                                      ? "✓ Đã tạo lời nhắc"
                                      : "Tạo lời nhắc"}
                                  </button>
                                  <button
                                    className="secondary-button"
                                    onClick={() =>
                                      notify("Đang mở thông tin sự kiện")
                                    }
                                  >
                                    Chi tiết
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
                  {suggestions.map((suggestion) => <button key={suggestion} disabled={loading} onClick={() => void ask(suggestion)}>✦ {suggestion}</button>)}
                </div>
                <form className="composer" onSubmit={submit}>
                  <input aria-label="Nhập câu hỏi về sự kiện" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hỏi về một sự kiện..." />
                  <button aria-label="Gửi câu hỏi" disabled={loading}>↑</button>
                </form>
                <div className="composer-meta">
                  <small>
                    Bộ nhớ Session: {activeConversation?.messages.filter((m) => m.role === "user").length || 0}/4 câu hỏi {((activeConversation?.messages.filter((m) => m.role === "user").length) || 0) >= 4 ? "• Tự động reset ở câu tới" : ""}
                  </small>
                  <small>{loading ? streamStatus : "Lịch sử được lưu tự động"}</small>
                </div>
              </div>
            </div>
          </section>
        )}

        {active === "Thông báo" && (
          <section className="page-content notifications-page">
            <div className="page-toolbar">
              <div className="filter-tabs" role="tablist">
                {["Tất cả", "Deadline", "Thay đổi", "Gợi ý"].map((filter) => <button role="tab" aria-selected={noticeFilter === filter} className={noticeFilter === filter ? "active" : ""} key={filter} onClick={() => setNoticeFilter(filter)}>{filter}</button>)}
              </div>
              <button className="text-button" onClick={() => { setReadNotices(notices.map((item) => item.id)); notify("Đã đánh dấu tất cả là đã đọc"); }}>Đánh dấu đã đọc</button>
            </div>
            <section className="notification-board">
              <div className="section-title"><div><h2>Gần đây</h2><p>{notices.length - readNotices.length} thông báo chưa đọc</p></div></div>
              <div className="notification-list full-list">
                {filteredNotices.map((notice) => {
                  const isRead = readNotices.includes(notice.id);
                  return <button className={`notification-item ${isRead ? "read" : ""}`} key={notice.id} onClick={() => setReadNotices((current) => current.includes(notice.id) ? current : [...current, notice.id])}>
                    <span className={`notice-icon ${notice.tone}`}>{notice.icon}</span>
                    <span className="notice-copy"><span className="notice-meta">{notice.category}</span><strong>{notice.title}{!isRead && <i />}</strong><small>{notice.text}</small></span>
                    <time>{notice.time}</time>
                    <span className="notice-arrow">›</span>
                  </button>;
                })}
              </div>
            </section>
          </section>
        )}

        {active === "Lịch của tôi" && (
          <section className="page-content calendar-page">
            <section className="calendar-card">
              <div className="calendar-head">
                <div><h2>{monthLabel}</h2><p>{monthOffset === 0 ? "4 sự kiện trong tháng" : "Chưa có sự kiện"}</p></div>
                <div className="calendar-controls"><button aria-label="Tháng trước" disabled={monthOffset === -1} onClick={() => setMonthOffset((value) => value - 1)}>‹</button><button onClick={() => setMonthOffset(0)}>Hôm nay</button><button aria-label="Tháng sau" disabled={monthOffset === 1} onClick={() => setMonthOffset((value) => value + 1)}>›</button></div>
              </div>
              <div className="calendar-grid calendar-weekdays">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day}>{day}</span>)}</div>
              <div className="calendar-grid calendar-days">
                {Array.from({ length: 35 }, (_, index) => {
                  const day = index - 4;
                  const event = monthOffset === 0 ? events.find((item) => item.day === day) : undefined;
                  return <button key={index} className={`${day === 7 && monthOffset === 0 ? "today" : ""} ${event ? "has-event" : ""}`} disabled={day < 1 || day > 31} onClick={() => event && setDetail(event)}><span>{day > 0 && day <= 31 ? day : ""}</span>{event && <i className={`event-dot dot-${event.category.toLowerCase().replace("ỹ", "y").replace("ệ", "e")}`} />}</button>;
                })}
              </div>
            </section>

            <aside className="agenda-card">
              <div className="section-title"><div><h2>Sắp tới</h2><p>Các sự kiện đã thêm vào lịch</p></div><button onClick={() => notify("Đã mở chế độ thêm sự kiện")}>+ Thêm</button></div>
              <div className="agenda-list">
                {(monthOffset === 0 ? events : []).map((event) => <button className="agenda-item" key={event.title} onClick={() => setDetail(event)}><span className="agenda-date"><b>{event.day.toString().padStart(2, "0")}</b><small>THÁNG 8</small></span><span className="agenda-copy"><small>{event.time} · {event.category}</small><strong>{event.title}</strong><span>{event.place}</span></span><span className="notice-arrow">›</span></button>)}
                {monthOffset !== 0 && <div className="empty-state"><span>▦</span><strong>Chưa có sự kiện</strong><p>Các sự kiện bạn thêm sẽ xuất hiện tại đây.</p></div>}
              </div>
            </aside>
          </section>
        )}
      </section>

      {detail && <div className="modal-backdrop" onClick={() => setDetail(null)}><section className="event-modal" role="dialog" aria-modal="true" aria-labelledby="event-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={() => setDetail(null)}>×</button><span className="modal-kicker">{detail.category.toUpperCase()} · {detail.date}</span><h2 id="event-title">{detail.title}</h2><p>{detail.time} · {detail.place}</p><div className="detail-grid"><div><span>Đơn vị tổ chức</span><strong>{detail.organizer}</strong></div><div><span>Trạng thái</span><strong>{detail.status}</strong></div></div><div className="modal-actions"><button className="primary-button" onClick={() => { setRemindedEvents((current) => current.includes(detail.title) ? current : [...current, detail.title]); notify("Đã tạo lời nhắc trước sự kiện 24 giờ"); }}>{remindedEvents.includes(detail.title) ? "✓ Đã tạo lời nhắc" : "Tạo lời nhắc"}</button><button className="secondary-button" onClick={() => notify("Đang mở thông tin sự kiện")}>Xem thông tin</button></div></section></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
