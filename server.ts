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
  cleanExpiredReservations,
  getStoredGuests,
  saveStoredGuests,
  addStoredGuest,
  deleteStoredGuest,
  updateStoredGuestStatus,
  saveStoredPaymentConfig,
  getStoredPaymentConfig,
  createManualPixPendingTransaction,
  approveManualTransactionInStore,
  StoredPublicPaymentConfig
} from './server_store';
import { getCheckoutBreakdown, PaymentChoice, roundCurrency } from './src/lib/paymentFees';

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
        const { id, alternate } = await resolveHostIds(hostId);
        const isUuid = (v?: string) => Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
        const uuid = isUuid(id) ? id : (isUuid(alternate) ? alternate : undefined);

        if (uuid) {
          // Try SECURITY DEFINER RPC first (works even for unauthenticated public guests)
          try {
            const { data: rpcToken } = await supabase.rpc('get_host_access_token', { host_id_param: uuid });
            if (rpcToken && typeof rpcToken === 'string' && rpcToken.trim()) {
              return rpcToken.trim();
            }
          } catch {
            // fallback to direct table query
          }

          const { data: pSettings } = await supabase
            .from('payment_settings')
            .select('gateway_access_token')
            .eq('host_id', uuid)
            .maybeSingle();
          if (pSettings?.gateway_access_token) {
            return pSettings.gateway_access_token;
          }
        }
      } catch (dbErr) {
        console.warn("Could not fetch payment_settings for host:", dbErr);
      }
    }

    return process.env.MERCADO_PAGO_ACCESS_TOKEN || 
           process.env.MP_ACCESS_TOKEN || 
           "APP_USR-5302990072214596-080318-1c8251db5cc695db84a123841599bc20-3587153803";
  }

  // Helper to resolve public-safe payment configuration (never exposes gateway_access_token)
  async function resolvePublicPaymentConfig(hostId: string): Promise<StoredPublicPaymentConfig> {
    const defaultConfig: StoredPublicPaymentConfig = {
      hostId,
      gatewayProvider: 'mercadopago',
      receiverName: '',
      passFeesToBuyer: true,
      pixFeePercent: 0.99,
      cardFeePercent: 4.98,
      enableManualPix: false,
      updatedAt: new Date().toISOString()
    };

    if (!hostId || hostId === 'default') {
      return defaultConfig;
    }

    const { id, alternate } = await resolveHostIds(hostId);
    const stored = getStoredPaymentConfig(id, alternate);
    if (stored) {
      return stored;
    }

    if (supabase) {
      const isUuid = (v?: string) => Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
      const uuid = isUuid(id) ? id : (isUuid(alternate) ? alternate : undefined);
      if (uuid) {
        try {
          const { data: rpcConfig } = await supabase.rpc('get_public_payment_config', { host_id_param: uuid });
          if (rpcConfig && typeof rpcConfig === 'object') {
            return {
              hostId: uuid,
              gatewayProvider: (rpcConfig as any).gatewayProvider || 'mercadopago',
              receiverName: (rpcConfig as any).receiverName || '',
              passFeesToBuyer: (rpcConfig as any).passFeesToBuyer !== false,
              pixFeePercent: Number((rpcConfig as any).pixFeePercent ?? 0.99),
              cardFeePercent: Number((rpcConfig as any).cardFeePercent ?? 4.98),
              enableManualPix: Boolean((rpcConfig as any).enableManualPix),
              pixKeyType: (rpcConfig as any).pixKeyType || undefined,
              pixKey: (rpcConfig as any).pixKey || undefined,
              city: (rpcConfig as any).city || undefined,
              updatedAt: new Date().toISOString()
            };
          }
        } catch {
          // RPC might not exist yet before SQL migration is run
        }
      }
    }

    return defaultConfig;
  }

  // Helper to verify authenticated host user via Supabase JWT
  async function verifyHostAuth(req: express.Request, hostId: string): Promise<boolean> {
    if (!supabase || hostId === 'default') return true;
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    if (!jwt) return false;

    try {
      const { data: { user }, error } = await supabase.auth.getUser(jwt);
      if (error || !user) return false;
      const { id, alternate } = await resolveHostIds(hostId);
      return user.id === hostId || user.id === id || user.id === alternate;
    } catch {
      return false;
    }
  }

  // 0. Public-safe payment configuration API
  app.get("/api/payment-config", async (req, res) => {
    try {
      const hostId = (req.query.hostId as string) || 'default';
      const config = await resolvePublicPaymentConfig(hostId);
      res.json({
        gatewayProvider: config.gatewayProvider,
        receiverName: config.receiverName,
        passFeesToBuyer: config.passFeesToBuyer,
        pixFeePercent: config.pixFeePercent,
        cardFeePercent: config.cardFeePercent,
        enableManualPix: config.enableManualPix,
        ...(config.enableManualPix ? {
          pixKeyType: config.pixKeyType,
          pixKey: config.pixKey,
          city: config.city
        } : {})
      });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to load payment config" });
    }
  });

  app.post("/api/payment-config", async (req, res) => {
    try {
      const {
        hostId,
        gatewayProvider = 'mercadopago',
        receiverName = '',
        passFeesToBuyer = true,
        pixFeePercent = 0.99,
        cardFeePercent = 4.98,
        enableManualPix = false,
        pixKeyType,
        pixKey,
        city
      } = req.body || {};

      if (!hostId) {
        return res.status(400).json({ error: "Missing hostId" });
      }

      const isAuthorized = await verifyHostAuth(req, hostId);
      if (!isAuthorized) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id, alternate } = await resolveHostIds(hostId);
      const cleanPixFee = Math.min(Math.max(Number(pixFeePercent) || 0, 0), 25);
      const cleanCardFee = Math.min(Math.max(Number(cardFeePercent) || 0, 0), 25);

      const saved = saveStoredPaymentConfig(id, {
        gatewayProvider: String(gatewayProvider || 'mercadopago'),
        receiverName: String(receiverName || '').trim(),
        passFeesToBuyer: Boolean(passFeesToBuyer),
        pixFeePercent: cleanPixFee,
        cardFeePercent: cleanCardFee,
        enableManualPix: Boolean(enableManualPix),
        pixKeyType: pixKeyType ? String(pixKeyType) : undefined,
        pixKey: pixKey ? String(pixKey).trim() : undefined,
        city: city ? String(city).trim() : undefined
      }, alternate);

      res.json({ success: true, config: saved });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to save payment config" });
    }
  });

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
        gatewayAccessToken,
        paymentMethod = "any"
      } = req.body;
      
      const accessToken = await resolveAccessToken(hostId, gatewayAccessToken);
      if (!accessToken) {
        return res.status(400).json({ error: "Access token is required" });
      }

      let authoritativeTitle = String(title || "Presente de Casamento");
      let authoritativePrice = Number(price);

      // Check current gift stock and authoritative price if Supabase is connected
      if (supabase && giftId) {
        try {
          const { data: giftData } = await supabase
            .from('gifts')
            .select('id, quantity, title, price')
            .eq('id', giftId)
            .maybeSingle();

          if (giftData) {
            if (giftData.title) authoritativeTitle = giftData.title;
            if (giftData.price !== undefined && giftData.price !== null && Number(giftData.price) > 0) {
              authoritativePrice = Number(giftData.price);
            }

            if (giftData.quantity !== undefined && giftData.quantity !== null) {
              const activeReservations = getActiveReservationsCount(giftId);
              const remaining = Math.max(0, giftData.quantity - activeReservations);
              
              if (remaining <= 0) {
                return res.status(400).json({ 
                  error: "Este presente já está reservado aguardando confirmação de pagamento via Pix (válido por 24h). Caso não seja pago no prazo, voltará a ficar disponível!" 
                });
              }
            }
          }
        } catch (stockErr) {
          console.warn("Error checking gift stock:", stockErr);
        }
      }

      if (!Number.isFinite(authoritativePrice) || authoritativePrice <= 0) {
        return res.status(400).json({ error: "Valor do presente inválido." });
      }

      // Compute fee pass-through based on host settings and selected payment method
      const hostConfig = await resolvePublicPaymentConfig(hostId);
      let normalizedChoice: PaymentChoice | 'any' = 'any';
      if (paymentMethod === 'mp_pix' || paymentMethod === 'pix') normalizedChoice = 'mp_pix';
      else if (paymentMethod === 'mp_card' || paymentMethod === 'card') normalizedChoice = 'mp_card';

      const breakdown = normalizedChoice === 'any'
        ? { netAmount: roundCurrency(authoritativePrice), grossAmount: roundCurrency(authoritativePrice), feeAmount: 0, feePercent: 0 }
        : getCheckoutBreakdown(authoritativePrice, normalizedChoice, {
            passFeesToBuyer: hostConfig.passFeesToBuyer,
            pixFeePercent: hostConfig.pixFeePercent,
            cardFeePercent: hostConfig.cardFeePercent
          });

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
        giftTitle: authoritativeTitle,
        donorName: String(donorName).trim() || "Convidado",
        amount: breakdown.netAmount,
        externalReference: extRef,
        durationHours: 24
      });

      const isHttps = baseUrl.startsWith('https://');
      const isPublicUrl = isHttps && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1');

      const payerObj: any = {
        name: String(donorName).trim() || "Convidado"
      };

      const excludedPaymentTypes: Array<{ id: string }> = [];
      let maxInstallments = 12;

      if (normalizedChoice === 'mp_pix') {
        excludedPaymentTypes.push(
          { id: 'credit_card' },
          { id: 'debit_card' },
          { id: 'prepaid_card' },
          { id: 'ticket' },
          { id: 'atm' }
        );
        maxInstallments = 1;
      } else if (normalizedChoice === 'mp_card') {
        excludedPaymentTypes.push(
          { id: 'bank_transfer' },
          { id: 'ticket' },
          { id: 'atm' }
        );
        maxInstallments = 12;
      }

      const itemTitle = breakdown.feeAmount > 0
        ? `${authoritativeTitle} (inclui taxa de processamento)`
        : authoritativeTitle;

      const result = await preference.create({
        body: {
          items: [
            {
              id: String(giftId || "gift"),
              title: itemTitle,
              quantity: Number(quantity) || 1,
              unit_price: breakdown.grossAmount
            }
          ],
          payer: payerObj,
          back_urls: {
            success: `${baseUrl}/e/${hostId}/pagamento/sucesso`,
            failure: `${baseUrl}/e/${hostId}/pagamento/falha`,
            pending: `${baseUrl}/e/${hostId}/pagamento/pendente`
          },
          payment_methods: {
            installments: maxInstallments,
            excluded_payment_types: excludedPaymentTypes,
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
            donor_message: donorMessage,
            payment_choice: normalizedChoice,
            gift_net_price: breakdown.netAmount,
            gross_amount: breakdown.grossAmount,
            fee_amount: breakdown.feeAmount,
            fee_passed_to_buyer: hostConfig.passFeesToBuyer ? 'true' : 'false'
          }
        }
      });

      res.json({ 
        init_point: result.init_point, 
        preference_id: result.id,
        external_reference: extRef,
        reservation,
        breakdown
      });
    } catch (error: any) {
      console.error("Error creating preference:", error?.message || error);
      res.status(500).json({ error: "Failed to create preference", details: error?.message || error });
    }
  });

  // 1b. API Route for Direct Manual Pix (0% fee)
  app.post("/api/manual-pix", async (req, res) => {
    try {
      const { giftId, giftTitle, price, donorName, hostId = 'default', externalReference } = req.body || {};
      if (!donorName || !String(donorName).trim()) {
        return res.status(400).json({ error: "Nome do presenteador é obrigatório." });
      }

      let authoritativeTitle = String(giftTitle || 'Presente');
      let authoritativePrice = Number(price);

      if (supabase && giftId) {
        try {
          const { data: giftData } = await supabase
            .from('gifts')
            .select('id, quantity, title, price')
            .eq('id', giftId)
            .maybeSingle();

          if (giftData) {
            if (giftData.title) authoritativeTitle = giftData.title;
            if (giftData.price !== undefined && giftData.price !== null && Number(giftData.price) > 0) {
              authoritativePrice = Number(giftData.price);
            }
            if (giftData.quantity !== undefined && giftData.quantity !== null) {
              const activeReservations = getActiveReservationsCount(giftId);
              if (giftData.quantity - activeReservations <= 0) {
                return res.status(400).json({ error: "Este presente já está reservado aguardando confirmação." });
              }
            }
          }
        } catch (err) {
          console.warn("Error validating gift for manual pix:", err);
        }
      }

      if (!Number.isFinite(authoritativePrice) || authoritativePrice <= 0) {
        return res.status(400).json({ error: "Valor do presente inválido." });
      }

      const extRef = externalReference || `${hostId}:${giftId || 'gift'}:manual_${Date.now()}`;
      const tx = createManualPixPendingTransaction({
        hostId,
        giftId: String(giftId || 'gift'),
        giftTitle: authoritativeTitle,
        donorName: String(donorName).trim(),
        amount: roundCurrency(authoritativePrice),
        externalReference: extRef
      });

      if (supabase && hostId && hostId !== 'default') {
        try {
          const { id: rId, alternate } = await resolveHostIds(hostId);
          const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
          const effectiveUuid = isUuid(rId) ? rId : (isUuid(alternate) ? alternate : null);
          if (effectiveUuid) {
            await supabase.from('transactions').insert([{
              host_id: effectiveUuid,
              gift_title: authoritativeTitle,
              gift_id: giftId || null,
              donor_name: String(donorName).trim(),
              amount: roundCurrency(authoritativePrice),
              method: 'Pix Direto',
              status: 'pending',
              external_reference: extRef,
              date: new Date().toISOString()
            }]);
          }
        } catch (supErr) {
          console.warn("Could not record manual pix in Supabase:", supErr);
        }
      }

      res.json({ success: true, transaction: tx, external_reference: extRef });
    } catch (e: any) {
      res.status(500).json({ error: "Falha ao registrar Pix Direto." });
    }
  });

  // 1c. Host approval endpoint for Manual Pix
  app.post("/api/transactions/approve-manual", async (req, res) => {
    try {
      const { hostId, transactionId, externalReference } = req.body || {};
      if (!hostId || (!transactionId && !externalReference)) {
        return res.status(400).json({ error: "Missing hostId or transaction identifier" });
      }

      const isAuthorized = await verifyHostAuth(req, hostId);
      if (!isAuthorized) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const approvedTx = approveManualTransactionInStore(externalReference || transactionId);

      if (supabase && hostId !== 'default') {
        try {
          if (externalReference) {
            await supabase.from('transactions').update({ status: 'approved' }).eq('external_reference', externalReference);
          } else if (transactionId && transactionId.length > 10) {
            await supabase.from('transactions').update({ status: 'approved' }).eq('id', transactionId);
          }

          const giftId = approvedTx?.gift_id;
          if (giftId) {
            const { data: currentGift } = await supabase
              .from('gifts')
              .select('id, quantity')
              .eq('id', giftId)
              .maybeSingle();
            if (currentGift && currentGift.quantity !== undefined && currentGift.quantity > 0) {
              await supabase.from('gifts').update({ quantity: Math.max(0, currentGift.quantity - 1) }).eq('id', giftId);
            }
          }
        } catch (supErr) {
          console.warn("Could not approve manual transaction in Supabase:", supErr);
        }
      }

      res.json({ success: true, transaction: approvedTx });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to approve manual transaction" });
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

    const grossAmount = roundCurrency(Number(paymentInfo.transaction_amount || 0));
    const mpNetReceived = roundCurrency(Number(paymentInfo.transaction_details?.net_received_amount || 0));
    const collectorFeeSum = Array.isArray(paymentInfo.fee_details)
      ? roundCurrency(
          paymentInfo.fee_details
            .filter((f: any) => !f.fee_payer || f.fee_payer === 'collector')
            .reduce((sum: number, f: any) => sum + Number(f.amount || 0), 0)
        )
      : 0;

    const feeAmount = collectorFeeSum > 0
      ? collectorFeeSum
      : (mpNetReceived > 0 && grossAmount > mpNetReceived ? roundCurrency(grossAmount - mpNetReceived) : 0);

    const netAmount = mpNetReceived > 0
      ? mpNetReceived
      : (grossAmount > feeAmount ? roundCurrency(grossAmount - feeAmount) : grossAmount);

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
    // Strip the checkout fee suffix if present so Financeiro shows the clean gift name
    giftTitle = String(giftTitle).replace(/\s*\(inclui taxa de processamento\)$/i, '').trim();

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
        amount: netAmount,
        grossAmount,
        netAmount,
        feeAmount,
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
          const { id: rId, alternate } = await resolveHostIds(hostId);
          const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
          const effectiveUuid = isUuid(rId) ? rId : (isUuid(alternate) ? alternate : null);

          if (effectiveUuid) {
            // Check if already recorded (by payment_id OR external_reference)
            let existingTx: any = null;
            if (paymentId) {
              const { data } = await supabase
                .from('transactions')
                .select('id, status')
                .eq('payment_id', paymentId)
                .maybeSingle();
              existingTx = data;
            }
            if (!existingTx && externalReference) {
              const { data } = await supabase
                .from('transactions')
                .select('id, status')
                .eq('external_reference', externalReference)
                .maybeSingle();
              existingTx = data;
            }

            const txDate = paymentInfo.date_approved || paymentInfo.date_created || new Date().toISOString();

            if (!existingTx) {
              await supabase.from('transactions').insert([{
                host_id: effectiveUuid,
                gift_title: giftTitle,
                gift_id: giftId || null,
                donor_name: donorName,
                amount: netAmount,
                method: methodFriendly,
                status: 'approved',
                payment_id: paymentId,
                external_reference: externalReference || null,
                date: txDate
              }]);
            } else {
              // Upgrade existing record to approved
              await supabase.from('transactions')
                .update({
                  status: 'approved',
                  method: methodFriendly,
                  amount: netAmount,
                  payment_id: paymentId,
                  donor_name: donorName,
                  gift_title: giftTitle,
                  date: txDate
                })
                .eq('id', existingTx.id);
            }
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
        const grossAmount = roundCurrency(Number(paymentInfo.transaction_amount || 0));
        const netAmount = roundCurrency(Number(paymentInfo.transaction_details?.net_received_amount || grossAmount));
        return res.json({ 
          success: true, 
          status: paymentInfo.status, 
          method: paymentInfo.payment_method_id,
          amount: grossAmount,
          netAmount,
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
      const { hostId = 'default', gatewayAccessToken } = req.body;
      const accessToken = await resolveAccessToken(hostId, gatewayAccessToken);

      if (!accessToken) {
        return res.status(400).json({ error: "No Mercado Pago Access Token configured" });
      }

      const client = new MercadoPagoConfig({ accessToken, options: { timeout: 15000 } });
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
          if (extRef.startsWith('20000') || extRef.startsWith('POTS') || extRef.startsWith('11081') || extRef.startsWith('ML')) continue;

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

      // 1. Check Supabase (if available and authenticated)
      if (supabase) {
        try {
          const authHeader = req.headers.authorization;
          const client = authHeader ? createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '', {
            global: { headers: { Authorization: authHeader } }
          }) : supabase;

          const { data } = await client
            .from('guests')
            .select('id, name, status, confirmation_code, host_id')
            .or(`host_id.eq.${id},host_id.eq.${alternate || id}`);
          if (data && data.length > 0) {
            guestsList = data.map(g => ({
              id: g.id,
              name: g.name,
              status: g.status,
              confirmationCode: g.confirmation_code
            }));
          }
        } catch (dbErr) {
          console.warn("Could not query guests from Supabase:", dbErr);
        }
      }

      // 2. Merge with server store (ensures guests are always found even if unauthenticated)
      const storedGuests = getStoredGuests(id, alternate);
      if (storedGuests && storedGuests.length > 0) {
        storedGuests.forEach(sg => {
          const exists = guestsList.some(g => g.id === sg.id || g.name.toLowerCase() === sg.name.toLowerCase());
          if (!exists) {
            guestsList.push({
              id: sg.id,
              name: sg.name,
              status: sg.status,
              confirmationCode: sg.confirmation_code
            });
          }
        });
      }

      res.json(guestsList);
    } catch (e: any) {
      console.warn("Error fetching guests:", e);
      res.json([]);
    }
  });

  // Sync guests from admin host dashboard to persistent backend
  app.post("/api/guests/sync", async (req, res) => {
    try {
      const { hostId, guests } = req.body || {};
      if (hostId && Array.isArray(guests)) {
        const { id, alternate } = await resolveHostIds(hostId);
        saveStoredGuests(id, guests);
        if (alternate && alternate !== id) {
          saveStoredGuests(alternate, guests);
        }
        return res.json({ success: true, count: guests.length });
      }
      res.status(400).json({ error: "Invalid payload" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Guest creation, RSVP update, or sync
  app.post("/api/guests", async (req, res) => {
    try {
      const { action, hostId, guestId, name, status, confirmationCode, guest } = req.body || {};

      // 1. Host adding a new guest from dashboard
      if (action === 'add' || (!guestId && name && hostId)) {
        const { id, alternate } = await resolveHostIds(hostId);
        const newId = guestId || (guest && guest.id) || `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const guestObj = {
          id: newId,
          host_id: id,
          name: (name || guest?.name || '').trim(),
          status: status || guest?.status || 'Pendente',
          confirmation_code: confirmationCode || guest?.confirmationCode || Math.random().toString(36).substring(2, 8).toUpperCase()
        };
        addStoredGuest(id, guestObj);
        if (alternate && alternate !== id) {
          addStoredGuest(alternate, guestObj);
        }
        return res.json({ success: true, guest: guestObj });
      }

      // 2. Host deleting a guest
      if (action === 'delete' && guestId) {
        deleteStoredGuest(guestId);
        return res.json({ success: true });
      }

      // 3. RSVP confirmation submission (by guest on public page or host)
      if (guestId) {
        const targetStatus = status || 'Confirmado';
        updateStoredGuestStatus(guestId, targetStatus, name);

        if (supabase) {
          try {
            const payload: any = { status: targetStatus };
            if (name) payload.name = name;
            await supabase.from('guests').update(payload).eq('id', guestId);
          } catch (supErr) {
            console.warn("Supabase guest update warning:", supErr);
          }
        }

        return res.json({ success: true });
      }

      return res.status(400).json({ error: "Apenas convidados já cadastrados na lista podem confirmar presença." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/guests", (req, res) => {
    try {
      const guestId = (req.query.id || req.body?.id) as string;
      if (guestId) {
        deleteStoredGuest(guestId);
        return res.json({ success: true });
      }
      res.status(400).json({ error: "Missing guestId" });
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
