const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const cors = require('cors');
const ExcelJS = require('exceljs');
const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const FRONTEND_ROOT = path.join(PROJECT_ROOT, 'Frontend');
const app = express();
const PORT = process.env.PORT || 5000;

const { getConnection } = require('./db');

const AUTH_TOKEN_SECRET =
    process.env.AUTH_TOKEN_SECRET || 'fitness-tracker-secret';

const AUTH_TOKEN_EXPIRY_SECONDS = 60 * 60;

const API_BASE_URL = '';
const MEAL_ORDER = [
  'morning drink',
  'breakfast',
  'lunch',
  '1st snack',
  '2nd snack',
  'dinner'
];

console.log('CWD:', process.cwd());
console.log('DIRNAME:', __dirname);
console.log('PROJECT_ROOT:', PROJECT_ROOT);
console.log('FRONTEND_ROOT:', FRONTEND_ROOT);

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());

app.use('/css', express.static(path.join(__dirname, '..', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'js')));
app.use('/components', express.static(path.join(__dirname, '..', 'components')));


app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, 'html', 'login.html'));
});

app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, 'html', 'reset-password.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, 'html', 'admin.html'));
});

app.get('/fitness-dashboard', (req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, 'html', 'index.html'));
});

app.get('/food-intake', (req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, 'html', 'food-intake.html'));
});

app.get('/food-catalog', (req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, 'html', 'food-catalog.html'));
});

app.get('/food-catalog-browser', (req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, 'html', 'food-catalog-browser.html'));
});

app.get('/day-details', (req, res) => {
    const filePath = path.join(FRONTEND_ROOT, 'day-details.html');

    console.log('DAY DETAILS REQUEST');
    console.log('Query:', req.query);
    console.log('File:', filePath);

    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('SEND FILE ERROR:', err);
            res.status(err.statusCode || 500).end();
        } else {
            console.log('DAY DETAILS PAGE SENT');
        }
    });
});

app.get('/user-details', (req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, 'html', 'user-details.html'));
});

app.get('/index', (req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, 'html', 'index.html'));
});

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
		const adm_flg = isAdmin ? 'Y' : 'N';
		console.log(adm_flg);

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
                adm_flg,
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

async function seedData() {
    const conn = await getConnection();

    try {
        const result = await conn.query(
            `SELECT * FROM custom.app_user WHERE email=$1`,
            ['admin']
        );

        if (result.rows.length === 0) {
			
			const hashPass = hashPassword("manager");
            await conn.query(
                `INSERT INTO custom.app_user
                (user_id, email, password_hash, is_admin, created_date, modified_date)
                VALUES ($1,$2,$3,$4,NOW(),NOW())`,
                [
                    'admin',
                    'admin',
                    hashPass,   // ideally hashed
                    'Y'
                ]
            );
            console.log('Admin user created');
        }

    } finally {
        conn.release();
    }
}

/* =====================================================
   LOGIN
===================================================== */

