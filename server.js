const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files — disable caching for JS/CSS so updates always load fresh
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
  }
}));

// ── MongoDB Connection (non-blocking — server starts even if DB is down) ──────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fuelqrdb';

function connectDB() {
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
    .then(() => console.log('✅ MongoDB connected to', MONGODB_URI))
    .catch(err => {
      console.error('❌ MongoDB connection failed:', err.message);
      console.log('   Retrying in 5 seconds...');
      setTimeout(connectDB, 5000);
    });
}

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected — will retry...');
  setTimeout(connectDB, 5000);
});

connectDB();

// ── Vehicle Schema ─────────────────────────────────────────────────────────────
const vehicleSchema = new mongoose.Schema({
  RegNo:          { type: String, required: true, unique: true },
  FirstName:      { type: String, required: true },
  LastName:       { type: String, required: true },
  Email:          { type: String, required: true },
  NearestStation: { type: String, required: true },
  FuelType:       { type: String, required: true, enum: ['Petrol', 'Diesel', 'Electric'] },
  OwnerNIC:       { type: String, required: true },
  VehicleModel:   { type: String, required: true },
  QRCode:         { type: String }
}, { timestamps: true });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

// ── Helper: check DB is ready before handling a request ───────────────────────
function requireDB(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database not connected. Please ensure MongoDB is running on your machine.'
    });
  }
  next();
}

// ── Helper: generate QR code ──────────────────────────────────────────────────
async function generateQR(data) {
  return await QRCode.toDataURL(JSON.stringify(data));
}

// ── REST API ROUTES ───────────────────────────────────────────────────────────

// Health check — always responds (no requireDB)
app.get('/api/health', (req, res) => {
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const dbStatus = states[mongoose.connection.readyState] || 'unknown';
  res.json({ success: true, server: 'running', database: dbStatus });
});

// POST — Register a Vehicle
app.post('/api/vehicles', requireDB, async (req, res) => {
  try {
    const data = req.body;

    const required = ['RegNo', 'FirstName', 'LastName', 'Email', 'NearestStation', 'FuelType', 'OwnerNIC', 'VehicleModel'];
    for (const field of required) {
      if (!data[field] || String(data[field]).trim() === '') {
        return res.status(400).json({ success: false, message: `Field '${field}' is required` });
      }
    }

    data.RegNo = data.RegNo.toUpperCase().trim();

    const qrData = {
      RegNo: data.RegNo,
      OwnerNIC: data.OwnerNIC,
      FuelType: data.FuelType,
      VehicleModel: data.VehicleModel,
      NearestStation: data.NearestStation
    };
    data.QRCode = await generateQR(qrData);

    const vehicle = new Vehicle(data);
    await vehicle.save();
    res.status(201).json({ success: true, message: 'Vehicle registered successfully', data: vehicle });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Registration number already exists' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET — All vehicles
app.get('/api/vehicles', requireDB, async (req, res) => {
  try {
    const vehicles = await Vehicle.find().sort({ createdAt: -1 });
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET — By Registration Number
app.get('/api/vehicles/regno/:regNo', requireDB, async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ RegNo: req.params.regNo.toUpperCase() });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    res.json({ success: true, data: vehicle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET — By First Name
app.get('/api/vehicles/firstname/:firstName', requireDB, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ FirstName: new RegExp(req.params.firstName, 'i') });
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET — By Last Name
app.get('/api/vehicles/lastname/:lastName', requireDB, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ LastName: new RegExp(req.params.lastName, 'i') });
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET — By Email
app.get('/api/vehicles/email/:email', requireDB, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ Email: new RegExp(req.params.email, 'i') });
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET — By Station
app.get('/api/vehicles/station/:station', requireDB, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ NearestStation: new RegExp(req.params.station, 'i') });
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET — By Fuel Type
app.get('/api/vehicles/fueltype/:fuelType', requireDB, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ FuelType: req.params.fuelType });
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET — By NIC
app.get('/api/vehicles/nic/:nic', requireDB, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ OwnerNIC: req.params.nic });
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT — Update by Registration Number
app.put('/api/vehicles/regno/:regNo', requireDB, async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.RegNo;
    delete updateData._id;
    delete updateData.QRCode;
    delete updateData.__v;

    const vehicle = await Vehicle.findOneAndUpdate(
      { RegNo: req.params.regNo.toUpperCase() },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    res.json({ success: true, message: 'Vehicle updated successfully', data: vehicle });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT — Update by First Name
app.put('/api/vehicles/firstname/:firstName', requireDB, async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.RegNo;
    delete updateData._id;
    delete updateData.QRCode;

    const result = await Vehicle.updateMany(
      { FirstName: new RegExp(`^${req.params.firstName}$`, 'i') },
      { $set: updateData }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'No vehicles found with that first name' });
    }
    res.json({ success: true, message: `${result.modifiedCount} vehicle(s) updated successfully` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE — By Registration Number
app.delete('/api/vehicles/regno/:regNo', requireDB, async (req, res) => {
  try {
    const vehicle = await Vehicle.findOneAndDelete({ RegNo: req.params.regNo.toUpperCase() });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    res.json({ success: true, message: `Vehicle ${vehicle.RegNo} deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Catch-all — serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`   MongoDB target: ${MONGODB_URI}`);
  console.log(`   Make sure MongoDB is running!\n`);
});
