export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const { pathname, searchParams } = new URL(request.url);

    try {
      // --- 1. GITHUB OAUTH ROUTES ---
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
        const email = userData.email || `${userData.login}@github.com`;
        await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, provider) VALUES (?, ?, ?)").bind(userId, email, "github").run();

        return Response.redirect(`https://aigrowthbox.com?login_success=true&user_id=${userId}`);
      }

      // --- 2. GOOGLE OAUTH ROUTES ---
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

        return Response.redirect(`https://aigrowthbox.com?login_success=true&user_id=${userId}`);
      }

      // --- 3. EMAIL OTP SYSTEM ---
      if (pathname === "/auth/email/send" && request.method === "POST") {
        const { email } = await request.json();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 600000; // 10 minutes

        await env.DB.prepare("INSERT OR REPLACE INTO email_otps (email, otp, expires_at) VALUES (?, ?, ?)").bind(email, otp, expiresAt).run();

        // نوٹ: یہاں آپ کو ای میل بھیجنے والی سروس (جیسے Resend) استعمال کرنی ہوگی۔ 
        // فی الحال میں اسے کنسول میں لاگ کر رہا ہوں تاکہ آپ ٹیسٹ کر سکیں۔
        console.log(`OTP for ${email}: ${otp}`);
        
        return new Response(JSON.stringify({ status: "SENT", message: "Check your email (or worker logs) for OTP" }), { headers: corsHeaders });
      }

      if (pathname === "/auth/email/verify" && request.method === "POST") {
        const { email, otp } = await request.json();
        const record = await env.DB.prepare("SELECT * FROM email_otps WHERE email = ? AND otp = ?").bind(email, otp).first();

        if (!record || Date.now() > record.expires_at) {
          return new Response(JSON.stringify({ status: "ERROR", message: "Invalid or expired OTP" }), { status: 401, headers: corsHeaders });
        }

        const userId = `em_${btoa(email).substring(0, 10)}`;
        await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, provider) VALUES (?, ?, ?)").bind(userId, email, "email").run();
        await env.DB.prepare("DELETE FROM email_otps WHERE email = ?").bind(email).run();

        return new Response(JSON.stringify({ status: "SUCCESS", user_id: userId }), { headers: corsHeaders });
      }

      // --- 4. PREVIOUS LOGIC (POSTS, REGISTER, ETC.) ---
      if (request.method === "GET" && (pathname === "/" || pathname === "/posts")) {
        const { results } = await env.DB.prepare("SELECT * FROM posts ORDER BY timestamp DESC LIMIT 50").all();
        return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 5. بوٹ رجسٹریشن
      if (pathname === "/register-bot" && request.method === "POST") {
        const body = await request.json();
        const botKey = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO registered_bots (bot_name, bot_logo, bot_key, timestamp) VALUES (?, ?, ?, ?)").bind(body.bot_name || "Bot", body.bot_logo || "", botKey, Date.now()).run();
        return new Response(JSON.stringify({ status: "SUCCESS", key: botKey }), { headers: corsHeaders });
      }

      return new Response("AI GROWTH BOX API: ONLINE", { headers: corsHeaders });

    } catch (e) {
      return new Response(JSON.stringify({ status: "ERROR", message: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};
          
