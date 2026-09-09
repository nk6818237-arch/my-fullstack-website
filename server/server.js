const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const database = require('./database');

const port = Number(process.env.PORT) || 3000;
const PAYMENT_UPI_ID = 'nk6818237@oksbi';
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const adminSessions = new Map();
const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    : null;

function now() {
    return new Date().toISOString();
}

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function requireText(value, fieldName, maxLength = 500) {
    if (typeof value !== 'string' || !value.trim()) {
        throw createError(`${fieldName} is required.`, 400);
    }
    const text = value.trim();
    if (text.length > maxLength) {
        throw createError(`${fieldName} is too long.`, 400);
    }
    return text;
}

function optionalText(value, maxLength = 500) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function valuesMatch(expected, provided) {
    if (typeof expected !== 'string' || typeof provided !== 'string') return false;
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    return expectedBuffer.length === providedBuffer.length
        && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function getPaymentRequest(paymentRequestId) {
    return database.prepare(
        'SELECT * FROM payment_requests WHERE paymentRequestId = ?'
    ).get(paymentRequestId);
}

function getPaymentRequestByOrderId(orderId) {
    return database.prepare(
        'SELECT * FROM payment_requests WHERE razorpayOrderId = ?'
    ).get(orderId);
}

function calculatePaymentAmount(pageCount) {
    const pages = Number(pageCount);
    if (!Number.isInteger(pages) || pages < 1 || pages > 100) {
        throw createError('A valid PDF page count between 1 and 100 is required.', 400);
    }
    return 30 + Math.max(0, pages - 2) * 10;
}

function paymentResponse(paymentRequest) {
    return {
        paymentRequestId: paymentRequest.paymentRequestId,
        amount: paymentRequest.amount,
        documentType: paymentRequest.documentType,
        status: paymentRequest.status,
        paidAt: paymentRequest.paidAt || null
    };
}

function approvePayment(paymentRequest, paymentId, signature, source) {
    if (paymentRequest.status === 'approved') {
        if (paymentRequest.razorpayPaymentId && paymentRequest.razorpayPaymentId !== paymentId) {
            throw createError('This payment order has already been completed.', 409);
        }
        return getPaymentRequest(paymentRequest.paymentRequestId);
    }

    const timestamp = now();
    database.prepare(`
        UPDATE payment_requests
        SET status = 'approved', razorpayPaymentId = ?, razorpaySignature = COALESCE(?, razorpaySignature),
            paidAt = ?, approvedAt = ?, updatedAt = ?, approvedBy = ?
        WHERE paymentRequestId = ?
    `).run(paymentId, signature, timestamp, timestamp, timestamp, source, paymentRequest.paymentRequestId);
    return getPaymentRequest(paymentRequest.paymentRequestId);
}

function configuredOrigins() {
    return (process.env.CORS_ORIGIN || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
}

function isAllowedOrigin(request) {
    const origin = request.get('origin');
    if (!origin || origin === 'null') return true;
    const requestOrigin = `${request.protocol}://${request.get('host')}`;
    const origins = configuredOrigins();
    return origin === requestOrigin || origins.includes('*') || origins.includes(origin);
}

function enforceAllowedOrigin(request, response, next) {
    if (isAllowedOrigin(request)) return next();
    return response.status(403).json({ error: 'This origin is not allowed to use the API.' });
}

function serveFrontendFiles(request, response, next) {
    const firstPathSegment = decodeURIComponent(request.path).split('/').filter(Boolean)[0] || '';
    if (firstPathSegment === 'server' || firstPathSegment === 'node_modules' || firstPathSegment.startsWith('.')) {
        return response.status(404).json({ error: 'Route not found.' });
    }
    return next();
}

function getAccessToken(request) {
    const authorization = request.get('authorization') || '';
    const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    return bearerToken || request.get('x-admin-key') || '';
}

function clearExpiredAdminSessions() {
    const timestamp = Date.now();
    for (const [token, expiresAt] of adminSessions.entries()) {
        if (expiresAt <= timestamp) adminSessions.delete(token);
    }
}

function requireAdmin(request, response, next) {
    const token = getAccessToken(request);
    const adminApiKey = process.env.ADMIN_API_KEY || '';
    if (adminApiKey && valuesMatch(adminApiKey, token)) return next();

    clearExpiredAdminSessions();
    if (token && adminSessions.has(token)) return next();
    return response.status(401).json({ error: 'Admin authentication is required.' });
}

function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    app.use(enforceAllowedOrigin);
    app.use(cors({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
    }));

    // Razorpay signs the unmodified request body, so this route must run before JSON parsing.
    app.post('/api/razorpay/webhook', express.raw({ type: 'application/json', limit: '128kb' }), (request, response, next) => {
        try {
            const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
            if (!webhookSecret) return response.status(503).json({ error: 'Razorpay webhook is not configured.' });

            const signature = request.get('x-razorpay-signature') || '';
            const rawBody = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : '';
            const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
            if (!signature || !rawBody || !valuesMatch(expectedSignature, signature)) {
                return response.status(400).json({ error: 'Webhook signature verification failed.' });
            }

            const event = JSON.parse(rawBody);
            if (!['payment.captured', 'order.paid'].includes(event.event)) {
                return response.status(200).json({ received: true, ignored: true });
            }

            const payment = event.payload?.payment?.entity;
            const orderId = payment?.order_id || event.payload?.order?.entity?.id;
            if (!payment?.id || !orderId) {
                return response.status(200).json({ received: true, ignored: true });
            }

            const paymentRequest = getPaymentRequestByOrderId(orderId);
            if (!paymentRequest) return response.status(200).json({ received: true, ignored: true });
            if (payment.amount !== paymentRequest.amount * 100 || payment.currency !== 'INR') {
                return response.status(400).json({ error: 'Webhook payment amount does not match the order.' });
            }

            approvePayment(paymentRequest, payment.id, null, 'razorpay-webhook');
            return response.status(200).json({ received: true });
        } catch (error) {
            return next(error);
        }
    });

    app.use(express.json({ limit: '32kb' }));
    app.use('/app', serveFrontendFiles, express.static(path.resolve(__dirname, '..'), { dotfiles: 'deny' }));

    app.get('/', (request, response) => {
        response.type('html').send(`<!doctype html>
            <html lang="en">
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FalseQuote API</title></head>
            <body style="font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 20px;color:#172033">
                <h1>FalseQuote API is running</h1>
                <p>The payment and feedback backend is online.</p>
                <ul>
                    <li><a href="/api/health">Health check</a></li>
                    <li>Admin dashboard: <a href="/app/admin-dashboard.html">open dashboard</a></li>
                    <li>Razorpay orders and feedback are available through protected API routes.</li>
                </ul>
            </body>
            </html>`);
    });

    app.get('/api/health', (request, response) => {
        response.json({
            ok: true,
            razorpayConfigured: Boolean(razorpay),
            webhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)
        });
    });

    app.get('/api/razorpay/config', (request, response) => {
        response.json({ configured: Boolean(razorpay), keyId: process.env.RAZORPAY_KEY_ID || '' });
    });

    app.post('/api/admin/login', (request, response, next) => {
        try {
            const loginSecret = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY || '';
            const password = typeof request.body?.password === 'string' ? request.body.password : '';
            if (!loginSecret) return response.status(503).json({ error: 'Admin login is not configured on the server.' });
            if (!valuesMatch(loginSecret, password)) return response.status(403).json({ error: 'Invalid admin password.' });

            clearExpiredAdminSessions();
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
            adminSessions.set(token, expiresAt);
            return response.json({ token, expiresAt: new Date(expiresAt).toISOString() });
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/admin/logout', requireAdmin, (request, response) => {
        adminSessions.delete(getAccessToken(request));
        response.status(204).end();
    });

    app.post('/api/feedback', (request, response, next) => {
        try {
            const category = request.body?.category === 'feature' ? 'feature' : request.body?.category === 'report' ? 'report' : '';
            if (!category) return response.status(400).json({ error: 'A valid feedback category is required.' });
            const title = requireText(request.body?.title, 'title', 140);
            const details = requireText(request.body?.details, 'details', 4000);
            const name = optionalText(request.body?.name, 100);
            const email = optionalText(request.body?.email, 180);
            const createdAt = now();
            const result = database.prepare('INSERT INTO feedback_submissions (category, name, email, title, details, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(category, name, email, title, details, createdAt);
            response.status(201).json({ id: result.lastInsertRowid, createdAt });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/feedback', (request, response, next) => {
        try {
            const submissions = database.prepare('SELECT * FROM feedback_submissions ORDER BY createdAt DESC LIMIT 100').all();
            response.json({ submissions });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/razorpay/orders', async (request, response, next) => {
        try {
            if (!razorpay) return response.status(503).json({ error: 'Razorpay is not configured on the server yet.' });
            const quotationNumber = requireText(request.body?.quotationNumber, 'quotationNumber', 100);
            const documentType = request.body?.documentType === 'invoice' ? 'invoice' : 'quotation';
            const pageCount = Number(request.body?.pageCount);
            const paymentAmount = calculatePaymentAmount(pageCount);
            const clientName = optionalText(request.body?.clientName, 100);
            const sessionId = optionalText(request.body?.sessionId, 120) || crypto.randomUUID();
            const userId = optionalText(request.body?.userId, 120) || `anonymous-${crypto.randomUUID()}`;
            const paymentRequestId = `FQ-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
            const order = await razorpay.orders.create({
                amount: paymentAmount * 100,
                currency: 'INR',
                receipt: paymentRequestId,
                notes: { quotationNumber, documentType, pageCount: String(pageCount) }
            });
            const timestamp = now();
            const paymentRequest = {
                paymentRequestId,
                quotationNumber,
                clientName,
                userId,
                sessionId,
                amount: paymentAmount,
                upiId: PAYMENT_UPI_ID,
                documentType,
                status: 'pending',
                razorpayOrderId: order.id,
                createdAt: timestamp,
                updatedAt: timestamp
            };
            database.prepare('INSERT INTO payment_requests (paymentRequestId, quotationNumber, clientName, userId, sessionId, amount, upiId, documentType, status, createdAt, updatedAt, razorpayOrderId) VALUES (@paymentRequestId, @quotationNumber, @clientName, @userId, @sessionId, @amount, @upiId, @documentType, @status, @createdAt, @updatedAt, @razorpayOrderId)').run(paymentRequest);
            response.status(201).json({
                keyId: process.env.RAZORPAY_KEY_ID,
                order: { id: order.id, amount: order.amount, currency: order.currency },
                paymentRequest: paymentResponse(paymentRequest)
            });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/razorpay/verify', (request, response, next) => {
        try {
            if (!razorpay) return response.status(503).json({ error: 'Razorpay is not configured on the server yet.' });
            const { paymentRequestId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = request.body || {};
            const requestedId = requireText(paymentRequestId, 'paymentRequestId', 100);
            const paymentRequest = getPaymentRequest(requestedId);
            if (!paymentRequest || paymentRequest.razorpayOrderId !== orderId) {
                return response.status(400).json({ error: 'Payment order does not match this quotation.' });
            }
            const validOrderId = requireText(orderId, 'razorpay_order_id', 100);
            const validPaymentId = requireText(paymentId, 'razorpay_payment_id', 100);
            const providedSignature = requireText(signature, 'razorpay_signature', 200);
            const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(`${validOrderId}|${validPaymentId}`)
                .digest('hex');
            if (!valuesMatch(expectedSignature, providedSignature)) {
                return response.status(400).json({ error: 'Payment signature verification failed.' });
            }

            const approvedPayment = approvePayment(paymentRequest, validPaymentId, providedSignature, 'razorpay-checkout');
            return response.json({ paymentRequest: paymentResponse(approvedPayment) });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/payment-requests/paid', (request, response, next) => {
        try {
            const paymentRequests = database.prepare(`
                SELECT * FROM payment_requests
                WHERE status = 'approved' AND razorpayPaymentId IS NOT NULL
                ORDER BY paidAt DESC, updatedAt DESC
                LIMIT 100
            `).all();
            response.json({ paymentRequests });
        } catch (error) {
            next(error);
        }
    });

    app.use((request, response) => {
        response.status(404).json({ error: 'Route not found.' });
    });

    app.use((error, request, response, next) => {
        if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
            return response.status(400).json({ error: 'Request body must be valid JSON.' });
        }
        const statusCode = Number(error.statusCode) || 500;
        console.error(error);
        return response.status(statusCode).json({
            error: statusCode === 500 ? 'Internal server error.' : error.message
        });
    });

    return app;
}

const app = createApp();

if (require.main === module) {
    app.listen(port, () => {
        console.log(`FalseQuote payment server listening on http://localhost:${port}`);
    });
}

module.exports = { app, createApp };
