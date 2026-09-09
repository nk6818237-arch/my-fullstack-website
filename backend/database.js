const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const databasePath = process.env.DATABASE_PATH
    ? path.resolve(__dirname, process.env.DATABASE_PATH)
    : path.join(__dirname, 'falsequote.sqlite');
const database = new DatabaseSync(databasePath);

database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
database.exec(`
    CREATE TABLE IF NOT EXISTS payment_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paymentRequestId TEXT NOT NULL UNIQUE,
        quotationNumber TEXT NOT NULL,
        clientName TEXT NOT NULL DEFAULT '',
        userId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        amount INTEGER NOT NULL DEFAULT 30 CHECK (amount >= 30 AND amount <= 1030 AND amount % 10 = 0),
        upiId TEXT NOT NULL DEFAULT 'nk6818237@oksbi' CHECK (upiId = 'nk6818237@oksbi'),
        documentType TEXT NOT NULL DEFAULT 'quotation' CHECK (documentType IN ('quotation', 'invoice')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        approvedAt TEXT,
        rejectedAt TEXT,
        approvedBy TEXT,
        rejectedBy TEXT,
        rejectionReason TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_payment_requests_quotation_pending
        ON payment_requests (quotationNumber, status);
    CREATE INDEX IF NOT EXISTS idx_payment_requests_status
        ON payment_requests (status, createdAt);
    CREATE TABLE IF NOT EXISTS admin_device_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        adminId TEXT NOT NULL DEFAULT 'admin',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        lastSeenAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feedback_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL CHECK (category IN ('report', 'feature')),
        name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        details TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'closed')),
        createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_submissions_created
        ON feedback_submissions (createdAt DESC);
`);

const paymentSchema = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'payment_requests'"
).get()?.sql || '';
if (paymentSchema && (!paymentSchema.includes("CHECK (documentType IN ('quotation', 'invoice'))") || !paymentSchema.includes('amount >= 30'))) {
    database.exec(`
        BEGIN;
        ALTER TABLE payment_requests RENAME TO payment_requests_legacy;
        CREATE TABLE payment_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paymentRequestId TEXT NOT NULL UNIQUE,
            quotationNumber TEXT NOT NULL,
            clientName TEXT NOT NULL DEFAULT '',
            userId TEXT NOT NULL,
            sessionId TEXT NOT NULL,
            amount INTEGER NOT NULL DEFAULT 30 CHECK (amount >= 30 AND amount <= 1030 AND amount % 10 = 0),
            upiId TEXT NOT NULL DEFAULT 'nk6818237@oksbi' CHECK (upiId = 'nk6818237@oksbi'),
            documentType TEXT NOT NULL DEFAULT 'quotation' CHECK (documentType IN ('quotation', 'invoice')),
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            approvedAt TEXT,
            rejectedAt TEXT,
            approvedBy TEXT,
            rejectedBy TEXT,
            rejectionReason TEXT
        );
        INSERT INTO payment_requests (id, paymentRequestId, quotationNumber, clientName, userId, sessionId, amount, upiId, documentType, status, createdAt, updatedAt, approvedAt, rejectedAt, approvedBy, rejectedBy, rejectionReason)
        SELECT id, paymentRequestId, quotationNumber, clientName, userId, sessionId, amount, upiId, documentType, status, createdAt, updatedAt, approvedAt, rejectedAt, approvedBy, rejectedBy, rejectionReason
        FROM payment_requests_legacy;
        DROP TABLE payment_requests_legacy;
        COMMIT;
    `);
}

for (const column of [
    ['razorpayOrderId', 'TEXT'],
    ['razorpayPaymentId', 'TEXT'],
    ['razorpaySignature', 'TEXT'],
    ['paidAt', 'TEXT']
]) {
    try {
        database.exec(`ALTER TABLE payment_requests ADD COLUMN ${column[0]} ${column[1]}`);
    } catch (error) {
        if (!String(error.message).includes('duplicate column name')) throw error;
    }
}

database.exec(`
    CREATE INDEX IF NOT EXISTS idx_payment_requests_razorpay_order
        ON payment_requests (razorpayOrderId);
    CREATE INDEX IF NOT EXISTS idx_payment_requests_razorpay_payment
        ON payment_requests (razorpayPaymentId);
`);

module.exports = database;
