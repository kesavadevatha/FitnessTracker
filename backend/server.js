const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const cors = require('cors');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 5000;

const { getConnection } = require('./db');

const AUTH_TOKEN_SECRET =
    process.env.AUTH_TOKEN_SECRET || 'fitness-tracker-secret';

const AUTH_TOKEN_EXPIRY_SECONDS = 60 * 60;

const API_BASE_URL = '';

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());

app.use('/css', express.static(path.join(__dirname, '..', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'js')));
app.use('/components', express.static(path.join(__dirname, '..', 'components')));

/* =====================================================
   UTILS
===================================================== */

function normalizeUnit(unit) {
    const n = String(unit || 'g').toLowerCase();

    if (['g', 'gram', 'grams'].includes(n)) return 'g';
    if (['kg', 'kilogram', 'kilograms'].includes(n)) return 'kg';
    if (['oz', 'ounce', 'ounces'].includes(n)) return 'oz';
    if (['ml', 'milliliter', 'milliliters'].includes(n)) return 'ml';
    if (['unit', 'units', 'quantity'].includes(n)) return 'unit';

    return n;
}

function normalizeText(v) {
    return String(v || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/* =====================================================
   AUTH
===================================================== */

function hashPassword(password) {
    return crypto
        .pbkdf2Sync(password, 'salt', 100000, 64, 'sha512')
        .toString('hex');
}

function createAuthToken(payload) {
    const header = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'JWT' })
    ).toString('base64url');

    const body = Buffer.from(
        JSON.stringify({
            ...payload,
            exp: Math.floor(Date.now() / 1000) + AUTH_TOKEN_EXPIRY_SECONDS
        })
    ).toString('base64url');

    const signature = crypto
        .createHmac('sha256', AUTH_TOKEN_SECRET)
        .update(`${header}.${body}`)
        .digest('base64url');

    return `${header}.${body}.${signature}`;
}

