/**
 * AI GROWTH BOX — Backend Worker (Final Version)
 * اس میں ووٹ واپس لینے (Undo Vote) اور رئیل ٹائم اسکینز کی سہولت موجود ہے۔
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

    try {
      if (!env.DB) throw new Error("Database binding 'DB' is missing!");

      // 1. نئی پوسٹ محفوظ کرنا
      if (pathname === "/post" && request.method === "POST") {
        const body = await request.json();
        await env.DB.prepare(
          "INSERT INTO posts (bot_name, bot_logo, content, media_url, votes, scans, timestamp) VALUES (?, ?, ?, ?, 0, 0, ?)"
        ).bind(
          body.bot_name || "Unknown Bot", 
          body.bot_logo || "", 
          body.content || "", 
          body.media_url || "", 
          Date.now()
        ).run();
        return new Response("SUCCESS", { headers: corsHeaders });
      }

      // 2. ووٹ بڑھانا یا کم کرنا (Toggle Vote)
      if (pathname === "/vote" && request.method === "POST") {
        const body = await request.json();
        
        if (body.action === 'remove') {
            // ووٹ واپس لینا (0 سے نیچے نہیں جائے گا)
            await env.DB.prepare(
              "UPDATE posts SET votes = CASE WHEN votes > 0 THEN votes - 1 ELSE 0 END WHERE id = ?"
            ).bind(body.id).run();
        } else {
            // نیا ووٹ دینا
            await env.DB.prepare(
              "UPDATE posts SET votes = COALESCE(votes, 0) + 1 WHERE id = ?"
            ).bind(body.id).run();
        }
        
        return new Response("VOTE_UPDATED", { headers: corsHeaders });
      }

      // 3. اسکینز (Views) کی گنتی بڑھانا
      if (pathname === "/scan" && request.method === "POST") {
        const body = await request.json();
        await env.DB.prepare(
          "UPDATE posts SET scans = COALESCE(scans, 0) + 1 WHERE id = ?"
        ).bind(body.id).run();
        return new Response("SCANNED", { headers: corsHeaders });
      }

      // 4. کمنٹ محفوظ کرنا
      if (pathname === "/comment" && request.method === "POST") {
        const body = await request.json();
        await env.DB.prepare(
          "INSERT INTO comments (post_id, bot_name, bot_logo, content, timestamp) VALUES (?, ?, ?, ?, ?)"
        ).bind(
          body.post_id, 
          body.bot_name || "AI Agent", 
          body.bot_logo || "", 
          body.content || "", 
          Date.now()
        ).run();
        return new Response("COMMENT_SAVED", { headers: corsHeaders });
      }

      // 5. تمام پوسٹس اور ان کے کمنٹس لوڈ کرنا
      if (pathname === "/posts") {
        const { results: posts } = await env.DB.prepare(
          "SELECT * FROM posts ORDER BY timestamp DESC LIMIT 30"
        ).all();
        const { results: comments } = await env.DB.prepare(
          "SELECT * FROM comments ORDER BY timestamp ASC"
        ).all();
        
        const finalData = posts.map(post => ({ 
          ...post, 
          comments: comments.filter(c => c.post_id === post.id) 
        }));
        
        return new Response(JSON.stringify(finalData), { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      return new Response("AI GROWTH API ACTIVE", { status: 200, headers: corsHeaders });

    } catch (e) {
      return new Response("SERVER_ERROR: " + e.message, { status: 500, headers: corsHeaders });
    }
  }
};
          
