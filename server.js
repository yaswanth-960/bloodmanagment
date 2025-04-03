const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const app = express();
const PORT = 5000;
const path = require('path'); 
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();
app.use(express.static(path.join(__dirname, 'public')));

const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: Number,
  gender: String,
  bloodGroup: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  locality: { type: String, required: true }, // Replaced district with locality
});

const User = mongoose.model('User', userSchema);

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 },
});

const OTP = mongoose.model('OTP', otpSchema);

// Set your SendGrid API key
sgMail.setApiKey(process.env.mapi);

app.use(bodyParser.json());
app.use(cors());

// Send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  const existingUser = await User.findOne({ email });
  
  if (existingUser) {
    return res.status(400).json({ message: 'Email already registered. Please login.' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const msg = {
    to: email,
    from: 'pvskvkkl@gmail.com',
    subject: 'Your OTP Code',
    text: `Your OTP code is ${otp}`,
    html:`<strong>Your OTP code is ${otp}</strong>`,
  };

  console.log(`Sending OTP to ${email}...`);
  try {
    await Promise.all([
      sgMail.send(msg),
     await OTP.deleteOne({ email }), // Remove existing OTP for the email
      new OTP({ email, otp }).save(),
    ]);

    console.log(`OTP sent successfully to ${email}`);
    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ message: 'Failed to send OTP.' });
  }
});

// Verify OTP
app.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  console.log(`Verifying OTP for ${email}...`);
  try {
    const otpDoc = await OTP.findOne({ email, otp });
    if (otpDoc) {
      await OTP.deleteOne({ email, otp });
      console.log(`OTP verified successfully for ${email}`);
      res.json({ message: 'OTP verified successfully', success: true });
    } else {
      console.log(`Invalid OTP for ${email}`);
      res.status(400).json({ message: 'Invalid OTP', success: false });
    }
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'OTP verification failed' });
  }
});

// Reset Password
app.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const otpDoc = await OTP.findOne({ email, otp });
    if (otpDoc) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await User.findOneAndUpdate({ email }, { password: hashedPassword });
      await OTP.deleteOne({ email, otp });
      res.json({ message: 'Password reset successful', success: true });
    } else {
      res.status(400).json({ message: 'Invalid OTP', success: false });
    }
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Password reset failed' });
  }
});

// ...existing code...
app.post('/send-ot', async (req, res) => {
  const { email } = req.body;
  const existingUser = await User.findOne({ email });
  if (!existingUser) {
    return res.status(400).json({ message: 'Email not registered. Please signup.' });
}
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const msg = {
      to: email,
      from: 'pvskvkkl@gmail.com',
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}`,
      html: `<strong>Your OTP code is ${otp}</strong>`,
  };
  console.log(`Sending OTP to ${email}...`);
  try {
      await sgMail.send(msg);
      const newOTP = new OTP({ email, otp });
      await newOTP.save();
      console.log(`OTP sent successfully to ${email}`);
      res.json({ message: 'OTP sent successfully' });
  } catch (error) {
      console.error('Error sending OTP:', error);
      res.status(500).json({ message: 'Failed to send OTP.' });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the email exists in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Email not registered. Please sign up.' });
    }

    // Check if the password is correct
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Wrong password.' });
    }

    // If both email and password are correct
    res.json({ message: 'Login successful', user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Register
app.post('/register', async (req, res) => {
  try {
    const { name, age, gender, bloodGroup, email, password, phone, locality } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered. Please login.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, age, gender, bloodGroup, email, password: hashedPassword, phone, locality });
    await user.save();
    res.json({ message: 'Registration successful', user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Update Profile
app.post('/update-profile', async (req, res) => {
  const { email, name, phone, locality, bloodGroup } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { email: email },
      { name: name, phone: phone, locality: locality, bloodGroup: bloodGroup },
      { new: true }
    );
    if (user) {
      res.json({ message: 'Profile updated successfully', user: user });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Profile update failed' });
  }
});

// Get Donors
app.get('/donors', async (req, res) => {
  const { bloodGroup, locality } = req.query;
  console.log('Request query:', req.query);
  try {
    let query = {};
    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (locality) query.locality = locality;
    const donors = await User.find(query);
    res.json({ donors });
  } catch (error) {
    console.error('Donor retrieval error:', error);
    res.status(500).json({ message: 'Failed to retrieve donors' });
  }
});

app.post('/request-blood',async(req, res) => {
  const {name, email, phone, bloodGroup, locality} = req.body;
  console.log('Received blood request with data:', req.body);
  try {
    const donors = await User.find({ bloodGroup, locality, email: { $ne: email }});
    console.log(`Found ${donors.length} donors matching criteria`);
    
    if (donors.length === 0) {
      console.log('No donors found for criteria:', { bloodGroup, locality });
      return res.status(404).json({ message: 'No donors available for the requested blood group in this locality.' });
    }

    const recipientEmails = donors.map(donor => donor.email);
    console.log('Sending emails to:', recipientEmails);
    
    const msg = {
      to: recipientEmails,
      from: 'pvskvkkl@gmail.com',
      subject: 'Urgent Blood Donation Request',
      text: `Dear Donor,
      
      A blood donation request has been made in your locality.
      
      Requester's Details:
      - Name: ${name}
      - Email: ${email}
      - Phone: ${phone}
      - Required Blood Group: ${bloodGroup}
      - Address/Locality: ${locality}

      If you are available to donate, please contact the requester.

      Thank you for your kindness.
      `,
      html: `<p>Dear Donor,</p>
      <p>A blood donation request has been made in your locality.</p>
      <p><strong>Requester's Details:</strong></p>
      <ul>
        <li><strong>Name:</strong> ${name}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Phone:</strong> ${phone}</li>
        <li><strong>Required Blood Group:</strong> ${bloodGroup}</li>
        <li><strong>Address/Locality:</strong> ${locality}</li>
      </ul>
      <p>If you are available to donate, please contact the requester.</p>
      <p>Thank you for your kindness.</p>`
    };
    await sgMail.sendMultiple(msg);
    console.log(`Blood request email sent successfully to ${recipientEmails.length} donors`);
    res.json({ message: 'Blood request sent successfully to available donors.' });

  } catch (error) {
    console.error('Error in /request-blood:', error);
    res.status(500).json({ message: 'Failed to send blood request email.' });
  }
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'first.html'));
});
app.use(express.static('public'));
app.listen(PORT, () => {
  console.log( `Server is running on http://localhost:${PORT}`);
});