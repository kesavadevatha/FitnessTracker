const { getConnection } = require('../db');
const { hashPassword } = require('../utils/auth');

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
      [hash, reset ? 'Y' : 'N', email]
    );

    return result.rowCount > 0;
  } finally {
    conn.release();
  }
}

async function saveUserProfile(email, profile) {
  const conn = await getConnection();

  try {
    await conn.query(
      `
        UPDATE custom.app_user
        SET gender = $1,
            weight = $2,
            weight_unit = $3,
            height = $4,
            height_unit = $5,
            date_of_birth = $6,
            goal = $7,
            activity_level = $8,
            modified_date = NOW()
        WHERE LOWER(user_id) = LOWER($9)
      `,
      [
        profile.gender || null,
        profile.weight !== null && profile.weight !== '' ? profile.weight : null,
        profile.weightUnit || null,
        profile.height !== null && profile.height !== '' ? profile.height : null,
        profile.heightUnit || null,
        profile.dateOfBirth || null,
        profile.goal || null,
        profile.activityLevel || null,
        email
      ]
    );
  } finally {
    conn.release();
  }
}

async function getAllUsers() {
  const conn = await getConnection();

  try {
    const result = await conn.query(
      `
        SELECT user_id, email, is_admin, created_date
        FROM custom.app_user
        ORDER BY email ASC
      `
    );

    return result.rows || [];
  } finally {
    conn.release();
  }
}

module.exports = {
  findUserByEmail,
  createUser,
  updateUserPassword,
  saveUserProfile,
  getAllUsers
};
