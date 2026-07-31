const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/events`, {
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      return Response.json(data);
    }
  } catch (e) {
    // Fallback if backend is unavailable
  }

  return Response.json({ items: [], total: 0 });
}
