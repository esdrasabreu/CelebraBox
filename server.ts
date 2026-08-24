import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Setup Supabase Client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  // API Route for Mercado Pago Preference
  app.post("/api/create-preference", async (req, res) => {
    try {
      const { title, price, quantity, giftId, donorName, hostId } = req.body;
      
      // Utilize token de plataforma em vez de buscar token do anfitrião
      const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "APP_USR-5302990072214596-080318-1c8251db5cc695db84a123841599bc20-3587153803";

      if (!accessToken) {
        return res.status(400).json({ error: "Access token is required" });
      }

      const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
      const preference = new Preference(client);

      let baseUrl = req.get('origin');
      if (!baseUrl) {
        let host = req.get('host') || 'localhost:3000';
        if (host.includes('0.0.0.0')) host = host.replace('0.0.0.0', 'localhost');
        baseUrl = `${req.protocol}://${host}`;
      }

      const result = await preference.create({
        body: {
          items: [
            {
              id: giftId || "gift",
              title: title,
              quantity: quantity || 1,
              unit_price: Number(price)
            }
          ],
          payer: {
            name: donorName || "Convidado",
            email: "convidado_" + Date.now() + "@testuser.com"
          },
          back_urls: {
            success: `${baseUrl}/e/${hostId}/pagamento/sucesso`,
            failure: `${baseUrl}/e/${hostId}/pagamento/falha`,
            pending: `${baseUrl}/e/${hostId}/pagamento/pendente`
          },
          auto_return: "approved",
          statement_descriptor: "PRESENTE",
          metadata: {
            host_id: hostId,
            gift_id: giftId
          }
        }
      });

      res.json({ init_point: result.init_point });
    } catch (error) {
      console.error("Error creating preference:", error);
      res.status(500).json({ error: "Failed to create preference" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
