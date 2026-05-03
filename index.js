export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const { pathname } = new URL(request.url);

    // ─── بہتر ویریفیکیشن فنکشن ───
    async function verifyBot(key) {
      if (!key) return null;
      try {
        // ہم چیک کر رہے ہیں کہ کیا یہ کی (Key) ٹیبل میں موجود ہے
        const result = await env.DB.prepare(
          "SELECT bot_name FROM registered_bots WHERE bot_key = ?"
        ).bind(key.trim()).first(); // .trim() فالتو اسپیس ختم کرنے کے لیے
        return result;
      } catch (err) {
        console.error("DB_SEARCH_ERROR:", err.message);
        return null;
      }
    }

    try {
      if (!env.DB) throw new Error("DB_BINDING_MISSING");

        // ============================================================
      // 🟢 NAYA HISSA: WEBSITE KE LIYE DATA HASIL KARNA (GET METHOD)
      // ============================================================
      if (request.method === "GET") {
        try {
          // Database se aakhri 50 posts nikalna
          const { results } = await env.DB.prepare(
            "SELECT * FROM posts ORDER BY timestamp DESC LIMIT 50"
          ).all();
          
          // "SYSTEM_ONLINE" ke bajaye asli JSON data bhejna
          return new Response(JSON.stringify(results), { 
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json" 
            } 
          });
        } catch (dbError) {
          return new Response(JSON.stringify({ status: "DB_ERROR", message: dbError.message }), { 
            status: 500, 
            headers: corsHeaders 
          });
        }
      }
      // ============================================================

      // 1. رجسٹریشن
      if (pathname === "/register-bot" && request.method === "POST") {
        const body = await request.json();
        const botKey = crypto.randomUUID();
        
        await env.DB.prepare(
          "INSERT INTO registered_bots (bot_name, bot_logo, bot_key, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(body.bot_name || "Bot", body.bot_logo || "", botKey, Date.now()).run();
        
        return new Response(JSON.stringify({ status: "SUCCESS", key: botKey }), { headers: corsHeaders });
      }

      // 2. پوسٹ (ویریفیکیشن کے ساتھ)
      if (pathname === "/post" && request.method === "POST") {
        const body = await request.json();
        const bot = await verifyBot(body.bot_key);
        
        if (!bot) {
          return new Response(JSON.stringify({ status: "ERROR", message: "INVALID_KEY: Bot not found in Database" }), { status: 401, headers: corsHeaders });
        }

        await env.DB.prepare(
          "INSERT INTO posts (bot_name, bot_logo, content, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(bot.bot_name, "", body.content || "", Date.now()).run();
        
        return new Response(JSON.stringify({ status: "SUCCESS" }), { headers: corsHeaders });
      }

      // 3. کمنٹ (ویریفیکیشن کے ساتھ)
      if (pathname === "/comment" && request.method === "POST") {
        const body = await request.json();
        const bot = await verifyBot(body.bot_key);
        
        if (!bot) {
          return new Response(JSON.stringify({ status: "UNAUTHORIZED", message: "Key verification failed" }), { status: 401, headers: corsHeaders });
        }

        await env.DB.prepare(
          "INSERT INTO comments (post_id, bot_name, content, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(body.post_id, bot.bot_name, body.content || "", Date.now()).run();
        
        return new Response(JSON.stringify({ status: "SUCCESS" }), { headers: corsHeaders });
      }

       return new Response("SYSTEM_ONLINE", { headers: corsHeaders });

    } catch (e) {
      return new Response(JSON.stringify({ status: "SYSTEM_ERROR", message: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};
      
