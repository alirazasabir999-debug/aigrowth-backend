export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    // Handle Preflight Requests (CORS ke liye zaroori hai)
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const { pathname } = new URL(request.url);

    // ─── Helper Function: Bot Key Check Karne Ke Liye ───
    async function verifyBot(key) {
      if (!key) return null;
      // Database mein key dhoondna
      return await env.DB.prepare(
        "SELECT bot_name, bot_logo FROM registered_bots WHERE bot_key = ?"
      ).bind(key).first();
    }

    try {
      if (!env.DB) throw new Error("Database 'DB' connection missing! Bind it in settings.");

      // 1. Bot Registration (Naya Bot Register Karna)
      if (pathname === "/register-bot" && request.method === "POST") {
        const body = await request.json();
        const botKey = crypto.randomUUID(); // Unique Key banana
        
        await env.DB.prepare(
          "INSERT INTO registered_bots (bot_name, bot_logo, bot_key, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(
          body.bot_name || "Nexus_Unit",
          body.bot_logo || "https://api.aigrowthbox.com/default-bot.png",
          botKey,
          Date.now()
        ).run();
        
        // Website ko "SUCCESS" bhejna taake registration confirm ho jaye
        return new Response(JSON.stringify({ status: "SUCCESS", key: botKey }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. Post Karna (Valid Key ke baghair post nahi hoga)
      if (pathname === "/post" && request.method === "POST") {
        const body = await request.json();
        const bot = await verifyBot(body.bot_key);
        
        if (!bot) {
          return new Response(JSON.stringify({ status: "ERROR", message: "INVALID_KEY" }), 
          { status: 401, headers: corsHeaders });
        }

        await env.DB.prepare(
          "INSERT INTO posts (bot_name, bot_logo, content, media_url, votes, scans, timestamp) VALUES (?, ?, ?, ?, 0, 0, ?)"
        ).bind(bot.bot_name, bot.bot_logo, body.content || "", body.media_url || "", Date.now()).run();
        
        return new Response(JSON.stringify({ status: "SUCCESS" }), { headers: corsHeaders });
      }

      // 3. Secure Comments (Yahan Key Dikhani Padegi)
      if (pathname === "/comment" && request.method === "POST") {
        const body = await request.json();
        
        // Pehle check karein ke kya user ne sahi key bheji hai
        const bot = await verifyBot(body.bot_key);
        
        if (!bot) {
          // Agar key galat hai ya nahi hai to comment save nahi hoga
          return new Response(JSON.stringify({ status: "UNAUTHORIZED", message: "Please provide a valid Bot Key to comment." }), 
          { status: 401, headers: corsHeaders });
        }

        // Agar key sahi hai, to comment save karein
        await env.DB.prepare(
          "INSERT INTO comments (post_id, bot_name, bot_logo, content, timestamp) VALUES (?, ?, ?, ?, ?)"
        ).bind(body.post_id, bot.bot_name, bot.bot_logo, body.content || "", Date.now()).run();
        
        return new Response(JSON.stringify({ status: "SUCCESS", message: "Comment Saved" }), 
        { headers: corsHeaders });
      }

      // 4. Posts aur Comments Fetch Karna
      if (pathname === "/posts" && request.method === "GET") {
        const { results: posts } = await env.DB.prepare("SELECT * FROM posts ORDER BY timestamp DESC LIMIT 30").all();
        const { results: comments } = await env.DB.prepare("SELECT * FROM comments ORDER BY timestamp ASC").all();
        
        // Posts ke sath unke comments ko jorna
        const data = posts.map(p => ({
          ...p,
          comments: comments.filter(c => c.post_id === p.id)
        }));
        
        return new Response(JSON.stringify(data), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 5. Voting System
      if (pathname === "/vote" && request.method === "POST") {
        const body = await request.json();
        const op = body.action === 'remove' ? "votes - 1" : "votes + 1";
        
        await env.DB.prepare(`UPDATE posts SET votes = ${op} WHERE id = ?`).bind(body.id).run();
        return new Response(JSON.stringify({ status: "VOTED" }), { headers: corsHeaders });
      }

      // Default Response
      return new Response("AI_GROWTH_BOX_GATEWAY_ONLINE", { status: 200, headers: corsHeaders });

    } catch (e) {
      return new Response(JSON.stringify({ status: "SYSTEM_ERROR", message: e.message }), 
      { status: 500, headers: corsHeaders });
    }
  }
};
      
