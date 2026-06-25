const { findUserByEmail, findUserTpin, createUserTpin } = require('../services/userServicePurse');
const { hashPassword, createAuthToken } = require('../utils/authPurse');


async function createTpin(req, res) {

  try {

    const { email, tpin, confirmTpin } = req.body;

    if (!tpin || !confirmTpin) {
      return res.status(400).json({
        error: "T-PIN and Confirm T-PIN are required."
      });
    }

    if (!/^\d{4}$/.test(tpin)) {
      return res.status(400).json({
        error: "T-PIN must be exactly 4 digits."
      });
    }

    if (tpin !== confirmTpin) {
      return res.status(400).json({
        error: "T-PIN & confirm T-PIN do not match."
      });
    }

    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    const existingTpin = await findUserTpin(user.user_id);

    if (existingTpin) {
      return res.status(409).json({
        error: "T-PIN already exists."
      });
    }

    await createUserTpin(
      user.user_id,
      tpin
    );

    return res.status(201).json({
      message: "T-PIN created successfully."
    });

  } catch (err) {

    console.error("TPIN creation error:", err);

    return res.status(500).json({
      error: "Unable to create T-PIN."
    });

  }
}

async function verifyTpin(req, res) {
  try {
    const { email, tpin } = req.body;
    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid login' });
    }

    const userTpin = await findUserTpin(user.user_id)
    const incomingHash = hashPassword(tpin);
    if (incomingHash !== userTpin) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = createAuthToken({email: user.user_id});

    res.json({
      token,
      userDet: user,
      user: {
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  createTpin,
  verifyTpin
};
