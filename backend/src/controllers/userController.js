const { findUserByEmail, createUser, updateUserPassword, saveUserProfile, getAllUsers } = require('../services/userService');

async function getProfile(req, res) {
  try {
    // Allow admins to fetch other users' profiles
    const isAdmin = req.user?.isAdmin === true;
    const requestedEmail = req.query.email ? String(req.query.email).toLowerCase() : null;
    const currentUserEmail = req.user?.email?.toLowerCase();

    // Check authorization: only admins can fetch other users' profiles
    if (requestedEmail && requestedEmail !== currentUserEmail && !isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const userEmail = requestedEmail || currentUserEmail;
    
    const user = await findUserByEmail(userEmail);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      email: user.email,
      gender: user.gender || '',
      weight: user.weight ?? null,
      weightUnit: user.weight_unit || '',
      height: user.height ?? null,
      heightUnit: user.height_unit || '',
      dateOfBirth: user.date_of_birth ? user.date_of_birth.toISOString().slice(0, 10) : '',
      goal: user.goal || '',
      activityLevel: user.activity_level || ''
    });
  } catch (err) {
    console.error('Unable to load profile:', err);
    res.status(500).json({ error: 'Unable to load profile.' });
  }
}

function validateProfileData({ gender, weight, weightUnit, height, heightUnit, dateOfBirth, goal, activityLevel }) {
  const errors = [];

  if (!gender) {
    errors.push('Gender is required.');
  }

  const weightValue = weight === null || weight === undefined || weight === ''
    ? null
    : Number(weight);
  if (weightValue === null) {
    errors.push('Weight is required.');
  } else if (!Number.isFinite(weightValue) || weightValue <= 0) {
    errors.push('Weight must be a positive number.');
  }

  if (!weightUnit) {
    errors.push('Weight unit is required.');
  } else if (!['kg', 'lb'].includes(String(weightUnit).toLowerCase())) {
    errors.push('Weight unit must be kg or lb.');
  }

  const heightValue = height === null || height === undefined || height === ''
    ? null
    : Number(height);
  if (heightValue === null) {
    errors.push('Height is required.');
  } else if (!Number.isFinite(heightValue)) {
    errors.push('Height must be a valid number.');
  }

  if (!heightUnit) {
    errors.push('Height unit is required.');
  } else {
    const unit = String(heightUnit).toLowerCase();
    if (unit === 'cm' && (heightValue < 10 || heightValue > 300)) {
      errors.push('Height must be between 10 cm and 300 cm.');
    }
    if (unit === 'in' && (heightValue < 4 || heightValue > 118)) {
      errors.push('Height must be between 4 in and 118 in.');
    }
    if (!['cm', 'in'].includes(unit)) {
      errors.push('Height unit must be cm or in.');
    }
  }

  if (!dateOfBirth) {
    errors.push('Date of birth is required.');
  } else {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    const maxPast = new Date();
    maxPast.setFullYear(today.getFullYear() - 100);

    if (Number.isNaN(dob.getTime())) {
      errors.push('Date of birth must be a valid date.');
    } else if (dob > today) {
      errors.push('Date of birth cannot be in the future.');
    } else if (dob < maxPast) {
      errors.push('Date of birth cannot be more than 100 years ago.');
    }
  }

  if (!goal) {
    errors.push('Fitness goal is required.');
  }

  const allowedActivityLevels = ['sedentary', 'light', 'moderate', 'active', 'athlete'];
  if (activityLevel && !allowedActivityLevels.includes(activityLevel)) {
    errors.push('Please select a valid activity level.');
  }

  return errors;
}

async function updateProfile(req, res) {
  const { gender, weight, weightUnit, height, heightUnit, dateOfBirth, goal, activityLevel } = req.body;

  const validationErrors = validateProfileData({ gender, weight, weightUnit, height, heightUnit, dateOfBirth, goal, activityLevel });
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: validationErrors.join(' ') });
  }

  try {
    await saveUserProfile(req.user.email, {
      gender,
      weight,
      weightUnit,
      height,
      heightUnit,
      dateOfBirth,
      goal,
      activityLevel
    });

    res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Unable to save profile:', err);
    res.status(500).json({ error: 'Unable to save profile.' });
  }
}

async function getCurrentUser(req, res) {
  try {
    const user = await findUserByEmail(req.query.email);
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function createUserHandler(req, res) {
  const { email, password, isAdmin } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  let conn = null;
  try {
    conn = await require('../db').getConnection();
    const countResult = await conn.query(`select count(*) as total from custom.app_user`);
    const userCount = Number(countResult.rows?.[0]?.total || 0);

    let authUser = null;
    const authorization = String(req.headers.authorization || '').trim();
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
    if (token) {
      const payload = require('../utils/auth').verifyAuthToken(token);
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

    res.status(201).json({
      message: 'User created successfully.',
      email: String(email).trim().toLowerCase(),
      isAdmin: shouldCreateAdmin
    });
  } catch (error) {
    console.error('Error creating user account:', error);
    res.status(500).json({ error: 'Failed to create user account.' });
  } finally {
    if (conn) {
      conn.release();
    }
  }
}

async function changePassword(req, res) {
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
}

async function getAllUsersHandler(req, res) {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Unable to fetch users.' });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getCurrentUser,
  createUser: createUserHandler,
  changePassword,
  getAllUsers: getAllUsersHandler
};