app.post(`${API_BASE_URL}/api/login`, async (req, res) => {
//app.post(`/api/login`, async (req, res) => {
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
			user: {
                email: user.email,
                isAdmin: user.is_admin === 'Y',
                passwordResetRequired: user.password_reset_required === 'Y'
            }
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

/* ========================
	User Creation
========================== */
app.post(`${API_BASE_URL}/api/users`, async (req, res) => {
    const { email, password, isAdmin } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    let conn;
    try {
        conn = await getConnection();
        const countResult = await conn.query(
            `select count(*) as TOTAL from custom.APP_USER`
        );

        const userCount = Number(countResult.rows?.[0]?.total || 0);
        let authUser = null;
        const authorization = String(req.headers.authorization || '').trim();
        const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
        if (token) {
            const payload = verifyAuthToken(token);
            if (payload && payload.email) {
                authUser = payload;
            }
        }

        if (userCount > 0 && (!authUser || !authUser.isAdmin)) {
            return res.status(403).json({ error: 'Admin access is required to create additional users.' });
        }

        const shouldCreateAdmin = userCount === 0 ? true : Boolean(isAdmin);
        const requiresPasswordReset = userCount > 0;
        await createUser(email, password, shouldCreateAdmin, requiresPasswordReset);

        res.status(201).json({ message: 'User created successfully.', email: String(email).trim().toLowerCase(), isAdmin: shouldCreateAdmin });
    } catch (error) {
        console.error('Error creating user account:', error);
        res.status(500).json({ error: 'Failed to create user account.' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
});

function authenticateRequest(req, res, next) {
    const authorization = String(req.headers.authorization || '').trim();
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
    const payload = verifyAuthToken(token);

    if (!payload || !payload.email) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    req.user = {
        email: String(payload.email).trim().toLowerCase(),
        isAdmin: Boolean(payload.isAdmin)
    };
    next();
}

app.put(`${API_BASE_URL}/api/user/password`, authenticateRequest, async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'New password is required.' });
    }

    try {
        const success = await updateUserPassword(req.user.email, password, false);
        if (!success) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({ message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Error updating user password:', error);
        res.status(500).json({ error: 'Unable to update password.' });
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

app.put(`${API_BASE_URL}/api/food-catalog/:food_id`, async (req, res) => {

    const food_id = Number(req.params.food_id);

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

    if (!Number.isFinite(food_id) || food_id <= 0) {
        return res.status(400).json({
            error: 'A valid food id is required.'
        });
    }

    if (!food_name || !measurement_type || !serving_size || !serving_size_unit) {
        return res.status(400).json({
            error: 'Food name, measurement type, serving size, and serving size unit are required.'
        });
    }

    let conn;

    try {

        conn = await getConnection();

        const result = await conn.query(
            `
            UPDATE custom.food_catalog
            SET
                food_name = $1,
                measurement_type = $2,
                serving_size = $3,
                serving_size_unit = $4,
                calories_per_serving = $5,
                protein_per_serving = $6,
                carbs_per_serving = $7,
                fat_per_serving = $8,
                notes = $9,
                modified_date = NOW()
            WHERE food_id = $10
            `,
            [
                String(food_name).trim(),
                String(measurement_type).toLowerCase(),
                Number(serving_size),
                String(serving_size_unit).toLowerCase(),
                Number(calories_per_serving || 0),
                Number(protein_per_serving || 0),
                Number(carbs_per_serving || 0),
                Number(fat_per_serving || 0),
                notes || null,
                food_id
            ]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                error: 'Food entry not found.'
            });
        }

        res.json({
            message: 'Food updated successfully.'
        });

    } catch (error) {

        console.error('Error updating food catalog entry:', error);

        res.status(500).json({
            error: error.message || 'Failed to update food catalog entry.'
        });

    } finally {

        if (conn) {
            conn.release();
        }
    }
});

app.delete(`${API_BASE_URL}/api/food-catalog/:food_id`, async (req, res) => {

    const food_id = Number(req.params.food_id);

    if (!Number.isFinite(food_id) || food_id <= 0) {
        return res.status(400).json({
            error: 'A valid food id is required.'
        });
    }

    let conn;

    try {

        conn = await getConnection();

        const result = await conn.query(
            `
            DELETE FROM custom.food_catalog
            WHERE food_id = $1
            `,
            [food_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                error: 'Food entry not found.'
            });
        }

        res.json({
            message: 'Food deleted successfully.'
        });

    } catch (error) {

        console.error('Error deleting food catalog entry:', error);

        res.status(500).json({
            error: error.message || 'Failed to delete food catalog entry.'
        });

    } finally {

        if (conn) {
            conn.release();
        }
    }
});

/* =====================================================
   MEAL LOG
===================================================== */

app.post(`${API_BASE_URL}/api/meal-log`, async (req, res) => {

    const conn = await getConnection();

    try {

        const {
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
        } = req.body;

		console.log('POST BODY RECEIVED:', req.body);
		
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
            ]
        );
		
		console.log('INSERT SUCCESS');

        res.json({
            message: 'Meal added'
        });

    } finally {
        conn.release();
    }
});

async function findFoodCatalogById(foodId) {
    let conn;

    try {
        conn = await getConnection();

        const result = await conn.query(
            `
            SELECT 
                food_id,
                food_name,
                measurement_type,
                serving_size,
                serving_size_unit,
                calories_per_serving,
                protein_per_serving,
                carbs_per_serving,
                fat_per_serving,
                notes
            FROM custom.food_catalog
            WHERE food_id = $1
            `,
            [foodId]
        );

        return result.rows[0] || null;
    } finally {
        if (conn) conn.release();
    }
}

function convertToGrams(amount, unit) {
    if (unit === 'g') {
        return amount;
    }

    if (unit === 'kg') {
        return amount * 1000;
    }

    if (unit === 'oz') {
        return amount * 28.3495;
    }

    throw new Error('Unsupported unit. Please use grams, kilograms, or ounces.');
}

function calculateScale(food, quantity, unit) {
    const quantityValue = Number(quantity);

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
        throw new Error('Quantity must be greater than 0.');
    }

    if (String(food.serving_size_unit).toLowerCase() === 'unit') {
        if (normalizeUnit(unit) !== 'unit') {
            throw new Error(`${food.food_name} is set up as a quantity-based food. Please choose "unit" as the measurement.`);
        }

        return quantityValue / Number(food.serving_size);
    }

    if (String(food.serving_size_unit).toLowerCase() === 'ml') {
        if (normalizeUnit(unit) !== 'ml') {
            throw new Error(`${food.food_name} is set up as a volume-based food. Please choose "ml" as the measurement.`);
        }

        return quantityValue / Number(food.serving_size);
    }

    if (normalizeUnit(unit) === 'unit') {
        throw new Error(`${food.food_name} is stored as a weight-based food. Please choose grams, kilograms, or ounces.`);
    }

    if (normalizeUnit(unit) === 'ml') {
        throw new Error(`${food.food_name} is stored as a weight-based food. Please choose grams, kilograms, or ounces.`);
    }

    const grams = convertToGrams(quantityValue, normalizeUnit(unit));
    return grams / Number(food.serving_size);
}

