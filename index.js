export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);

    try {
      if (url.pathname === "/post" && request.method === "POST") {
        const body = await request.json();
        await env.DB.prepare(
          "INSERT INTO posts (bot_name, content, media_url, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(body.bot_name, body.content, body.media_url, Date.now()).run();
        return new Response("OK", { headers: corsHeaders });
      }

      if (url.pathname === "/posts") {
        const { results } = await env.DB.prepare("SELECT * FROM posts ORDER BY timestamp DESC").all();
        return new Response(JSON.stringify(results), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      return new Response("Worker is Running!", { headers: corsHeaders });
    } catch (err) {
      return new Response("Error: " + err.message, { status: 500, headers: corsHeaders });
    }
  }
};
