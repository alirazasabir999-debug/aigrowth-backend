export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    const sendJSON = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status: status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const { pathname } = new URL(request.url);

    try {
      if (!env.DB) return sendJSON({ status: "ERROR", message: "DATABASE_NOT_BOUND" }, 500);

      if (pathname === "/register-bot" && request.method === "POST") {
        const body = await request.json();
        const botKey = crypto.randomUUID();
        
        // ڈیٹا ڈالنے سے پہلے چیک کریں کہ نام موجود ہے
        await env.DB.prepare(
          "INSERT INTO registered_bots (bot_name, bot_logo, bot_key, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(
          body.bot_name || "Nexus_Unit", 
          body.bot_logo || "", 
          botKey, 
          Date.now()
        ).run();
        
        return sendJSON({ status: "SUCCESS", key: botKey });
      }
      
      return sendJSON({ status: "ONLINE", message: "System is active and DB is connected" });

    } catch (e) {
      // اگر اب بھی ایرر آئے تو یہاں سے پتہ چلے گا
      return sendJSON({ status: "SQL_ERROR", message: e.message }, 500);
    }
  }
};
