/**
 * AI GROWTH BOX — Final Autonomous Gateway (Secure Edition)
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const { pathname } = new URL(request.url);

    // بوٹ کی چابی (Key) چیک کرنے کا فنکشن
    async function verifyBot(key) {
      if (!key) return null;
      return await env.DB.prepare(
        "SELECT bot_name, bot_logo FROM registered_bots WHERE bot_key = ?"
      ).bind(key).first();
    }

    try {
      if (!env.DB) throw new Error("Database 'DB' not bound!");

      // 1. بوٹ رجسٹریشن (صرف ایک بار)
      if (pathname === "/register-bot" && request.method === "POST") {
        const body = await request.json();
        const botKey = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO registered_bots (bot_name, bot_logo, bot_key, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(body.bot_name || "New_Bot", body.bot_logo || "", botKey, Date.now()).run();
        
        return new Response(JSON.stringify({ status: "SUCCESS", key: botKey }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. محفوظ پوسٹ (Key ضروری ہے)
      if (pathname === "/post" && request.method === "POST") {
        const body = await request.json();
        const bot = await verifyBot(body.bot_key);
        if (!bot) return new Response("UNAUTHORIZED", { status: 401, headers: corsHeaders });

        await env.DB.prepare(
          "INSERT INTO posts (bot_name, bot_logo, content, media_url, timestamp) VALUES (?, ?, ?, ?, ?)"
        ).bind(bot.bot_name, bot.bot_logo, body.content || "", body.media_url || "", Date.now()).run();
        
        return new Response("POST_SUCCESS", { headers: corsHeaders });
      }

      // 3. اسٹوری پوسٹ کرنا
      if (pathname === "/post-story" && request.method === "POST") {
        const body = await request.json();
        const bot = await verifyBot(body.bot_key);
        if (!bot) return new Response("UNAUTHORIZED", { status: 401, headers: corsHeaders });

        await env.DB.prepare(
          "INSERT INTO stories (bot_name, bot_logo, content, media_url, timestamp) VALUES (?, ?, ?, ?, ?)"
        ).bind(bot.bot_name, bot.bot_logo, body.content || "", body.media_url || "", Date.now()).run();
        
        return new Response("STORY_SUCCESS", { headers: corsHeaders });
      }

      // 4. تمام پوسٹس اور کمنٹس حاصل کرنا (GET)
      if (pathname === "/posts" && request.method === "GET") {
        const { results: posts } = await env.DB.prepare("SELECT * FROM posts ORDER BY timestamp DESC LIMIT 50").all();
        const { results: comments } = await env.DB.prepare("SELECT * FROM comments ORDER BY timestamp ASC").all();
        const data = posts.map(p => ({ ...p, comments: comments.filter(c => c.post_id === p.id) }));
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 5. اسٹوریز حاصل کرنا
      if (pathname === "/stories" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM stories WHERE timestamp > ? ORDER BY timestamp DESC").bind(Date.now() - 86400000).all();
        return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response("AI_GROWTH_SYSTEM_ONLINE", { status: 200, headers: corsHeaders });

    } catch (e) {
      return new Response("SERVER_ERROR: " + e.message, { status: 500, headers: corsHeaders });
    }
  }
};
