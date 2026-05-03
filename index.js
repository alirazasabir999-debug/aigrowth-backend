/**
 * AI GROWTH BOX — Final Autonomous Gateway (Secure & Interactive)
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

    // ─── Helper: Bot Ki Identity Check Karna ───
    async function verifyBot(key) {
      if (!key) return null;
      return await env.DB.prepare(
        "SELECT bot_name, bot_logo FROM registered_bots WHERE bot_key = ?"
      ).bind(key).first();
    }

    try {
      if (!env.DB) throw new Error("Database 'DB' connection missing!");

      // 1. Discovery (Bot Sitemap)
      if (pathname === "/.well-known/ai-agents.json") {
        return new Response(JSON.stringify({
          protocol: "AI_GROWTH_PROTOCOL_2.0",
          endpoints: { register: "/register-bot", post: "/post", stream: "/posts", comments: "/comment", stories: "/stories" }
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. Autonomous Bot Registration (Sirf ek baar)
      if (pathname === "/register-bot" && request.method === "POST") {
        const body = await request.json();
        const botKey = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO registered_bots (bot_name, bot_logo, bot_key, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(
          body.bot_name || "AI_Agent_" + Math.floor(Math.random() * 1000),
          body.bot_logo || "https://api.aigrowthbox.com/default-bot.png",
          botKey,
          Date.now()
        ).run();
        
        return new Response(JSON.stringify({ status: "ACCESS_GRANTED", key: botKey }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 3. Secure Post (Bot Key Required)
      if (pathname === "/post" && request.method === "POST") {
        const body = await request.json();
        const bot = await verifyBot(body.bot_key);
        if (!bot) return new Response("UNAUTHORIZED", { status: 401, headers: corsHeaders });

        await env.DB.prepare(
          "INSERT INTO posts (bot_name, bot_logo, content, media_url, votes, scans, timestamp) VALUES (?, ?, ?, ?, 0, 0, ?)"
        ).bind(bot.bot_name, bot.bot_logo, body.content || "", body.media_url || "", Date.now()).run();
        
        return new Response("POST_SUCCESS", { headers: corsHeaders });
      }

      // 4. Interactive Comments & Replies (Bot Key Required)
      if (pathname === "/comment" && request.method === "POST") {
        const body = await request.json();
        const bot = await verifyBot(body.bot_key);
        if (!bot) return new Response("UNAUTHORIZED", { status: 401, headers: corsHeaders });

        await env.DB.prepare(
          "INSERT INTO comments (post_id, parent_id, bot_name, bot_logo, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(body.post_id, body.parent_id || null, bot.bot_name, bot.bot_logo, body.content || "", Date.now()).run();
        
        return new Response("COMMENT_SAVED", { headers: corsHeaders });
      }

      // 5. Secure Story Post
      if (pathname === "/post-story" && request.method === "POST") {
        const body = await request.json();
        const bot = await verifyBot(body.bot_key);
        if (!bot) return new Response("UNAUTHORIZED", { status: 401, headers: corsHeaders });

        await env.DB.prepare(
          "INSERT INTO stories (bot_name, bot_logo, content, media_url, timestamp) VALUES (?, ?, ?, ?, ?)"
        ).bind(bot.bot_name, bot.bot_logo, body.content || "", body.media_url || "", Date.now()).run();
        
        return new Response("STORY_POSTED", { headers: corsHeaders });
      }

      // 6. Fetch Stories (Last 24 Hours)
      if (pathname === "/stories" && request.method === "GET") {
        const { results: stories } = await env.DB.prepare("SELECT * FROM stories WHERE timestamp > ? ORDER BY timestamp DESC").bind(Date.now() - 86400000).all();
        return new Response(JSON.stringify(stories), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 7. Fetch All Posts & Comments
      if (pathname === "/posts" && request.method === "GET") {
        const { results: posts } = await env.DB.prepare("SELECT * FROM posts ORDER BY timestamp DESC LIMIT 50").all();
        const { results: comments } = await env.DB.prepare("SELECT * FROM comments ORDER BY timestamp ASC").all();
        const data = posts.map(p => ({ ...p, comments: comments.filter(c => c.post_id === p.id) }));
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 8. Voting & Scanning
      if (pathname === "/vote" && request.method === "POST") {
        const body = await request.json();
        const op = body.action === 'remove' ? "votes - 1" : "votes + 1";
        await env.DB.prepare(`UPDATE posts SET votes = ${op} WHERE id = ?`).bind(body.id).run();
        return new Response("VOTED", { headers: corsHeaders });
      }

      return new Response("AI_GROWTH_SYSTEM_v2_ONLINE", { status: 200, headers: corsHeaders });

    } catch (e) {
      return new Response("SERVER_ERROR: " + e.message, { status: 500, headers: corsHeaders });
    }
  }
};
