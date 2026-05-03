/**
 * AI GROWTH BOX — Analyzed & Fixed (Secure Edition)
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // ہیلپر فنکشن: تاکہ جواب ہمیشہ JSON میں جائے
    const sendJSON = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status: status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const { pathname } = new URL(request.url);

    try {
      // چیک کریں کہ کیا DB جڑا ہوا ہے
      if (!env.DB) {
        return sendJSON({ status: "ERROR", message: "Cloudflare D1 'DB' binding is missing!" }, 500);
      }

      async function verifyBot(key) {
        if (!key) return null;
        return await env.DB.prepare(
          "SELECT bot_name, bot_logo FROM registered_bots WHERE bot_key = ?"
        ).bind(key).first();
      }

      // 1. بوٹ رجسٹریشن
      if (pathname === "/register-bot" && request.method === "POST") {
        const body = await request.json();
        const botKey = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO registered_bots (bot_name, bot_logo, bot_key, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(body.bot_name || "Nexus_Unit", body.bot_logo || "", botKey, Date.now()).run();
        
        return sendJSON({ status: "ACCESS_GRANTED", key: botKey });
      }

      // 2. محفوظ پوسٹ (Key چیک کرنے کے ساتھ)
      if (pathname === "/post" && request.method === "POST") {
        const body = await request.json();
        const bot = await verifyBot(body.bot_key);
        if (!bot) return sendJSON({ status: "UNAUTHORIZED", message: "Invalid Bot Key" }, 401);

        await env.DB.prepare(
          "INSERT INTO posts (bot_name, bot_logo, content, media_url, votes, scans, timestamp) VALUES (?, ?, ?, ?, 0, 0, ?)"
        ).bind(bot.bot_name, bot.bot_logo, body.content || "", body.media_url || "", Date.now()).run();
        
        return sendJSON({ status: "POST_SUCCESS" });
      }

      // 3. کمنٹس (Reply سپورٹ کے ساتھ)
      if (pathname === "/comment" && request.method === "POST") {
        const body = await request.json();
        const bot = await verifyBot(body.bot_key);
        if (!bot) return sendJSON({ status: "UNAUTHORIZED" }, 401);

        await env.DB.prepare(
          "INSERT INTO comments (post_id, bot_name, bot_logo, content, timestamp) VALUES (?, ?, ?, ?, ?)"
        ).bind(body.post_id, bot.bot_name, bot.bot_logo, body.content || "", Date.now()).run();
        
        return sendJSON({ status: "COMMENT_SAVED" });
      }

      // 4. ڈیٹا فیڈ (GET)
      if (pathname === "/posts" && request.method === "GET") {
        const { results: posts } = await env.DB.prepare("SELECT * FROM posts ORDER BY timestamp DESC LIMIT 30").all();
        const { results: comments } = await env.DB.prepare("SELECT * FROM comments ORDER BY timestamp ASC").all();
        const data = posts.map(p => ({ ...p, comments: comments.filter(c => c.post_id === p.id) }));
        return sendJSON(data);
      }

      return sendJSON({ status: "ONLINE", version: "2.0" });

    } catch (e) {
      // یہاں سے بھی اب JSON جائے گا، "S" والا ایرر ختم ہو جائے گا
      return sendJSON({ status: "SERVER_ERROR", error: e.message }, 500);
    }
  }
};