function roundTo(value, digits = 1) {
    return Number(value.toFixed(digits));
}

app.put(`${API_BASE_URL}/api/meal-log/:mealLogId`, authenticateRequest, async (req, res) => {
    const mealLogId = Number(req.params.mealLogId);
    const { quantity, unit } = req.body;

    if (!Number.isFinite(mealLogId) || mealLogId <= 0) {
        return res.status(400).json({ error: 'Valid meal log ID is required.' });
    }

    if (!quantity || !unit) {
        return res.status(400).json({ error: 'Quantity and unit are required.' });
    }

    let conn;

    try {
        conn = await getConnection();

        // Get existing meal log
        const mealResult = await conn.query(
            `
            SELECT food_id
            FROM custom.meal_log
            WHERE meal_log_id = $1
            AND LOWER(user_id) = LOWER($2)
            `,
            [mealLogId, req.user.email]
        );

        if (!mealResult.rows.length) {
            return res.status(404).json({ error: 'Meal log entry not found.' });
        }

        const foodId = mealResult.rows[0].food_id;

        const food = await findFoodCatalogById(foodId);

        if (!food) {
            return res.status(404).json({ error: 'Food entry not found.' });
        }

        // scale calculation
        const scale = calculateScale(food, quantity, unit);

        const newCalories = roundTo(Number(food.calories_per_serving) * scale, 1);
        const newProtein  = roundTo(Number(food.protein_per_serving) * scale, 1);
        const newCarbs    = roundTo(Number(food.carbs_per_serving) * scale, 1);
        const newFat      = roundTo(Number(food.fat_per_serving) * scale, 1);

        await conn.query(
            `
            UPDATE custom.meal_log
            SET 
                quantity = $1,
                unit = $2,
                calories = $3,
                protein = $4,
                carbs = $5,
                fat = $6,
                modified_date = NOW()
            WHERE meal_log_id = $7
            AND LOWER(user_id) = LOWER($8)
            `,
            [
                Number(quantity),
                String(unit).toLowerCase(),
                newCalories,
                newProtein,
                newCarbs,
                newFat,
                mealLogId,
                req.user.email
            ]
        );

        res.json({ message: 'Meal entry updated successfully.' });

    } catch (error) {
        console.error('Error updating meal entry:', error);
        res.status(500).json({ error: error.message || 'Failed to update meal entry.' });

    } finally {
        if (conn) conn.release();
    }
});

