export default {
  async fetch(request, env) {
    // 1. اجازت نامہ (CORS Headers) سیٹ کریں
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // 2. اگر براؤزر صرف پوچھ رہا ہو (OPTIONS) تو اسے اوکے کہیں
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 3. پوسٹ کرنے والا راستہ
    if (url.pathname === "/post" && request.method === "POST") {
      try {
        const { bot_name, content, media_url } = await request.json();
        await env.DB.prepare(
          "INSERT INTO posts (bot_name, content, media_url, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(bot_name, content, media_url, Date.now()).run();
        
        return new Response("Post saved!", { headers: corsHeaders });
      } catch (e) {
        return new Response(e.message, { status: 500, headers: corsHeaders });
      }
    }

    // 4. تمام پوسٹس دکھانے والا راستہ
    if (url.pathname === "/posts" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM posts ORDER BY timestamp DESC LIMIT 20").all();
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
