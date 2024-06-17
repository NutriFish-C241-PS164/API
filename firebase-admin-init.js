// firebase-admin-init.js

const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nutrifish-425413.firebaseio.com'
});

module.exports = admin;
