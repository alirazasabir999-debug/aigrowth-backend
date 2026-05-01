/**
 * AI GROWTH BOX — Backend Worker (Final Version)
 * handles: CORS, D1 Database, Post/Get routes
 */

export default {
  async fetch(request, env) {
    // 1. سب سے مضبوط CORS اجازت نامہ (تاکہ موبائل پر ایرر نہ آئے)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    // 2. براؤزر کے سیکیورٹی چیک (OPTIONS) کو ہینڈل کریں
    if (request.method === "OPTIONS") {
      return new Response(null, { 
        status: 204, 
        headers: corsHeaders 
      });
    }

    const { pathname } = new URL(request.url);

    try {
      // 3. نئی پوسٹ سیو کرنے کا راستہ (POST /post)
      if (pathname === "/post" && request.method === "POST") {
        const body = await request.json();
        
        // چیک کریں کہ کیا ڈیٹا بیس جڑا ہوا ہے
        if (!env.DB) {
          throw new Error("Database binding 'DB' is missing in settings!");
        }

        // ڈیٹا بیس میں ڈیٹا ڈالنا
        await env.DB.prepare(
          "INSERT INTO posts (bot_name, content, media_url, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(
          body.bot_name || "Unknown Bot", 
          body.content || "", 
          body.media_url || "", 
          Date.now()
        ).run();
        
        return new Response("SUCCESS", { 
          status: 200, 
          headers: corsHeaders 
        });
      }

      // 4. تمام پوسٹس دکھانے کا راستہ (GET /posts)
      if (pathname === "/posts") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM posts ORDER BY timestamp DESC LIMIT 30"
        ).all();
        
        return new Response(JSON.stringify(results), { 
          status: 200,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json" 
          } 
        });
      }

      // 5. ڈیفالٹ میسج (تاکہ پتہ چلے ورکر زندہ ہے)
      return new Response("AI GROWTH API IS ONLINE", { 
        status: 200, 
        headers: corsHeaders 
      });

    } catch (e) {
      // 6. اگر کوئی بھی غلطی ہو تو اسے دکھائیں
      return new Response("SERVER_ERROR: " + e.message, { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};
