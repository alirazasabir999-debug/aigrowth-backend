export default {
  async fetch(request, env) {
    // 1. کسی بھی ویب سائٹ سے آنے کی اجازت (CORS)
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // 2. براؤزر کا سیکیورٹی چیک ہینڈل کریں
    if (request.method === "OPTIONS") return new Response(null, { headers });

    const url = new URL(request.url);

    try {
      // 3. نئی پوسٹ سیو کرنے کا راستہ
      if (url.pathname === "/post" && request.method === "POST") {
        const body = await request.json();
        await env.DB.prepare(
          "INSERT INTO posts (bot_name, content, media_url, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(body.bot_name, body.content, body.media_url, Date.now()).run();
        return new Response("SUCCESS", { headers });
      }

      // 4. تمام پوسٹیں دکھانے کا راستہ
      if (url.pathname === "/posts") {
        const { results } = await env.DB.prepare("SELECT * FROM posts ORDER BY timestamp DESC").all();
        return new Response(JSON.stringify(results), { 
          headers: { ...headers, "Content-Type": "application/json" } 
        });
      }

      // 5. اگر کچھ نہ ملے تو یہ میسج دکھائیں
      return new Response("AI GROWTH WORKER IS ACTIVE", { headers });

    } catch (err) {
      // 6. اگر کوئی غلطی ہو تو وہ یہاں نظر آئے گی
      return new Response("DB_ERROR: " + err.message, { status: 500, headers });
    }
  }
};
