require('dotenv').config();
const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const multer = require('multer');
const serviceAccount = require('./service-account.json');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Inisialisasi Firestore
const firestore = new Firestore({
  projectId: 'nutrifish-425413',
  keyFilename: 'service-account.json',
});

// Inisialisasi Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nutrifish-425413.firebaseio.com',
  storageBucket: 'nutrifish'
});
const storage = admin.storage().bucket();

// Middleware untuk parsing JSON
app.use(express.json());

// Secret key untuk JWT dari environment variable
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware untuk upload file foto
const upload = multer({ limits: { fileSize: 1 * 1024 * 1024 } }); // Batasan ukuran file 1MB

// Middleware untuk autentikasi JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Endpoint untuk verifikasi token Google dan mengembalikan JWT
app.post('/verify-google-token', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: true, message: 'idToken is required' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email } = decodedToken;

    // Cek apakah pengguna sudah ada di Firestore
    const userQuery = await firestore.collection('users').where('firebaseUid', '==', uid).get();
    let user;

    if (userQuery.empty) {
      // Jika pengguna tidak ditemukan, buat pengguna baru di Firestore
      const newUserRef = await firestore.collection('users').add({
        email,
        name: decodedToken.name,
        username: decodedToken.email.split('@')[0], // Gunakan bagian pertama email sebagai username default
        firebaseUid: uid,
      });
      user = { userID: newUserRef.id, email, username: decodedToken.email.split('@')[0] };
    } else {
      // Jika pengguna ditemukan, ambil datanya
      const userDoc = userQuery.docs[0];
      user = { userID: userDoc.id, ...userDoc.data() };
    }

    // Buat JWT
    const token = jwt.sign({ email: user.email, userID: user.userID }, JWT_SECRET, { expiresIn: '24h' });

    res.status(200).json({
      error: false,
      message: 'success',
      token,
    });
  } catch (error) {
    console.error('Error verifying Google token:', error);
    res.status(500).json({ error: true, message: 'Internal server error' });
  }
});

