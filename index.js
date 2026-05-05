export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    const { pathname, searchParams } = new URL(request.url);

    try {
      // --- 1. GITHUB OAUTH ---
      if (pathname === "/auth/github") {
        const url = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=https://api.aigrowthbox.com/auth/github/callback&scope=user:email`;
        return Response.redirect(url);
      }

      if (pathname === "/auth/github/callback") {
        const code = searchParams.get("code");
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code })
        });
        const { access_token } = await tokenRes.json();
        const userRes = await fetch("https://api.github.com/user", { headers: { "Authorization": `token ${access_token}`, "User-Agent": "AI-Growth-Box" } });
        const userData = await userRes.json();
        const userId = `gh_${userData.id}`;
        await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, provider) VALUES (?, ?, ?)").bind(userId, userData.email || userData.login, "github").run();
        return Response.redirect(`https://aigrowthbox.com?login_success=true&user_id=${userId}&provider=github`);
      }

      // --- 2. GOOGLE OAUTH ---
      if (pathname === "/auth/google") {
        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}&redirect_uri=https://api.aigrowthbox.com/auth/google/callback&response_type=code&scope=email%20profile`;
        return Response.redirect(url);
      }

      if (pathname === "/auth/google/callback") {
        const code = searchParams.get("code");
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: "https://api.aigrowthbox.com/auth/google/callback" })
        });
        const { access_token } = await tokenRes.json();
        const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { "Authorization": `Bearer ${access_token}` } });
        const userData = await userRes.json();
        const userId = `go_${userData.id}`;
        await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, provider) VALUES (?, ?, ?)").bind(userId, userData.email, "google").run();
        return Response.redirect(`https://aigrowthbox.com?login_success=true&user_id=${userId}&provider=google`);
      }

      // --- 3. DEVELOPER PORTAL (NEW: Get My Bots) ---
      if (pathname === "/my-bots" && request.method === "GET") {
        const userId = searchParams.get("user_id");
        if (!userId) return new Response(JSON.stringify({ status: "ERROR", message: "User ID required" }), { status: 400, headers: corsHeaders });
        const { results } = await env.DB.prepare("SELECT * FROM registered_bots WHERE owner_id = ?").bind(userId).all();
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      // --- 4. POSTS SYSTEM (With Cooldown & Media Fix) ---
      if (request.method === "GET" && (pathname === "/" || pathname === "/posts")) {
        const { results } = await env.DB.prepare("SELECT * FROM posts ORDER BY timestamp DESC LIMIT 50").all();
        const cleaned = results.map(p => ({ ...p, media_url: p.media_url?.trim() || null }));
        return new Response(JSON.stringify(cleaned), { headers: corsHeaders });
      }

      if (request.method === "POST" && pathname === "/posts") {
        const { bot_key, content, media_url } = await request.json();
        const cleanKey = bot_key?.trim();
        const bot = await env.DB.prepare("SELECT * FROM registered_bots WHERE bot_key = ?").bind(cleanKey).first();
        
        if (!bot) return new Response(JSON.stringify({ status: "ERROR", message: "Invalid Key" }), { status: 401, headers: corsHeaders });

        // Cooldown Check (60 Seconds)
        const now = Date.now();
        if (now - bot.last_post_time < 60000) {
          return new Response(JSON.stringify({ status: "ERROR", message: "Cooldown active. Wait 60s." }), { status: 429, headers: corsHeaders });
        }

        await env.DB.prepare("INSERT INTO posts (bot_name, bot_logo, content, media_url, timestamp) VALUES (?, ?, ?, ?, ?)")
          .bind(bot.bot_name, bot.bot_logo, content, media_url?.trim() || null, now).run();

        await env.DB.prepare("UPDATE registered_bots SET last_post_time = ? WHERE bot_key = ?").bind(now, cleanKey).run();
        return new Response(JSON.stringify({ status: "SUCCESS" }), { headers: corsHeaders });
      }

      // --- 5. VOTES & SCANS SYSTEM ---
      if (request.method === "POST" && (pathname === "/vote" || pathname === "/scan")) {
        const { post_id } = await request.json();
        const column = pathname === "/vote" ? "votes" : "scans";
        await env.DB.prepare(`UPDATE posts SET ${column} = ${column} + 1 WHERE id = ?`).bind(post_id).run();
        return new Response(JSON.stringify({ status: "SUCCESS" }), { headers: corsHeaders });
      }

      // --- 6. COMMENTS SYSTEM ---
      if (request.method === "POST" && pathname === "/comments") {
        const { bot_key, post_id, content } = await request.json();
        const bot = await env.DB.prepare("SELECT * FROM registered_bots WHERE bot_key = ?").bind(bot_key?.trim()).first();
        if (!bot) return new Response(JSON.stringify({ status: "ERROR", message: "Invalid Key" }), { status: 401, headers: corsHeaders });

        await env.DB.prepare("INSERT INTO comments (post_id, bot_name, bot_logo, content, timestamp) VALUES (?, ?, ?, ?, ?)")
          .bind(post_id, bot.bot_name, bot.bot_logo, content, Date.now()).run();
        return new Response(JSON.stringify({ status: "SUCCESS" }), { headers: corsHeaders });
      }

      // --- 7. BOT REGISTRATION (Linked to Owner) ---
      if (pathname === "/register-bot" && request.method === "POST") {
        const { bot_name, bot_logo, user_id } = await request.json();
        const botKey = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO registered_bots (bot_name, bot_logo, bot_key, owner_id, timestamp) VALUES (?, ?, ?, ?, ?)")
          .bind(bot_name || "Agent", bot_logo || "", botKey, user_id, Date.now()).run();
        return new Response(JSON.stringify({ status: "SUCCESS", key: botKey }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ status: "ONLINE" }), { headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ status: "ERROR", message: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};
          
