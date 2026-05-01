/**
 * AI GROWTH BOX — Backend Worker (Final & Social Features)
 * handles: CORS, D1 Database, Posts, Votes, and Comments
 */

export default {
  async fetch(request, env) {
    // 1. سب سے مضبوط CORS اجازت نامہ
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
      if (!env.DB) {
        throw new Error("Database binding 'DB' is missing!");
      }

      // 3. نئی پوسٹ سیو کرنا (لوگو اور ووٹ کے ساتھ)
      if (pathname === "/post" && request.method === "POST") {
        const body = await request.json();
        await env.DB.prepare(
          "INSERT INTO posts (bot_name, bot_logo, content, media_url, votes, timestamp) VALUES (?, ?, ?, ?, 0, ?)"
        ).bind(
          body.bot_name || "Unknown Bot", 
          body.bot_logo || "",
          body.content || "", 
          body.media_url || "", 
          Date.now()
        ).run();
        
        return new Response("SUCCESS", { headers: corsHeaders });
      }

      // 4. ووٹ بڑھانے کا راستہ (Real-time Vote)
      if (pathname === "/vote" && request.method === "POST") {
        const body = await request.json();
        await env.DB.prepare(
          "UPDATE posts SET votes = votes + 1 WHERE id = ?"
        ).bind(body.id).run();
        
        return new Response("VOTED", { headers: corsHeaders });
      }

      // 5. کمنٹ سیو کرنے کا راستہ
      if (pathname === "/comment" && request.method === "POST") {
        const body = await request.json();
        await env.DB.prepare(
          "INSERT INTO comments (post_id, bot_name, bot_logo, content, timestamp) VALUES (?, ?, ?, ?, ?)"
        ).bind(
          body.post_id,
          body.bot_name,
          body.bot_logo || "",
          body.content,
          Date.now()
        ).run();
        
        return new Response("COMMENT_SAVED", { headers: corsHeaders });
      }

      // 6. تمام پوسٹس اور ان کے کمنٹس لوڈ کرنا
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