// Register endpoint
app.post('/register', async (req, res) => {
  const { email, password, name, username } = req.body;

  if (!email || !password || !name || !username) {
    return res.status(400).json({ error: true, message: 'Email, password, name, and username are required' });
  }

  try {
    // Check if the email is already registered
    const emailQuery = await firestore.collection('users').where('email', '==', email).get();
    if (!emailQuery.empty) {
      return res.status(400).json({ error: true, message: 'Email is already registered' });
    }

    // Check if the username is already taken
    const usernameQuery = await firestore.collection('users').where('username', '==', username).get();
    if (!usernameQuery.empty) {
      return res.status(400).json({ error: true, message: 'Username is already taken' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user to Firestore with generated userID
    const userRef = await firestore.collection('users').add({
      email,
      name,
      password: hashedPassword,
      username  // Pastikan username disimpan di sini
    });

    const userID = userRef.id; // Auto-generated userID

    // Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name
    });

    // Save Firebase Authentication UID to Firestore
    await userRef.update({ firebaseUid: userRecord.uid, userID });

    res.status(201).json({ error: false, message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: true, message: 'Internal server error' });
  }
});


// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: true,
      message: 'Email and password are required'
    });
  }

  try {
    // Check if the user exists
    const userQuery = await firestore.collection('users').where('email', '==', email).get();
    if (userQuery.empty) {
      return res.status(400).json({
        error: true,
        message: 'Invalid email or password'
      });
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    // Verify the password
    const isPasswordValid = await bcrypt.compare(password, userData.password);

    if (!isPasswordValid) {
      return res.status(400).json({
        error: true,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign({ email, userID: userData.userID }, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({
      error: false,
      message: 'success',
      loginResult: {
        username: userData.username,
        name: userData.name,
        token: token,
        userID: userData.userID  // Tambahkan userID di sini
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error'
    });
  }
});

// Add new story endpoint
app.post('/stories', [authenticateToken, upload.single('photo')], async (req, res) => {
  const { storyTitle, storyDescription, lat, lon } = req.body;
  const photo = req.file;

  if (!storyTitle || !storyDescription || !photo) {
    return res.status(400).json({
      error: true,
      message: 'storyTitle, storyDescription, and photo are required'
    });
  }

  try {
    // Membuat nama file yang unik
    const photoFilename = `${req.user.userID}-${Date.now()}${path.extname(photo.originalname)}`;
    const storageRef = storage.file(`stories/${photoFilename}`);

    // Menyimpan foto ke Cloud Storage
    await storageRef.save(photo.buffer, {
      metadata: {
        contentType: photo.mimetype
      }
    });

    // Mengambil URL publik dari foto
    const [url] = await storageRef.getSignedUrl({
      action: 'read',
      expires: '03-01-2500'
    });

    // Mengambil data pengguna dari Firestore
    const userDoc = await firestore.collection('users').doc(req.user.userID).get();
    const username = userDoc.data().username;

    const newStoryRef = await firestore.collection('stories').add({
      storyTitle,
      storyDescription,
      storyPhotoUrl: url,
      lat: lat ? parseFloat(lat) : null,
      lon: lon ? parseFloat(lon) : null,
      storyDateCreated: new Date(),
      userID: req.user.userID,
      username: username  // Simpan username di sini
    });

    const storyID = newStoryRef.id;

    res.status(201).json({
      error: false,
      message: 'success',
      storyID: storyID
    });
  } catch (error) {
    console.error('Error adding story:', error);
    res.status(500).json({ error: true, message: 'Internal server error' });
  }
});




// Get all stories
app.get('/stories', async (req, res) => {
  const { page = 1, size = 10, location = 0 } = req.query;

  try {
    console.log(`Fetching stories: page=${page}, size=${size}, location=${location}`);

    let storiesQuery = firestore.collection('stories');
    
    if (parseInt(location) === 1) {
      storiesQuery = storiesQuery.where('lat', '!=', null);
    }

    const storiesSnapshot = await storiesQuery
      .orderBy('storyDateCreated', 'desc')  // Urutkan berdasarkan tanggal
      .offset((parseInt(page) - 1) * parseInt(size))
      .limit(parseInt(size))
      .get();

    const listStory = [];
    for (const doc of storiesSnapshot.docs) {
      const data = doc.data();
      let username = data.username || 'Unknown';
      if (username === 'Unknown') {
        const userDoc = await firestore.collection('users').doc(data.userID).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          username = userData.username || 'Unknown';
        }
      }
      listStory.push({
        storyID: doc.id,
        userID: data.userID,
        storyTitle: data.storyTitle,
        username: username,
        storyDescription: data.storyDescription,
        storyPhotoUrl: data.storyPhotoUrl,
        storyDateCreated: data.storyDateCreated ? data.storyDateCreated.toDate().toLocaleString() : 'Date not available'
      });
    }

    res.status(200).json({ 
      error: false, 
      message: 'Stories fetched successfully', 
      listStory 
    });
  } catch (error) {
    console.error('Error getting stories:', error);
    res.status(500).json({ error: true, message: 'Internal server error' });
  }
});




// Get story detail endpoint
app.get('/stories/:storyID', async (req, res) => {
  const storyID = req.params.storyID;
  try {
    const storyDoc = await firestore.collection('stories').doc(storyID).get();
    if (!storyDoc.exists) {
      return res.status(404).json({ error: true, message: 'Story not found' });
    }
    const storyData = storyDoc.data();
    res.status(200).json(storyData);
  } catch (error) {
    console.error('Error getting story:', error);
    res.status(500).json({ error: true, message: 'Internal server error' });
  }
});

// Get stories by userID endpoint
app.get('/stories/user/:userID', async (req, res) => {
  const userID = req.params.userID;
  try {
    const storiesQuerySnapshot = await firestore.collection('stories').where('userID', '==', userID).get();
    const userStories = [];
    storiesQuerySnapshot.forEach(doc => {
      const data = doc.data();
      userStories.push({
        storyID: doc.id,
        storyTitle: data.storyTitle,
        username: data.username,
        storyDescription: data.storyDescription,
        storyPhotoUrl: data.storyPhotoUrl,
        storyDateCreated: data.storyDateCreated.toDate().toLocaleString() // Ubah format tanggal
      });
    });
    res.status(200).json({
      error: false,
      message: 'User stories fetched successfully',
      userStories
    });
  } catch (error) {
    console.error('Error getting user stories:', error);
    res.status(500).json({ error: true, message: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
