const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const app = express();
const PORT = 3000;
const cors = require('cors');
const ExcelJS = require('exceljs');
const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'fitness-tracker-secret';
const AUTH_TOKEN_EXPIRY_SECONDS = 60 * 60;

app.use(cors({
  origin: [""],
  credentials: true
}));
app.use(express.json());
app.use('/css', express.static(path.join(__dirname, '..', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'js')));
app.use('/components', express.static(path.join(__dirname, '..', 'components')));

const { getConnection } = require('./db');
const oracledb = require('oracledb');

function normalizeUnit(unit) {
    const normalized = String(unit || 'g').toLowerCase();

    if (['g', 'gram', 'grams'].includes(normalized)) {
        return 'g';
    }

    if (['kg', 'kilogram', 'kilograms'].includes(normalized)) {
        return 'kg';
    }

    if (['oz', 'ounce', 'ounces'].includes(normalized)) {
        return 'oz';
    }

    if (['ml', 'milliliter', 'milliliters'].includes(normalized)) {
        return 'ml';
    }

    if (['unit', 'units', 'quantity'].includes(normalized)) {
        return 'unit';
    }

    return normalized;
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function base64UrlEncode(value) {
    return Buffer.from(value, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function base64UrlDecode(value) {
    const padded = value.padEnd(value.length + ((4 - value.length % 4) % 4), '=');
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function createAuthToken(payload) {
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64UrlEncode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + AUTH_TOKEN_EXPIRY_SECONDS }));
    const signature = base64UrlEncode(
        crypto
            .createHmac('sha256', AUTH_TOKEN_SECRET)
            .update(`${header}.${body}`)
            .digest('base64')
    );
    return `${header}.${body}.${signature}`;
}

function verifyAuthToken(token) {
    if (!token || typeof token !== 'string') {
        return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        return null;
    }

    const [header, body, signature] = parts;
    const expected = base64UrlEncode(
        crypto
            .createHmac('sha256', AUTH_TOKEN_SECRET)
            .update(`${header}.${body}`)
            .digest('base64')
    );

    if (signature !== expected) {
        return null;
    }

    try {
        const payload = JSON.parse(base64UrlDecode(body));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    } catch (error) {
        return null;
    }
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
    return `pbkdf2$100000$${salt}$${derived}`;
}

function verifyPassword(password, storedHash) {
    if (!storedHash || typeof storedHash !== 'string') {
        return false;
    }

    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
        return false;
    }

    const [, iterations, salt, hash] = parts;
    const derived = crypto.pbkdf2Sync(String(password), salt, Number(iterations), 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

async function findUserByEmail(email) {
    let connection;

    try {
        connection = await getConnection();
        const result = await connection.execute(
            `select USER_ID, EMAIL, PASSWORD_HASH, IS_ADMIN, PASSWORD_RESET_REQUIRED, GENDER, WEIGHT, HEIGHT, DATE_OF_BIRTH, GOAL
             from custom.APP_USER
             where lower(USER_ID) = lower(:userId)`,
            { userId: String(email).trim() },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return result.rows && result.rows.length ? result.rows[0] : null;
    } catch (error) {
        console.error('Error finding user by email:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
}

async function createUser(email, password, isAdmin = false, passwordResetRequired = false) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const passwordHash = hashPassword(password);
    let connection;

    try {
        connection = await getConnection();
        await connection.execute(
            `insert into custom.APP_USER
             (USER_ID, EMAIL, PASSWORD_HASH, IS_ADMIN, PASSWORD_RESET_REQUIRED, CREATED_DATE, MODIFIED_DATE)
             values (:userId, :email, :passwordHash, :isAdmin, :passwordResetRequired, SYSDATE, SYSDATE)`,
            {
                userId: normalizedEmail,
                email: normalizedEmail,
                passwordHash,
                isAdmin: isAdmin ? 'Y' : 'N',
                passwordResetRequired: passwordResetRequired ? 'Y' : 'N'
            },
            { autoCommit: true }
        );
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
}

async function updateUserPassword(email, password, passwordResetRequired = false) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const passwordHash = hashPassword(password);
    let connection;

    try {
        connection = await getConnection();
        const result = await connection.execute(
            `update custom.APP_USER
             set PASSWORD_HASH = :passwordHash,
                 PASSWORD_RESET_REQUIRED = :passwordResetRequired,
                 MODIFIED_DATE = SYSDATE
             where lower(USER_ID) = lower(:userId)`,
            {
                passwordHash,
                passwordResetRequired: passwordResetRequired ? 'Y' : 'N',
                userId: normalizedEmail
            },
            { autoCommit: true }
        );

        return result.rowsAffected > 0;
    } catch (error) {
        console.error('Error updating user password:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
}

async function ensureAppUserTable() {
    let connection;

    try {
        connection = await getConnection();
        await connection.execute(
            `BEGIN
                EXECUTE IMMEDIATE q'[
                    CREATE TABLE custom.APP_USER (
                        USER_ID VARCHAR2(200) PRIMARY KEY,
                        EMAIL VARCHAR2(200) NOT NULL UNIQUE,
                        PASSWORD_HASH VARCHAR2(2000) NOT NULL,
                        IS_ADMIN CHAR(1) DEFAULT 'N' CHECK (IS_ADMIN IN ('Y','N')),
                        PASSWORD_RESET_REQUIRED CHAR(1) DEFAULT 'N' CHECK (PASSWORD_RESET_REQUIRED IN ('Y','N')),
                    GENDER VARCHAR2(50),
                    WEIGHT NUMBER,
                    HEIGHT NUMBER,
                    DATE_OF_BIRTH DATE,
                    GOAL VARCHAR2(50),
                        CREATED_DATE DATE DEFAULT SYSDATE,
                        MODIFIED_DATE DATE DEFAULT SYSDATE
                    ) tablespace users
                ]';
                EXCEPTION
                    WHEN OTHERS THEN
                        IF SQLCODE != -955 THEN
                            RAISE;
                        END IF;
            END;`,
            {},
            { autoCommit: true }
        );
    } catch (error) {
        console.error('Error ensuring APP_USER table exists:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
}

async function ensureAppUserProfileColumns() {
    let connection;

    try {
        connection = await getConnection();
        const statements = [
            `ALTER TABLE custom.APP_USER ADD (GENDER VARCHAR2(50))`,
            `ALTER TABLE custom.APP_USER ADD (WEIGHT NUMBER)`,
            `ALTER TABLE custom.APP_USER ADD (HEIGHT NUMBER)`,
            `ALTER TABLE custom.APP_USER ADD (DATE_OF_BIRTH DATE)`,
            `ALTER TABLE custom.APP_USER ADD (GOAL VARCHAR2(50))`
        ];

        for (const sql of statements) {
            await connection.execute(
                `BEGIN
                    EXECUTE IMMEDIATE q'[${sql}]';
                    EXCEPTION
                        WHEN OTHERS THEN
                            IF SQLCODE != -01430 THEN
                                RAISE;
                            END IF;
                END;`,
                {},
                { autoCommit: true }
            );
        }
    } catch (error) {
        console.error('Error ensuring APP_USER profile columns exist:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
}

async function getAppUserCount() {
    let connection;

    try {
        connection = await getConnection();
        const result = await connection.execute(
            `select count(*) as TOTAL from custom.APP_USER`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return Number(result.rows?.[0]?.TOTAL || 0);
    } catch (error) {
        console.error('Error counting app users:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
}

async function ensureMealLogUserIdColumn() {
    let connection;

    try {
        connection = await getConnection();
        await connection.execute(
            `BEGIN
                EXECUTE IMMEDIATE q'[
                    ALTER TABLE custom.MEAL_LOG ADD (USER_ID VARCHAR2(200))
                ]';
                EXCEPTION
                    WHEN OTHERS THEN
                        IF SQLCODE != -01430 THEN
                            RAISE;
                        END IF;
            END;`,
            {},
            { autoCommit: true }
        );
    } catch (error) {
        console.error('Error ensuring MEAL_LOG USER_ID column exists:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
}

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

function requireAdmin(req, res, next) {
    if (!req.user?.isAdmin) {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
}

function formatOracleDate(value) {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();

        if (!trimmed) {
            return null;
        }

        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            return trimmed.slice(0, 10);
        }

        const parsedValue = new Date(trimmed);

        if (Number.isNaN(parsedValue.getTime())) {
            return null;
        }

        return formatOracleDate(parsedValue);
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return [value.getFullYear(), value.getMonth() + 1, value.getDate()]
            .map((part) => String(part).padStart(2, '0'))
            .join('-');
    }

    return null;
}

const VALID_MEAL_NAMES = ['morning drink', 'breakfast', '1st snack', 'lunch', '2nd snack', 'dinner'];
const MEAL_ORDER = ['morning drink', 'breakfast', '1st snack', 'lunch', '2nd snack', 'dinner'];
const MEAL_DISPLAY_NAMES = {
    'morning drink': 'Morning Drink',
    breakfast: 'Breakfast',
    '1st snack': '1st Snack',
    lunch: 'Lunch',
    '2nd snack': '2nd Snack',
    dinner: 'Dinner'
};

function normalizeMealName(value) {
    const normalized = String(value || '').trim().toLowerCase();

    if (VALID_MEAL_NAMES.includes(normalized)) {
        return normalized;
    }

    return null;
}

function parseFoodInput(foodText, quantity, unit) {
    const rawText = String(foodText || '').trim();
    const quantityValue = Number(quantity);
    const match = rawText.match(/(\d+(?:\.\d+)?)\s*(g|gram|grams|kg|kilogram|kilograms|oz|ounce|ounces|ml|milliliter|milliliters)\b/i);
    const amount = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 100;
    const normalizedUnit = normalizeUnit(unit);

    let query = rawText;

    if (match) {
        query = rawText.replace(match[0], '').replace(/\s+of\s+/i, '').trim();
        if (!query) {
            query = rawText;
        }
    }

    return {
        query: query || rawText,
        amount,
        unit: match ? normalizeUnit(match[2]) : normalizedUnit
    };
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

function findNutrientValue(food, nutrientNames) {
    const nutrients = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];

    for (const nutrientName of nutrientNames) {
        const nutrient = nutrients.find((item) => item?.nutrientName === nutrientName);
        if (nutrient && nutrient.value !== undefined && nutrient.value !== null && !Number.isNaN(Number(nutrient.value))) {
            return Number(nutrient.value);
        }
    }

    return null;
}

function roundTo(value, digits = 1) {
    return Number(value.toFixed(digits));
}

function scoreCatalogMatch(record, query) {
    const normalizedQuery = normalizeText(query);
    const normalizedName = normalizeText(record.FOOD_NAME);
    let score = 0;

    if (normalizedName === normalizedQuery) {
        return 1000;
    }

    if (normalizedName.includes(normalizedQuery)) {
        return 500;
    }

    for (const token of normalizedQuery.split(' ')) {
        if (!token) {
            continue;
        }

        if (normalizedName.includes(token)) {
            score += 40;
        }
    }

    return score;
}

async function ensureFoodCatalogTable() {
    let connection;

    try {
        connection = await getConnection();
        await connection.execute(
            `BEGIN
                EXECUTE IMMEDIATE q'[
                    CREATE TABLE custom.FOOD_CATALOG (
                        FOOD_ID NUMBER GENERATED BY DEFAULT ON NULL AS IDENTITY PRIMARY KEY,
                        FOOD_NAME VARCHAR2(200) NOT NULL,
                        MEASUREMENT_TYPE VARCHAR2(20) NOT NULL CHECK (MEASUREMENT_TYPE IN ('g', 'unit')),
                        SERVING_SIZE NUMBER NOT NULL,
                        SERVING_SIZE_UNIT VARCHAR2(20) NOT NULL CHECK (SERVING_SIZE_UNIT IN ('g', 'unit', 'ml', 'kg', 'oz')),
                        CALORIES_PER_SERVING NUMBER NOT NULL,
                        PROTEIN_PER_SERVING NUMBER NOT NULL,
                        CARBS_PER_SERVING NUMBER NOT NULL,
                        FAT_PER_SERVING NUMBER NOT NULL,
                        NOTES VARCHAR2(2000),
                        CREATED_DATE DATE DEFAULT SYSDATE,
                        MODIFIED_DATE DATE DEFAULT SYSDATE
                    ) tablespace users
                ]';
                EXCEPTION
                    WHEN OTHERS THEN
                        IF SQLCODE != -955 THEN
                            RAISE;
                        END IF;
            END;`,
            {},
            { autoCommit: true }
        );
    } catch (error) {
        console.error('Error ensuring FOOD_CATALOG table exists:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
}

async function ensureMealLogTable() {
    let connection;

    try {
        connection = await getConnection();
        await connection.execute(
            `BEGIN
                EXECUTE IMMEDIATE q'[
                    CREATE TABLE custom.MEAL_LOG (
                        MEAL_LOG_ID NUMBER GENERATED BY DEFAULT ON NULL AS IDENTITY PRIMARY KEY,
                        FOOD_ID NUMBER NOT NULL,
                        FOOD_NAME VARCHAR2(200) NOT NULL,
                        TRACK_DATE DATE NOT NULL,
                        MEAL_NAME VARCHAR2(30) NOT NULL CHECK (MEAL_NAME IN ('morning drink', 'breakfast', '1st snack', 'lunch', '2nd snack', 'dinner')),
                        QUANTITY NUMBER NOT NULL,
                        UNIT VARCHAR2(20) NOT NULL,
                        CALORIES NUMBER NOT NULL,
                        PROTEIN NUMBER NOT NULL,
                        CARBS NUMBER NOT NULL,
                        FAT NUMBER NOT NULL,
                        NOTES VARCHAR2(2000),
                        CREATED_DATE DATE DEFAULT SYSDATE,
                        MODIFIED_DATE DATE DEFAULT SYSDATE
                    ) tablespace users
                ]';
                EXCEPTION
                    WHEN OTHERS THEN
                        IF SQLCODE != -955 THEN
                            RAISE;
                        END IF;
            END;`,
            {},
            { autoCommit: true }
        );
    } catch (error) {
        console.error('Error ensuring MEAL_LOG table exists:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
}

async function migrateServinSizeUnitConstraint() {
    let connection;

    try {
        connection = await getConnection();
        
        // Drop the old constraint if it exists
        try {
            await connection.execute(
                `ALTER TABLE custom.FOOD_CATALOG
                 DROP CONSTRAINT SYS_C0036624`,
                {},
                { autoCommit: true }
            );
            console.log('✓ Dropped old SERVING_SIZE_UNIT constraint');
        } catch (e) {
            // Constraint may already be dropped, continue
            console.log('  Note: Old constraint not found or already dropped');
        }

        // Add the new constraint with updated values
        try {
            await connection.execute(
                `ALTER TABLE custom.FOOD_CATALOG
                 ADD CONSTRAINT SERVING_SIZE_UNIT_CHK
                 CHECK (SERVING_SIZE_UNIT IN ('g', 'unit', 'ml', 'kg', 'oz'))`,
                {},
                { autoCommit: true }
            );
            console.log('✓ Added new SERVING_SIZE_UNIT constraint with ml, kg, oz support');
        } catch (e) {
            // New constraint may already exist, continue
            console.log('✓ SERVING_SIZE_UNIT constraint already updated');
        }
    } catch (error) {
        console.error('Migration error:', error.message);
        // Don't throw - this is a best-effort migration
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
}

async function findFoodCatalogById(foodId) {
    let connection;

    try {
        connection = await getConnection();
        const result = await connection.execute(
            `select FOOD_ID, FOOD_NAME, MEASUREMENT_TYPE, SERVING_SIZE, SERVING_SIZE_UNIT,
                    CALORIES_PER_SERVING, PROTEIN_PER_SERVING, CARBS_PER_SERVING, FAT_PER_SERVING, NOTES
             from custom.FOOD_CATALOG
             where FOOD_ID = :foodId`,
            { foodId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return result.rows[0] || null;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
}

async function findFoodCatalogEntry(query) {
    let connection;

    try {
        connection = await getConnection();
        const result = await connection.execute(
            `select FOOD_ID, FOOD_NAME, MEASUREMENT_TYPE, SERVING_SIZE, SERVING_SIZE_UNIT,
                    CALORIES_PER_SERVING, PROTEIN_PER_SERVING, CARBS_PER_SERVING, FAT_PER_SERVING, NOTES
             from custom.FOOD_CATALOG`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return [...result.rows]
            .map((row) => ({ ...row, matchScore: scoreCatalogMatch(row, query) }))
            .sort((a, b) => b.matchScore - a.matchScore)[0] || null;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
}

function calculateScale(food, quantity, unit) {
    const quantityValue = Number(quantity);

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
        throw new Error('Quantity must be greater than 0.');
    }

    if (String(food.SERVING_SIZE_UNIT).toLowerCase() === 'unit') {
        if (normalizeUnit(unit) !== 'unit') {
            throw new Error(`${food.FOOD_NAME} is set up as a quantity-based food. Please choose "unit" as the measurement.`);
        }

        return quantityValue / Number(food.SERVING_SIZE);
    }

    if (String(food.SERVING_SIZE_UNIT).toLowerCase() === 'ml') {
        if (normalizeUnit(unit) !== 'ml') {
            throw new Error(`${food.FOOD_NAME} is set up as a volume-based food. Please choose "ml" as the measurement.`);
        }

        return quantityValue / Number(food.SERVING_SIZE);
    }

    if (normalizeUnit(unit) === 'unit') {
        throw new Error(`${food.FOOD_NAME} is stored as a weight-based food. Please choose grams, kilograms, or ounces.`);
    }

    if (normalizeUnit(unit) === 'ml') {
        throw new Error(`${food.FOOD_NAME} is stored as a weight-based food. Please choose grams, kilograms, or ounces.`);
    }

    const grams = convertToGrams(quantityValue, normalizeUnit(unit));
    return grams / Number(food.SERVING_SIZE);
}

async function getFoodMacros(foodText, quantity, unit) {
    const { query, amount, unit: parsedUnit } = parseFoodInput(foodText, quantity, unit);
    const food = await findFoodCatalogEntry(query);

    if (!food) {
        throw new Error(`No local food data found for "${query}". Add it from the Food Catalog page first.`);
    }

    const scale = calculateScale(food, amount, parsedUnit);

    return {
        foodName: food.FOOD_NAME,
        source: 'Local food catalog',
        calories: roundTo(Number(food.CALORIES_PER_SERVING) * scale, 1),
        protein: roundTo(Number(food.PROTEIN_PER_SERVING) * scale, 1),
        carbs: roundTo(Number(food.CARBS_PER_SERVING) * scale, 1),
        fat: roundTo(Number(food.FAT_PER_SERVING) * scale, 1),
        note: food.NOTES || `Estimated from ${food.FOOD_NAME} scaled to ${Number(amount).toFixed(1)} ${parsedUnit}.`
    };
}

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

app.get('/index', (req, res) => {
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
    res.sendFile(path.join(PROJECT_ROOT, 'html', 'day-details.html'));
});

app.get('/user-details', (req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, 'html', 'user-details.html'));
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const user = await findUserByEmail(email);
        if (!user || !verifyPassword(password, user.PASSWORD_HASH)) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = createAuthToken({
            email: user.USER_ID,
            isAdmin: user.IS_ADMIN === 'Y'
        });

        res.json({
            token,
            user: {
                email: user.USER_ID,
                isAdmin: user.IS_ADMIN === 'Y',
                passwordResetRequired: user.PASSWORD_RESET_REQUIRED === 'Y'
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Unable to login at the moment.' });
    }
});

app.get('/api/me', authenticateRequest, async (req, res) => {
    try {
        const user = await findUserByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({
            email: user.USER_ID,
            isAdmin: user.IS_ADMIN === 'Y',
            passwordResetRequired: user.PASSWORD_RESET_REQUIRED === 'Y'
        });
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ error: 'Unable to retrieve user details.' });
    }
});

app.get('/api/user/profile', authenticateRequest, async (req, res) => {
    if (req.user.isAdmin) {
        return res.status(403).json({ error: 'Admins cannot access standard user profile.' });
    }

    try {
        const user = await findUserByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({
            email: user.USER_ID,
            gender: user.GENDER || null,
            weight: user.WEIGHT || null,
            height: user.HEIGHT || null,
            dateOfBirth: formatOracleDate(user.DATE_OF_BIRTH),
            goal: user.GOAL || null
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Unable to retrieve profile.' });
    }
});

app.put('/api/user/profile', authenticateRequest, async (req, res) => {
    if (req.user.isAdmin) {
        return res.status(403).json({ error: 'Admins cannot update standard user profile.' });
    }

    const { gender, weight, height, dateOfBirth, goal } = req.body;
    const allowedGoals = ['Fat loss', 'Muscle gain', 'Maintenance'];

    if (gender && typeof gender !== 'string') {
        return res.status(400).json({ error: 'Gender must be text.' });
    }
    if (weight !== undefined && (typeof weight !== 'number' || Number(weight) <= 0)) {
        return res.status(400).json({ error: 'Weight must be a positive number.' });
    }
    if (height !== undefined && (typeof height !== 'number' || Number(height) <= 0)) {
        return res.status(400).json({ error: 'Height must be a positive number.' });
    }
    if (dateOfBirth && typeof dateOfBirth !== 'string') {
        return res.status(400).json({ error: 'Date of birth must be a valid date string.' });
    }
    if (goal && !allowedGoals.includes(goal)) {
        return res.status(400).json({ error: 'Goal must be one of Fat loss, Muscle gain, or Maintenance.' });
    }

    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `update custom.APP_USER
             set GENDER = :gender,
                 WEIGHT = :weight,
                 HEIGHT = :height,
                 DATE_OF_BIRTH = to_date(:dateOfBirth, 'YYYY-MM-DD'),
                 GOAL = :goal,
                 MODIFIED_DATE = SYSDATE
             where lower(USER_ID) = lower(:userId)`,
            {
                gender: gender || null,
                weight: weight !== undefined ? Number(weight) : null,
                height: height !== undefined ? Number(height) : null,
                dateOfBirth: dateOfBirth || null,
                goal: goal || null,
                userId: req.user.email
            },
            { autoCommit: true }
        );

        res.json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'Unable to update profile.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

app.post('/api/users', async (req, res) => {
    const { email, password, isAdmin } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    let connection;
    try {
        connection = await getConnection();
        const countResult = await connection.execute(
            `select count(*) as TOTAL from custom.APP_USER`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const userCount = Number(countResult.rows?.[0]?.TOTAL || 0);
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
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

app.get('/api/admin/users', authenticateRequest, requireAdmin, async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const search = String(req.query.search || '').trim();
        const result = await connection.execute(
            `select USER_ID, EMAIL, IS_ADMIN, PASSWORD_RESET_REQUIRED, CREATED_DATE, MODIFIED_DATE
             from custom.APP_USER
             where lower(EMAIL) like '%' || lower(:search) || '%'
             order by EMAIL`,
            { search },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json(result.rows.map((row) => ({
            email: row.EMAIL,
            isAdmin: row.IS_ADMIN === 'Y',
            passwordResetRequired: row.PASSWORD_RESET_REQUIRED === 'Y',
            createdDate: formatOracleDate(row.CREATED_DATE),
            modifiedDate: formatOracleDate(row.MODIFIED_DATE)
        })));
    } catch (error) {
        console.error('Error fetching admin user list:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

app.post('/api/admin/reset-password', authenticateRequest, requireAdmin, async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ error: 'User email and new password are required.' });
    }

    try {
        const success = await updateUserPassword(email, newPassword, true);
        if (!success) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({ message: 'Password reset successfully. User will be prompted to set a new password on next login.' });
    } catch (error) {
        console.error('Error resetting user password:', error);
        res.status(500).json({ error: 'Unable to reset password.' });
    }
});

app.put('/api/user/password', authenticateRequest, async (req, res) => {
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

// Tracker API endpoints
app.get('/api/tracker', authenticateRequest, async (req, res) => {
    console.log('Fetching meal-log tracker data from DB');
    let connection;
    try {
        connection = await getConnection();
        console.log('DB connection established');

        const mealResult = await connection.execute(
            `select MEAL_LOG_ID, FOOD_NAME, TRACK_DATE, MEAL_NAME, CALORIES, PROTEIN, CARBS, FAT, NOTES
             from custom.MEAL_LOG
             where lower(USER_ID) = lower(:userId)
             order by TRACK_DATE`,
            { userId: req.user.email },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const MEAL_TRACKERS = mealResult.rows.map(row => ({
            TRACKER_ID: null,
            MEAL_LOG_ID: row.MEAL_LOG_ID,
            ENTRY_TYPE: 'meal',
            TRACK_DATE: formatOracleDate(row.TRACK_DATE),
            FOOD_NAME: row.FOOD_NAME,
            MEAL_NAME: row.MEAL_NAME,
            CALORIES: row.CALORIES,
            CALORIES_UNIT: 'kcal',
            PROTEIN: row.PROTEIN,
            PROTEIN_UNIT: 'g',
            CARBOHYDRATES: row.CARBS,
            CARB_UNIT: 'g',
            FAT: row.FAT,
            FAT_UNIT: 'g',
            WATER_INTAKE: null,
            DAY_RATING: null,
            NOTES: row.NOTES,
            CREATED_DATE: null,
            MODIFIED_DATE: null
        }));

        res.json(MEAL_TRACKERS);
    } catch (error) {
        console.error('Error fetching TRACKERS:', error);
        res.status(500).json({ error: 'Failed to fetch TRACKERS' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

app.get('/api/day-details', authenticateRequest, async (req, res) => {
    const trackDate = String(req.query.date || '').trim();

    if (!trackDate) {
        return res.status(400).json({ error: 'date is required' });
    }

    let connection;

    try {
        connection = await getConnection();
        const result = await connection.execute(
            `select MEAL_LOG_ID, MEAL_NAME, FOOD_NAME, QUANTITY, UNIT, CALORIES, PROTEIN, CARBS, FAT, NOTES
             from custom.MEAL_LOG
             where TRUNC(TRACK_DATE) = TO_DATE(:trackDate, 'YYYY-MM-DD')
               and lower(USER_ID) = lower(:userId)
             order by
                case MEAL_NAME
                    when 'morning drink' then 1
                    when 'breakfast' then 2
                    when '1st snack' then 3
                    when 'lunch' then 4
                    when '2nd snack' then 5
                    when 'dinner' then 6
                    else 7
                end,
                FOOD_NAME`,
            { trackDate, userId: req.user.email },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const meals = MEAL_ORDER.map((mealName) => ({
            mealName,
            label: MEAL_DISPLAY_NAMES[mealName],
            items: [],
            totals: {
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0
            }
        }));

        result.rows.forEach((row) => {
            const mealName = String(row.MEAL_NAME || '').toLowerCase();
            const meal = meals.find((item) => item.mealName === mealName);

            if (!meal) {
                return;
            }

            meal.items.push({
                mealLogId: row.MEAL_LOG_ID,
                foodName: row.FOOD_NAME,
                quantity: Number(row.QUANTITY || 0),
                unit: String(row.UNIT || 'g'),
                calories: Number(row.CALORIES || 0),
                protein: Number(row.PROTEIN || 0),
                carbs: Number(row.CARBS || 0),
                fat: Number(row.FAT || 0),
                notes: row.NOTES || ''
            });

            meal.totals.calories += Number(row.CALORIES || 0);
            meal.totals.protein += Number(row.PROTEIN || 0);
            meal.totals.carbs += Number(row.CARBS || 0);
            meal.totals.fat += Number(row.FAT || 0);
        });

        const totals = meals.reduce(
            (acc, meal) => {
                acc.calories += meal.totals.calories;
                acc.protein += meal.totals.protein;
                acc.carbs += meal.totals.carbs;
                acc.fat += meal.totals.fat;
                return acc;
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        res.json({
            date: trackDate,
            totals,
            meals
        });
    } catch (error) {
        console.error('Error fetching day details:', error);
        res.status(500).json({ error: 'Failed to fetch day details' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

app.put('/api/meal-log/:mealLogId', authenticateRequest, async (req, res) => {
    const mealLogId = Number(req.params.mealLogId);
    const { quantity, unit } = req.body;

    if (!Number.isFinite(mealLogId) || mealLogId <= 0) {
        return res.status(400).json({ error: 'Valid meal log ID is required.' });
    }

    if (!quantity || !unit) {
        return res.status(400).json({ error: 'Quantity and unit are required.' });
    }

    let connection;

    try {
        connection = await getConnection();
        
        // Get the existing meal entry to recalculate macros
        const mealResult = await connection.execute(
            `select FOOD_ID, QUANTITY, UNIT from custom.MEAL_LOG where MEAL_LOG_ID = :mealLogId and lower(USER_ID) = lower(:userId)`,
            { mealLogId, userId: req.user.email },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (!mealResult.rows || mealResult.rows.length === 0) {
            return res.status(404).json({ error: 'Meal log entry not found.' });
        }

        const meal = mealResult.rows[0];
        const food = await findFoodCatalogById(meal.FOOD_ID);

        if (!food) {
            return res.status(404).json({ error: 'Food entry not found.' });
        }

        // Calculate new macros
        const scale = calculateScale(food, quantity, unit);
        const newCalories = roundTo(Number(food.CALORIES_PER_SERVING) * scale, 1);
        const newProtein = roundTo(Number(food.PROTEIN_PER_SERVING) * scale, 1);
        const newCarbs = roundTo(Number(food.CARBS_PER_SERVING) * scale, 1);
        const newFat = roundTo(Number(food.FAT_PER_SERVING) * scale, 1);

        await connection.execute(
            `update custom.MEAL_LOG
             set QUANTITY = :quantity, UNIT = :unit, CALORIES = :calories, PROTEIN = :protein, CARBS = :carbs, FAT = :fat, MODIFIED_DATE = SYSDATE
             where MEAL_LOG_ID = :mealLogId`,
            {
                mealLogId,
                quantity: Number(quantity),
                unit: String(unit).toLowerCase(),
                calories: newCalories,
                protein: newProtein,
                carbs: newCarbs,
                fat: newFat
            },
            { autoCommit: true }
        );

        res.json({ message: 'Meal entry updated successfully.' });
    } catch (error) {
        console.error('Error updating meal entry:', error);
        res.status(500).json({ error: error.message || 'Failed to update meal entry.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

app.delete('/api/meal-log/:mealLogId', authenticateRequest, async (req, res) => {
    const mealLogId = Number(req.params.mealLogId);

    if (!Number.isFinite(mealLogId) || mealLogId <= 0) {
        return res.status(400).json({ error: 'Valid meal log ID is required.' });
    }

    let connection;

    try {
        connection = await getConnection();
        
        const result = await connection.execute(
            `delete from custom.MEAL_LOG where MEAL_LOG_ID = :mealLogId and lower(USER_ID) = lower(:userId)`,
            { mealLogId, userId: req.user.email },
            { autoCommit: true }
        );

        res.json({ message: 'Meal entry deleted successfully.' });
    } catch (error) {
        console.error('Error deleting meal entry:', error);
        res.status(500).json({ error: 'Failed to delete meal entry.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

app.post('/api/food-macros', async (req, res) => {
    const { foodText, quantity, unit } = req.body;

    if (!foodText || String(foodText).trim().length === 0) {
        return res.status(400).json({ error: 'Food description is required.' });
    }

    try {
        const result = await getFoodMacros(foodText, quantity, unit);
        res.json(result);
    } catch (error) {
        console.error('Error fetching food macros:', error);
        res.status(500).json({ error: error.message || 'Unable to fetch macros right now.' });
    }
});

app.get('/api/food-catalog', async (req, res) => {
    const search = String(req.query.search || '').trim();
    let connection;

    try {
        connection = await getConnection();
        const result = await connection.execute(
            `select FOOD_ID, FOOD_NAME, MEASUREMENT_TYPE, SERVING_SIZE, SERVING_SIZE_UNIT,
                    CALORIES_PER_SERVING, PROTEIN_PER_SERVING, CARBS_PER_SERVING, FAT_PER_SERVING, NOTES
             from custom.FOOD_CATALOG
             where :search is null
                or :search = ''
                or lower(FOOD_NAME) like '%' || lower(:search) || '%'
             order by FOOD_NAME`,
            { search },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching food catalog:', error);
        res.status(500).json({ error: 'Failed to fetch food catalog.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

app.post('/api/food-catalog', async (req, res) => {
    const {
        foodName,
        measurementType,
        servingSize,
        servingSizeUnit,
        caloriesPerServing,
        proteinPerServing,
        carbsPerServing,
        fatPerServing,
        notes
    } = req.body;

    if (!foodName || !measurementType || !servingSize || !servingSizeUnit) {
        return res.status(400).json({ error: 'Food name, measurement type, serving size, and serving size unit are required.' });
    }

    let connection;

    try {
        connection = await getConnection();
        await connection.execute(
            `insert into custom.FOOD_CATALOG
             (FOOD_NAME, MEASUREMENT_TYPE, SERVING_SIZE, SERVING_SIZE_UNIT, CALORIES_PER_SERVING, PROTEIN_PER_SERVING, CARBS_PER_SERVING, FAT_PER_SERVING, NOTES)
             values (:foodName, :measurementType, :servingSize, :servingSizeUnit, :caloriesPerServing, :proteinPerServing, :carbsPerServing, :fatPerServing, :notes)`,
            {
                foodName: String(foodName).trim(),
                measurementType: String(measurementType).toLowerCase(),
                servingSize: Number(servingSize),
                servingSizeUnit: String(servingSizeUnit).toLowerCase(),
                caloriesPerServing: Number(caloriesPerServing || 0),
                proteinPerServing: Number(proteinPerServing || 0),
                carbsPerServing: Number(carbsPerServing || 0),
                fatPerServing: Number(fatPerServing || 0),
                notes: notes || null
            },
            { autoCommit: true }
        );

        res.status(201).json({ message: 'Food saved successfully.' });
    } catch (error) {
        console.error('Error saving food catalog entry:', error);
        res.status(500).json({ error: error.message || 'Failed to save food catalog entry.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

app.put('/api/food-catalog/:foodId', async (req, res) => {
    const foodId = Number(req.params.foodId);
    const {
        foodName,
        measurementType,
        servingSize,
        servingSizeUnit,
        caloriesPerServing,
        proteinPerServing,
        carbsPerServing,
        fatPerServing,
        notes
    } = req.body;

    if (!Number.isFinite(foodId) || foodId <= 0) {
        return res.status(400).json({ error: 'A valid food id is required.' });
    }

    if (!foodName || !measurementType || !servingSize || !servingSizeUnit) {
        return res.status(400).json({ error: 'Food name, measurement type, serving size, and serving size unit are required.' });
    }

    let connection;

    try {
        connection = await getConnection();
        const result = await connection.execute(
            `update custom.FOOD_CATALOG
             set FOOD_NAME = :foodName,
                 MEASUREMENT_TYPE = :measurementType,
                 SERVING_SIZE = :servingSize,
                 SERVING_SIZE_UNIT = :servingSizeUnit,
                 CALORIES_PER_SERVING = :caloriesPerServing,
                 PROTEIN_PER_SERVING = :proteinPerServing,
                 CARBS_PER_SERVING = :carbsPerServing,
                 FAT_PER_SERVING = :fatPerServing,
                 NOTES = :notes,
                 MODIFIED_DATE = SYSDATE
             where FOOD_ID = :foodId`,
            {
                foodName: String(foodName).trim(),
                measurementType: String(measurementType).toLowerCase(),
                servingSize: Number(servingSize),
                servingSizeUnit: String(servingSizeUnit).toLowerCase(),
                caloriesPerServing: Number(caloriesPerServing || 0),
                proteinPerServing: Number(proteinPerServing || 0),
                carbsPerServing: Number(carbsPerServing || 0),
                fatPerServing: Number(fatPerServing || 0),
                notes: notes || null,
                foodId
            },
            { autoCommit: true }
        );

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Food entry not found.' });
        }

        res.json({ message: 'Food updated successfully.' });
    } catch (error) {
        console.error('Error updating food catalog entry:', error);
        res.status(500).json({ error: error.message || 'Failed to update food catalog entry.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

app.delete('/api/food-catalog/:foodId', async (req, res) => {
    const foodId = Number(req.params.foodId);

    if (!Number.isFinite(foodId) || foodId <= 0) {
        return res.status(400).json({ error: 'A valid food id is required.' });
    }

    let connection;

    try {
        connection = await getConnection();
        const result = await connection.execute(
            `delete from custom.FOOD_CATALOG where FOOD_ID = :foodId`,
            { foodId },
            { autoCommit: true }
        );

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Food entry not found.' });
        }

        res.json({ message: 'Food deleted successfully.' });
    } catch (error) {
        console.error('Error deleting food catalog entry:', error);
        res.status(500).json({ error: error.message || 'Failed to delete food catalog entry.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

app.post('/api/meal-log', authenticateRequest, async (req, res) => {
    const { foodId, trackDate, mealName, quantity, unit, notes } = req.body;
    const normalizedMealName = normalizeMealName(mealName);

    if (!foodId || !trackDate || !normalizedMealName || !quantity) {
        return res.status(400).json({ error: 'Food id, date, meal, and quantity are required.' });
    }

    let connection;

    try {
        connection = await getConnection();
        const food = await findFoodCatalogById(Number(foodId));

        if (!food) {
            return res.status(404).json({ error: 'Food entry not found.' });
        }

        const scale = calculateScale(food, Number(quantity), String(unit || food.SERVING_SIZE_UNIT));
        const calories = roundTo(Number(food.CALORIES_PER_SERVING) * scale, 1);
        const protein = roundTo(Number(food.PROTEIN_PER_SERVING) * scale, 1);
        const carbs = roundTo(Number(food.CARBS_PER_SERVING) * scale, 1);
        const fat = roundTo(Number(food.FAT_PER_SERVING) * scale, 1);

        await connection.execute(
            `insert into custom.MEAL_LOG
             (FOOD_ID, FOOD_NAME, TRACK_DATE, MEAL_NAME, QUANTITY, UNIT, CALORIES, PROTEIN, CARBS, FAT, NOTES, USER_ID)
             values (:foodId, :foodName, TO_DATE(:trackDate, 'YYYY-MM-DD'), :mealName, :quantity, :unit, :calories, :protein, :carbs, :fat, :notes, :userId)`,
            {
                userId: req.user.email,
                foodId: Number(foodId),
                foodName: String(food.FOOD_NAME),
                trackDate,
                mealName: normalizedMealName,
                quantity: Number(quantity),
                unit: normalizeUnit(String(unit || food.SERVING_SIZE_UNIT)),
                calories,
                protein,
                carbs,
                fat,
                notes: notes || null
            },
            { autoCommit: true }
        );

        res.status(201).json({
            message: 'Meal added successfully.',
            meal: {
                trackDate,
                mealName: normalizedMealName,
                calories,
                protein,
                carbs,
                fat
            }
        });
    } catch (error) {
        console.error('Error saving meal log:', error);
        res.status(400).json({ error: error.message || 'Unable to add item to meal.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error closing DB connection:', closeError);
            }
        }
    }
});

if (require.main === module) {
    (async () => {
        try {
            await ensureFoodCatalogTable();
            await ensureMealLogTable();
            await ensureAppUserTable();
            await ensureAppUserProfileColumns();
            const userCount = await getAppUserCount();

            if (userCount === 0) {
                console.log('Creating default admin account: admin / manager');
                await createUser('admin', 'manager', true, false);
            }

            await ensureMealLogUserIdColumn();
            await migrateServinSizeUnitConstraint();
            app.listen(PORT, () => {
                console.log(`Backend server listening on http://localhost:${PORT}`);
            });
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    })();
}

module.exports = app;