function verifyAuthToken(token) {
    if (!token) return null;

    const parts = token.split('.');

    if (parts.length !== 3) return null;

    const [h, b, s] = parts;

    const expected = crypto
        .createHmac('sha256', AUTH_TOKEN_SECRET)
        .update(`${h}.${b}`)
        .digest('base64url');

    if (expected !== s) return null;

    try {
        const payload = JSON.parse(
            Buffer.from(b, 'base64url').toString()
        );

        if (payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

/* =====================================================
   DB HELPERS
===================================================== */

async function findUserByEmail(email) {
    const conn = await getConnection();

    try {
        const result = await conn.query(
            `
            SELECT *
            FROM custom.app_user
            WHERE LOWER(user_id) = LOWER($1)
            `,
            [email]
        );

        return result.rows[0] || null;
    } finally {
        conn.release();
    }
}

async function createUser(email, password, isAdmin = false, reset = false) {
    const conn = await getConnection();

    try {
        const hash = hashPassword(password);

        await conn.query(
            `
            INSERT INTO custom.app_user
            (
                user_id,
                email,
                password_hash,
                is_admin,
                password_reset_required,
                created_date,
                modified_date
            )
            VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
            `,
            [
                email.toLowerCase(),
                email.toLowerCase(),
                hash,
                isAdmin ? 'Y' : 'N',
                reset ? 'Y' : 'N'
            ]
        );
    } finally {
        conn.release();
    }
}

async function updateUserPassword(email, password, reset = false) {
    const conn = await getConnection();

    try {
        const hash = hashPassword(password);

        const result = await conn.query(
            `
            UPDATE custom.app_user
            SET
                password_hash = $1,
                password_reset_required = $2,
                modified_date = NOW()
            WHERE LOWER(user_id) = LOWER($3)
            `,
            [
                hash,
                reset ? 'Y' : 'N',
                email
            ]
        );

        return result.rowCount > 0;
    } finally {
        conn.release();
    }
}

/* =====================================================
   TABLE INIT
===================================================== */

async function initTables() {
    const conn = await getConnection();

    try {

        await conn.query(`
            CREATE SCHEMA IF NOT EXISTS custom;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS custom.app_user (
                user_id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                password_hash TEXT,
                is_admin CHAR(1),
                password_reset_required CHAR(1),
                gender TEXT,
                weight NUMERIC,
                height NUMERIC,
                date_of_birth DATE,
                goal TEXT,
                created_date TIMESTAMP DEFAULT NOW(),
                modified_date TIMESTAMP DEFAULT NOW()
            );
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS custom.food_catalog (
                food_id SERIAL PRIMARY KEY,
                food_name TEXT,
                measurement_type TEXT,
                serving_size NUMERIC,
                serving_size_unit TEXT,
                calories_per_serving NUMERIC,
                protein_per_serving NUMERIC,
                carbs_per_serving NUMERIC,
                fat_per_serving NUMERIC,
                notes TEXT,
                created_date TIMESTAMP DEFAULT NOW(),
                modified_date TIMESTAMP DEFAULT NOW()
            );
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS custom.meal_log (
                meal_log_id SERIAL PRIMARY KEY,
                food_id INT,
                food_name TEXT,
                track_date DATE,
                meal_name TEXT,
                quantity NUMERIC,
                unit TEXT,
                calories NUMERIC,
                protein NUMERIC,
                carbs NUMERIC,
                fat NUMERIC,
                notes TEXT,
                user_id TEXT,
                created_date TIMESTAMP DEFAULT NOW(),
                modified_date TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log('Tables initialized');

    } finally {
        conn.release();
    }
}

/* =====================================================
   LOGIN
===================================================== */

app.post(`${API_BASE_URL}/api/login`, async (req, res) => {

    try {

        const { email, password } = req.body;

        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(401).json({
                error: 'Invalid login'
            });
        }

        const incomingHash = hashPassword(password);

        if (incomingHash !== user.password_hash) {
            return res.status(401).json({
                error: 'Invalid password'
            });
        }

        const token = createAuthToken({
            email: user.user_id,
            isAdmin: user.is_admin === 'Y'
        });

        res.json({
            token,
            user
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Server error'
        });
    }
});

/* =====================================================
   USER
===================================================== */

app.get(`${API_BASE_URL}/api/me`, async (req, res) => {

    try {

        const user = await findUserByEmail(req.query.email);

        res.json(user);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Server error'
        });
    }
});

/* =====================================================
   FOOD CATALOG
===================================================== */

app.get(`${API_BASE_URL}/api/food-catalog`, async (req, res) => {

    const conn = await getConnection();

    try {

        const result = await conn.query(
            `
            SELECT *
            FROM custom.food_catalog
            WHERE $1 = ''
               OR LOWER(food_name)
               LIKE LOWER('%' || $1 || '%')
            ORDER BY food_name
            `,
            [req.query.search || '']
        );

        res.json(result.rows);

    } finally {
        conn.release();
    }
});

app.post(`${API_BASE_URL}/api/food-catalog`, async (req, res) => {

    const conn = await getConnection();

    try {

        const {
            food_name,
            measurement_type,
            serving_size,
            serving_size_unit,
            calories_per_serving,
            protein_per_serving,
            carbs_per_serving,
            fat_per_serving,
            notes
        } = req.body;

        await conn.query(
            `
            INSERT INTO custom.food_catalog
            (
                food_name,
                measurement_type,
                serving_size,
                serving_size_unit,
                calories_per_serving,
                protein_per_serving,
                carbs_per_serving,
                fat_per_serving,
                notes
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            `,
            [
                food_name,
                measurement_type,
                serving_size,
                serving_size_unit,
                calories_per_serving,
                protein_per_serving,
                carbs_per_serving,
                fat_per_serving,
                notes
            ]
        );

        res.json({
            message: 'Food added'
        });

    } finally {
        conn.release();
    }
});

/* =====================================================
   MEAL LOG
===================================================== */

app.post(`${API_BASE_URL}/api/meal-log`, async (req, res) => {

    const conn = await getConnection();

    try {

        const {
            foodId,
            foodName,
            trackDate,
            mealName,
            quantity,
            unit,
            calories,
            protein,
            carbs,
            fat,
            notes,
            userId
        } = req.body;

        await conn.query(
            `
            INSERT INTO custom.meal_log
            (
                food_id,
                food_name,
                track_date,
                meal_name,
                quantity,
                unit,
                calories,
                protein,
                carbs,
                fat,
                notes,
                user_id
            )
            VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            `,
            [
                foodId,
                foodName,
                trackDate,
                mealName,
                quantity,
                unit,
                calories,
                protein,
                carbs,
                fat,
                notes,
                userId
            ]
        );

        res.json({
            message: 'Meal added'
        });

    } finally {
        conn.release();
    }
});

app.get(`${API_BASE_URL}/api/tracker`, async (req, res) => {

    const conn = await getConnection();

    try {

        const result = await conn.query(
            `
            SELECT *
            FROM custom.meal_log
            WHERE LOWER(user_id) = LOWER($1)
            ORDER BY track_date DESC
            `,
            [req.query.userId]
        );

        res.json(result.rows);

    } finally {
        conn.release();
    }
});

app.get('/', (req, res) => {
    res.send('Fitness Tracker Backend Running');
});

/* =====================================================
   START SERVER
===================================================== */

(async () => {

    try {

        await initTables();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (err) {

        console.error('Startup Error:', err);
    }

})();

module.exports = app;