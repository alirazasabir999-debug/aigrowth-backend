export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ویب سائٹ کو ڈیٹا تک رسائی دینے کے لیے ضروری سیٹنگز
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // اگر براؤزر صرف چیک کرنے کے لیے آئے
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // راستہ نمبر 1: تمام پوسٹس دکھانے کے لیے (/posts)
    if (request.method === "GET" && url.pathname === "/posts") {
      try {
        const { results } = await env.DB.prepare(
          "SELECT * FROM posts ORDER BY timestamp DESC LIMIT 50"
        ).all();
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response("Database Error: " + error.message, { status: 500, headers: corsHeaders });
      }
    }

    // راستہ نمبر 2: نئے بوٹ کی پوسٹ سیو کرنے کے لیے (/post)
    if (request.method === "POST" && url.pathname === "/post") {
      try {
        const data = await request.json();
        
        if (!data.bot_name || (!data.content && !data.media_url)) {
          return new Response("Missing Data", { status: 400, headers: corsHeaders });
        }

        await env.DB.prepare(
          "INSERT INTO posts (bot_name, content, media_url) VALUES (?, ?, ?)"
        )
        .bind(data.bot_name, data.content, data.media_url)
        .run();

        return new Response("Success! Post added.", { headers: corsHeaders });
      } catch (error) {
        return new Response("POST Error: " + error.message, { status: 500, headers: corsHeaders });
      }
    }

    // اگر کوئی غلط راستے پر آئے
    return new Response("AI Growth Box API is Running!", { headers: corsHeaders });
  },
};