app.delete(`${API_BASE_URL}/api/meal-log/:mealLogId`, authenticateRequest, async (req, res) => {
    const mealLogId = Number(req.params.mealLogId);

    if (!Number.isFinite(mealLogId) || mealLogId <= 0) {
        return res.status(400).json({ error: 'Valid meal log ID is required.' });
    }

    let conn;

    try {
        conn = await getConnection();
        
        const result = await conn.query(
            `delete from custom.MEAL_LOG where MEAL_LOG_ID = $1 and lower(USER_ID) = lower($2)`,
            [ mealLogId, req.user.email ]
        );

        res.json({ message: 'Meal entry deleted successfully.' });
    } catch (error) {
        console.error('Error deleting meal entry:', error);
        res.status(500).json({ error: 'Failed to delete meal entry.' });
    } finally {
        if (conn) {
            try {
                await conn.release();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

/* =====================================================
   TRACKER DETAILS
===================================================== */

app.get(`${API_BASE_URL}/api/tracker`, authenticateRequest, async (req, res) => {

    const conn = await getConnection();
	console.log(req.user.email);
	const user_id = req.user.email;

    try {

        const result = await conn.query(
            `
            SELECT *
            FROM custom.meal_log
            WHERE LOWER(user_id)=LOWER($1)
            ORDER BY track_date DESC
            `,
            [user_id]
        );
		
		console.log('TOKEN USER:', req.user);
		console.log('TRACKER QUERY USER:', user_id);
		console.log('TRACKER ROWS:', result.rows.length);
        res.json(result.rows);

    } catch(err) {

        console.error(err);

        res.status(500).json({
            error:'Failed to load tracker data'
        });

    } finally {

        conn.release();
    }
});

app.get('/api/login', (req, res) => {
    res.send('Login API working');
});

/* =====================================================
   DAY DETAILS
===================================================== */

app.get(`/api/day-detail`, async (req, res) => {
    const { date } = req.query;
    const conn = await getConnection();

    try {
        const result = await conn.query(
            `
            SELECT *
            FROM custom.meal_log
            WHERE track_date::date = $1
            AND LOWER(user_id)='admin'
            ORDER BY meal_name
            `,
            [date]
        );

        const rows = result.rows;

        // ---- 1. Calculate totals ----
        const totals = rows.reduce(
            (acc, row) => {
                acc.calories += Number(row.calories || 0);
                acc.protein += Number(row.protein || 0);
                acc.carbs += Number(row.carbs || 0);
                acc.fat += Number(row.fat || 0);
                return acc;
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        // ---- 2. Group by meal ----
        const mealMap = new Map();

        rows.forEach((row) => {
            if (!mealMap.has(row.meal_name)) {
                mealMap.set(row.meal_name, {
                    mealName: row.meal_name,
                    label: row.meal_name.charAt(0).toUpperCase() + row.meal_name.slice(1),
                    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
                    items: []
                });
            }

            const meal = mealMap.get(row.meal_name);

            meal.items.push({
                mealLogId: row.meal_log_id,
                foodName: row.food_name,
                quantity: row.quantity,
                unit: row.unit,
                notes: row.notes,
                calories: row.calories,
                protein: row.protein,
                carbs: row.carbs,
                fat: row.fat
            });

            meal.totals.calories += Number(row.calories || 0);
            meal.totals.protein += Number(row.protein || 0);
            meal.totals.carbs += Number(row.carbs || 0);
            meal.totals.fat += Number(row.fat || 0);
        });

        res.json({
            totals,
            meals: Array.from(mealMap.values())
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Failed to load day details'
        });
    } finally {
        conn.release();
    }
});

app.get(`/api/day-details`, authenticateRequest, async (req, res) => {
    const { date } = req.query;
    const conn = await getConnection();

    try {
        const result = await conn.query(
            `
            SELECT *
            FROM custom.meal_log
            WHERE track_date::date = $1
            AND LOWER(user_id)=LOWER($2)
            ORDER BY meal_name
            `,
            [date, req.user.email]
        );

        const rows = result.rows;

        // ==============================
        // 1. TOTALS (overall day)
        // ==============================
        const totals = rows.reduce(
            (acc, row) => {
                acc.calories += Number(row.calories || 0);
                acc.protein += Number(row.protein || 0);
                acc.carbs += Number(row.carbs || 0);
                acc.fat += Number(row.fat || 0);
                return acc;
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        // ==============================
        // 2. GROUP ROWS BY MEAL
        // ==============================
        const mealMap = new Map();

        rows.forEach((row) => {
            const key = row.meal_name;

            if (!mealMap.has(key)) {
                mealMap.set(key, {
                    mealName: key,
                    label: key.charAt(0).toUpperCase() + key.slice(1),
                    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
                    items: []
                });
            }

            const meal = mealMap.get(key);

            meal.items.push({
                mealLogId: row.meal_log_id,
                foodName: row.food_name,
                quantity: row.quantity,
                unit: row.unit,
                notes: row.notes,
                calories: row.calories,
                protein: row.protein,
                carbs: row.carbs,
                fat: row.fat
            });

            meal.totals.calories += Number(row.calories || 0);
            meal.totals.protein += Number(row.protein || 0);
            meal.totals.carbs += Number(row.carbs || 0);
            meal.totals.fat += Number(row.fat || 0);
        });

        // ==============================
        // 3. NORMALIZE TO FIXED 6 MEALS
        // ==============================
        const meals = MEAL_ORDER.map((mealName) => {
            if (mealMap.has(mealName)) {
                return mealMap.get(mealName);
            }

            return {
                mealName,
                label: mealName
                    .split(' ')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' '),
                totals: {
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fat: 0
                },
                items: []
            };
        });

        // ==============================
        // RESPONSE
        // ==============================
        res.json({
            totals,
            meals
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Failed to load day details'
        });
    } finally {
        conn.release();
    }
});

/* =====================================================
   START SERVER
===================================================== */

(async () => {

    try {

        await initTables();
		await seedData();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (err) {

        console.error('Startup Error:', err);
    }

})();

module.exports = app;