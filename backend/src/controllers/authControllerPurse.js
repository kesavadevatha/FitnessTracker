const { findUserByEmail, createUser } = require('../services/userServicePurse');
const { hashPassword, createAuthToken } = require('../utils/authPurse');

async function registerPurse(req, res) {
  try {
    const { email, password, confirmPassword, firstName, lastName, phone } = req.body;
    if (!email || !password || !confirmPassword || !firstName) {
      return res.status(400).json({ error: 'First Name, Email, password and confirm password are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }

    await createUser(email, password, firstName, lastName, phone);
    const token = createAuthToken({ email: email.toLowerCase()});

    res.status(201).json({
      token,
      user: {
        email: email.toLowerCase()
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Unable to create account.' });
  }
}

module.exports = {
  registerPurse
};
