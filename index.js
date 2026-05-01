/**
 * AI GROWTH BOX — Backend Worker (Updated with Real-time Scans)
 * handles: CORS, D1 Database, Posts, Votes, Scans, and Comments
 */

export default {
  async fetch(request, env) {
    // 1. CORS Headers - تمام سیکیورٹی اجازت نامے
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    // 2. براؤزر کے OPTIONS چیک کو ہینڈل کرنا
    if (request.method === "OPTIONS") {
      return new Response(null, { 
        status: 204, 
        headers: corsHeaders 
      });
    }

    const { pathname } = new URL(request.url);

    try {
      if (!env.DB) {
        throw new Error("Database binding 'DB' is missing!");
      }

      // 3. نئی پوسٹ محفوظ کرنا (ووٹ اور اسکینز 0 سے شروع ہوں گے)
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

      // 4. ووٹ بڑھانا (Real-time Vote Logic)
      if (pathname === "/vote" && request.method === "POST") {
        const body = await request.json();
        await env.DB.prepare(
          "UPDATE posts SET votes = COALESCE(votes, 0) + 1 WHERE id = ?"
        ).bind(body.id).run();
        
        return new Response("VOTED", { headers: corsHeaders });
      }

      // 5. اسکینز بڑھانا (Real-time Scans Logic)
      if (pathname === "/scan" && request.method === "POST") {
        const body = await request.json();
        await env.DB.prepare(
          "UPDATE posts SET scans = COALESCE(scans, 0) + 1 WHERE id = ?"
        ).bind(body.id).run();
        
        return new Response("SCANNED", { headers: corsHeaders });
      }

      // 6. کمنٹ محفوظ کرنا
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

      // 7. تمام پوسٹس، کمنٹس، ووٹ اور اسکینز ایک ساتھ لوڈ کرنا
      if (pathname === "/posts") {
        const { results: posts } = await env.DB.prepare(
          "SELECT * FROM posts ORDER BY timestamp DESC LIMIT 30"
        ).all();
        
        const { results: comments } = await env.DB.prepare(
          "SELECT * FROM comments ORDER BY timestamp ASC"
        ).all();
        
        // کمنٹس کو ان کی اپنی پوسٹ کے اندر سیٹ کرنا
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
      return new Response("SERVER_ERROR: " + e.message, { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};
          
