import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import {
  createReservation,
  confirmPayment,
  releaseReservation,
  getStoredTransactions,
  getStoredReservations,
  getActiveReservationsCount,
  getStockDeductions,
  cleanExpiredReservations
} from './server_store';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Setup Supabase Client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
    realtime: { transport: WebSocket as any }
  }) : null;

  // Helper to resolve host access token
  async function resolveAccessToken(hostId?: string, overrideToken?: string): Promise<string> {
    if (overrideToken && overrideToken.trim()) return overrideToken.trim();

    if (supabase && hostId && hostId !== 'default') {
      try {
        const { data: pSettings } = await supabase
          .from('payment_settings')
          .select('gateway_access_token')
          .eq('host_id', hostId)
          .maybeSingle();
        if (pSettings?.gateway_access_token) {
          return pSettings.gateway_access_token;
        }
      } catch (dbErr) {
        console.warn("Could not fetch payment_settings for host:", dbErr);
      }
    }

    return process.env.MERCADO_PAGO_ACCESS_TOKEN || 
           process.env.MP_ACCESS_TOKEN || 
           "APP_USR-5302990072214596-080318-1c8251db5cc695db84a123841599bc20-3587153803";
  }

  // 1. API Route for Mercado Pago Preference & 24h Reservation Lock
  app.post("/api/create-preference", async (req, res) => {
    try {
      const { 
        title, 
        price, 
        quantity = 1, 
        giftId, 
        donorName = "Convidado", 
        donorMessage = "",
        hostId = "default", 
        externalReference, 
        gatewayAccessToken 
      } = req.body;
      
      const accessToken = await resolveAccessToken(hostId, gatewayAccessToken);
      if (!accessToken) {
        return res.status(400).json({ error: "Access token is required" });
      }

      // Check current gift stock if Supabase is connected
      if (supabase && giftId) {
        try {
          const { data: giftData } = await supabase
            .from('gifts')
            .select('id, quantity, title')
            .eq('id', giftId)
            .maybeSingle();

          if (giftData && giftData.quantity !== undefined && giftData.quantity !== null) {
            const activeReservations = getActiveReservationsCount(giftId);
            const remaining = Math.max(0, giftData.quantity - activeReservations);
            
            if (remaining <= 0) {
              return res.status(400).json({ 
                error: "Este presente já está reservado aguardando confirmação de pagamento via Pix (válido por 24h). Caso não seja pago no prazo, voltará a ficar disponível!" 
              });
            }
          }
        } catch (stockErr) {
          console.warn("Error checking gift stock:", stockErr);
        }
      }

      const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
      const preference = new Preference(client);

      let baseUrl = req.get('origin') || process.env.APP_URL || '';
      if (!baseUrl) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        let host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
        if (typeof host === 'string' && host.includes('0.0.0.0')) host = host.replace('0.0.0.0', 'localhost');
        baseUrl = `${protocol}://${host}`;
      }
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

      const extRef = externalReference || `${hostId}:${giftId || 'gift'}:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Create 24h reservation lock immediately
      const reservation = createReservation({
        hostId,
        giftId: String(giftId || "gift"),
        giftTitle: title || "Presente",
        donorName: String(donorName).trim() || "Convidado",
        amount: Number(price),
        externalReference: extRef,
        durationHours: 24
      });

      const isHttps = baseUrl.startsWith('https://');
      const isPublicUrl = isHttps && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1');

      const payerObj: any = {
        name: String(donorName).trim() || "Convidado"
      };

      const result = await preference.create({
        body: {
          items: [
            {
              id: String(giftId || "gift"),
              title: title || "Presente de Casamento",
              quantity: Number(quantity) || 1,
              unit_price: Number(price)
            }
          ],
          payer: payerObj,
          back_urls: {
            success: `${baseUrl}/e/${hostId}/pagamento/sucesso`,
            failure: `${baseUrl}/e/${hostId}/pagamento/falha`,
            pending: `${baseUrl}/e/${hostId}/pagamento/pendente`
          },
          payment_methods: {
            installments: 12,
            excluded_payment_types: [],
            excluded_payment_methods: []
          },
          ...(isHttps ? { auto_return: "approved" } : {}),
          statement_descriptor: "PRESENTE",
          external_reference: extRef,
          ...(isPublicUrl ? { notification_url: `${baseUrl}/api/webhook/mercadopago` } : {}),
          metadata: {
            host_id: hostId,
            gift_id: giftId,
            donor_name: donorName,
            donor_message: donorMessage
          }
        }
      });

      res.json({ 
        init_point: result.init_point, 
        preference_id: result.id,
        external_reference: extRef,
        reservation
      });
    } catch (error: any) {
      console.error("Error creating preference:", error?.message || error);
      res.status(500).json({ error: "Failed to create preference", details: error?.message || error });
    }
  });

  // Helper to process payment confirmation and decrement stock
  async function handlePaymentConfirmation(paymentInfo: any) {
    if (!paymentInfo) return;

    const status = paymentInfo.status;
    const paymentId = String(paymentInfo.id);
    const externalReference = paymentInfo.external_reference || '';
    const paymentMethodId = paymentInfo.payment_method_id;
    const paymentTypeId = paymentInfo.payment_type_id;
    const amount = Number(paymentInfo.transaction_amount || 0);

    let methodFriendly = 'PIX';
    if (paymentMethodId === 'pix') methodFriendly = 'PIX';
    else if (paymentTypeId === 'credit_card') methodFriendly = 'Cartão de Crédito';
    else if (paymentTypeId === 'debit_card') methodFriendly = 'Cartão de Débito';
    else if (paymentTypeId === 'ticket') methodFriendly = 'Boleto';
    else if (paymentMethodId) methodFriendly = String(paymentMethodId).toUpperCase();

    // Parse hostId and giftId from externalReference or metadata
    let hostId = paymentInfo.metadata?.host_id || '';
    let giftId = paymentInfo.metadata?.gift_id || '';
    let donorName = paymentInfo.metadata?.donor_name || 
                    paymentInfo.payer?.first_name || 
                    paymentInfo.payer?.email || 
                    'Convidado';

    let giftTitle = paymentInfo.additional_info?.items?.[0]?.title || 
                    paymentInfo.description || 
                    'Presente';

    if (externalReference && externalReference.includes(':')) {
      const parts = externalReference.split(':');
      if (parts.length >= 2) {
        if (!hostId) hostId = parts[0];
        if (!giftId) giftId = parts[1];
      }
    }

    // STRICT CHECK: Discard personal purchases, Mercado Livre, POTS, bank transfers
    if (!giftId || !hostId || hostId === 'default') {
      return; // Not a wedding gift transaction!
    }
    if (externalReference.startsWith('20000') || externalReference.startsWith('POTS') || externalReference.startsWith('11081')) {
      return; // Discard Mercado Livre and Cofrinho transfers
    }

    if (status === 'approved') {
      // 1. Confirm in server persistent store (updates reservation to paid, decrements stock count, adds approved tx)
      confirmPayment({
        paymentId,
        hostId,
        giftId,
        externalReference,
        amount,
        method: methodFriendly,
        donorName,
        giftTitle,
        date: paymentInfo.date_approved || paymentInfo.date_created
      });

      // 2. Decrement quantity in Supabase if gift exists
      if (supabase && giftId) {
        try {
          const { data: currentGift } = await supabase
            .from('gifts')
            .select('id, quantity')
            .eq('id', giftId)
            .maybeSingle();

          if (currentGift && currentGift.quantity !== undefined && currentGift.quantity > 0) {
            const newQty = Math.max(0, currentGift.quantity - 1);
            await supabase
              .from('gifts')
              .update({ quantity: newQty })
              .eq('id', giftId);
          }
        } catch (giftUpdateErr) {
          console.warn("Could not update gift quantity in Supabase:", giftUpdateErr);
        }
      }

      // 3. Insert or update transaction in Supabase with all tracking fields
      if (supabase && hostId) {
        try {
          // Check if already recorded (avoid duplicates using payment_id)
          const { data: existingTx } = await supabase
            .from('transactions')
            .select('id')
            .eq('payment_id', paymentId)
            .maybeSingle();

          if (!existingTx) {
            await supabase.from('transactions').insert([{
              host_id: hostId,
              gift_title: giftTitle,
              gift_id: giftId || null,
              donor_name: donorName,
              amount: amount,
              method: methodFriendly,
              status: 'approved',
              payment_id: paymentId,
              external_reference: externalReference || null
            }]);
          } else {
            // Update existing record to approved if it was pending
            await supabase.from('transactions')
              .update({ status: 'approved', method: methodFriendly, amount: amount })
              .eq('payment_id', paymentId);
          }
        } catch (supabaseTxErr) {
          console.warn("Could not insert/update transaction in Supabase (will rely on server store):", supabaseTxErr);
        }
      }
    } else if (status === 'cancelled' || status === 'rejected' || status === 'refunded') {
      if (externalReference) {
        releaseReservation(externalReference, hostId);
      }
    }
  }

  // 2. Webhook for Mercado Pago (Supports POST and GET)
  app.all("/api/webhook/mercadopago", async (req, res) => {
    try {
      const body = req.body || {};
      const query = req.query || {};

      const type = body.type || query.type;
      const action = body.action || query.action || query.topic;
      const paymentId = body.data?.id || body.id || query.id || query['data.id'];

      if (paymentId && (type === 'payment' || action === 'payment' || action === 'payment.created' || action === 'payment.updated' || !type)) {
        // First fetch with default token to get the externalReference
        // then resolve the correct per-host token
        let accessToken = await resolveAccessToken();
        let paymentInfo: any = null;

        try {
          const tempClient = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
          paymentInfo = await new Payment(tempClient).get({ id: String(paymentId) });
        } catch (fetchErr: any) {
          console.warn(`Could not fetch payment ${paymentId} from Mercado Pago:`, fetchErr?.message || fetchErr);
        }

        if (paymentInfo) {
          // Try to resolve the correct host token from the payment metadata or externalReference
          const extRef = paymentInfo.external_reference || '';
          let hostIdFromRef = paymentInfo.metadata?.host_id || '';
          if (!hostIdFromRef && extRef.includes(':')) {
            hostIdFromRef = extRef.split(':')[0];
          }

          if (hostIdFromRef && hostIdFromRef !== 'default') {
            const hostToken = await resolveAccessToken(hostIdFromRef);
            // If the host has their own token, re-fetch with the correct token
            if (hostToken !== accessToken) {
              try {
                const hostClient = new MercadoPagoConfig({ accessToken: hostToken, options: { timeout: 10000 } });
                const refetched = await new Payment(hostClient).get({ id: String(paymentId) });
                if (refetched) paymentInfo = refetched;
              } catch (refetchErr: any) {
                console.warn(`Re-fetch with host token failed, using default:`, refetchErr?.message);
              }
            }
          }

          await handlePaymentConfirmation(paymentInfo);
        }
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(200).send('OK'); // Always return 200 so MP doesn't retry infinitely on internal error
    }
  });

  // 3. Return Verification Endpoint (Used on /pagamento/sucesso)
  app.get("/api/verify-payment", async (req, res) => {
    try {
      const paymentId = req.query.payment_id as string;
      const hostId = req.query.hostId as string;
      const externalRef = req.query.external_reference as string;

      if (!paymentId) {
        return res.status(400).json({ error: "Missing payment_id" });
      }

      const accessToken = await resolveAccessToken(hostId);
      const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
      const paymentClient = new Payment(client);

      const paymentInfo = await paymentClient.get({ id: paymentId });
      if (paymentInfo) {
        await handlePaymentConfirmation(paymentInfo);
        return res.json({ 
          success: true, 
          status: paymentInfo.status, 
          method: paymentInfo.payment_method_id,
          amount: paymentInfo.transaction_amount,
          date: paymentInfo.date_approved || paymentInfo.date_created
        });
      }

      res.status(404).json({ error: "Payment not found" });
    } catch (err: any) {
      console.error("Error verifying payment:", err);
      res.status(500).json({ error: "Verification failed", details: err?.message || err });
    }
  });

  // Helper to get alternate host id (slug or uuid)
  async function resolveHostIds(hostId: string): Promise<{ id: string, alternate?: string }> {
    if (!hostId || hostId === 'default' || hostId === 'all') return { id: hostId };
    if (!supabase) return { id: hostId };

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hostId);
      if (isUuid) {
        const { data } = await supabase.from('event_details').select('slug').eq('host_id', hostId).maybeSingle();
        if (data?.slug) return { id: hostId, alternate: data.slug };
      } else {
        const { data } = await supabase.from('event_details').select('host_id').eq('slug', hostId).maybeSingle();
        if (data?.host_id) return { id: hostId, alternate: data.host_id };
      }
    } catch (e) {
      // ignore
    }
    return { id: hostId };
  }

  // 4. API to fetch stored transactions for host
  app.get("/api/transactions", async (req, res) => {
    const hostId = (req.query.hostId as string) || 'default';
    const { id, alternate } = await resolveHostIds(hostId);
    const txs = getStoredTransactions(id, alternate);
    res.json(txs);
  });

  // 5. API to fetch active reservations and stock deductions
  app.get("/api/reservations", async (req, res) => {
    const hostId = (req.query.hostId as string) || 'default';
    cleanExpiredReservations();
    const { id, alternate } = await resolveHostIds(hostId);
    const reservations = getStoredReservations(id, alternate);
    const deductions = getStockDeductions();
    res.json({ reservations, deductions });
  });

  // 6. API to manually release a 24h reservation
  app.post("/api/reservations/release", (req, res) => {
    const { reservationId, hostId } = req.body;
    if (!reservationId) return res.status(400).json({ error: "Missing reservationId" });

    const success = releaseReservation(reservationId, hostId);
    res.json({ success });
  });

  // 7. API to sync live approved payments directly from Mercado Pago
  app.post("/api/sync-mercadopago-payments", async (req, res) => {
    try {
      const { hostId = 'default' } = req.body;
      const accessToken = await resolveAccessToken(hostId);

      if (!accessToken) {
        return res.status(400).json({ error: "No Mercado Pago Access Token configured" });
      }

      const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
      const paymentClient = new Payment(client);

      const searchResult = await paymentClient.search({
        options: {
          sort: 'date_created',
          criteria: 'desc',
          limit: 50,
          begin_date: 'NOW-30DAYS',
          end_date: 'NOW'
        }
      });

      const results = searchResult.results || [];
      let importedCount = 0;

      const { id: resolvedId, alternate } = await resolveHostIds(hostId);

      for (const p of results) {
        if (p.status === 'approved') {
          const extRef = (p.external_reference || '').trim();
          let itemHostId = p.metadata?.host_id || '';
          let giftId = p.metadata?.gift_id || '';

          if (extRef && extRef.includes(':')) {
            const parts = extRef.split(':');
            if (parts.length >= 2) {
              if (!itemHostId) itemHostId = parts[0];
              if (!giftId) giftId = parts[1];
            }
          }

          // STRICT CHECK: Discard personal purchases, Mercado Livre, POTS, bank transfers
          if (!giftId || !itemHostId) continue;
          if (extRef.startsWith('20000') || extRef.startsWith('POTS') || extRef.startsWith('11081')) continue;

          // STRICT HOST ISOLATION: Only import if it belongs to THIS host/account
          const matchesThisHost = (
            itemHostId === hostId ||
            itemHostId === resolvedId ||
            (alternate && itemHostId === alternate) ||
            extRef.startsWith(`${hostId}:`) ||
            extRef.startsWith(`${resolvedId}:`) ||
            (alternate && extRef.startsWith(`${alternate}:`))
          );

          if (!matchesThisHost) continue;

          await handlePaymentConfirmation(p);
          importedCount++;
        }
      }

      const updatedTxs = getStoredTransactions(resolvedId, alternate);
      res.json({ success: true, importedCount, transactions: updatedTxs });
    } catch (err: any) {
      console.error("Error syncing Mercado Pago payments:", err);
      res.status(500).json({ error: "Sync failed", details: err?.message || err });
    }
  });

  // 8. API for guests & RSVP
  app.get("/api/guests", async (req, res) => {
    try {
      const hostId = (req.query.hostId as string) || 'default';
      const { id, alternate } = await resolveHostIds(hostId);
      let guestsList: any[] = [];
      if (supabase) {
        const { data } = await supabase
          .from('guests')
          .select('id, name, status, confirmation_code, host_id')
          .or(`host_id.eq.${id},host_id.eq.${alternate || id}`);
        if (data) guestsList = data;
      }
      res.json(guestsList);
    } catch (e: any) {
      console.warn("Error fetching guests:", e);
      res.json([]);
    }
  });

  app.post("/api/guests", async (req, res) => {
    try {
      const { guestId, name, status } = req.body || {};

      if (guestId && supabase) {
        const payload: any = { status: status || 'Confirmado' };
        if (name) payload.name = name;
        const { data } = await supabase.from('guests').update(payload).eq('id', guestId).select().maybeSingle();
        return res.json({ success: true, guest: data });
      }

      res.status(400).json({ error: "Apenas convidados já cadastrados na lista podem confirmar presença." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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
