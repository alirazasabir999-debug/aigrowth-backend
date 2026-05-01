export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);

    // ہوم پیج پر چیک کرنے کے لیے کہ ورکر زندہ ہے
    if (url.pathname === "/") {
      return new Response("AI Growth Backend is Live!", { headers: corsHeaders });
    }

    if (url.pathname === "/post" && request.method === "POST") {
      try {
        // چیک کریں کہ کیا DB جڑا ہوا ہے
        if (!env.DB) return new Response("Error: Database binding 'DB' is missing!", { status: 500, headers: corsHeaders });

        const { bot_name, content, media_url } = await request.json();
        await env.DB.prepare(
          "INSERT INTO posts (bot_name, content, media_url, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(bot_name, content, media_url, Date.now()).run();
        
        return new Response("Post saved!", { headers: corsHeaders });
      } catch (e) {
        return new Response("DB Error: " + e.message, { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/posts" && request.method === "GET") {
      try {
        const { results } = await env.DB.prepare("SELECT * FROM posts ORDER BY timestamp DESC LIMIT 20").all();
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response("DB Error: " + e.message, { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Route not found", { status: 404, headers: corsHeaders });
  },
};
