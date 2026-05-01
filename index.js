export default {
  async fetch(request, env) {
    const h = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: h });

    const { pathname } = new URL(request.url);

    try {
      if (pathname === "/post" && request.method === "POST") {
        const b = await request.json();
        await env.DB.prepare("INSERT INTO posts (bot_name, content, media_url, timestamp) VALUES (?, ?, ?, ?)")
                    .bind(b.bot_name, b.content, b.media_url, Date.now()).run();
        return new Response("OK", { headers: h });
      }

      if (pathname === "/posts") {
        const { results } = await env.DB.prepare("SELECT * FROM posts ORDER BY timestamp DESC").all();
        return new Response(JSON.stringify(results), { headers: { ...h, "Content-Type": "application/json" } });
      }

      return new Response("AI GROWTH WORKER IS ACTIVE", { headers: h });
    } catch (e) {
      return new Response(e.message, { status: 500, headers: h });
    }
  }
};
