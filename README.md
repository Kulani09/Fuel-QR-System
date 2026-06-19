# Fuel QR Registration System

A full-stack web application for automating vehicle registration and managing fuel quotas.

---

## ⚠️ IMPORTANT: MongoDB Must Be Running First

The app stores all data in MongoDB. You must start MongoDB **before** running the app.

### Start MongoDB

**macOS (Homebrew):**
```bash
brew services start mongodb-community
```

**macOS — check if already installed:**
```bash
brew list | grep mongodb
# If not installed:
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Windows:**
- Open Services (Win+R → `services.msc`)
- Find "MongoDB" → Right-click → Start
- OR open **MongoDB Compass** (it starts the server automatically)

**Linux (Ubuntu/Debian):**
```bash
sudo systemctl start mongod
sudo systemctl enable mongod   # auto-start on boot
```

**Verify MongoDB is running:**
```bash
mongosh --eval "db.runCommand({ ping: 1 })"
# Should print: { ok: 1 }
```

---

## Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the app
npm start

# 3. Open in browser
open http://localhost:3000
```

The app auto-retries the MongoDB connection every 5 seconds, so you can start the server before MongoDB if needed.

---

## Tech Stack
- **Frontend**: HTML5, Bootstrap 5, jQuery 3.7, AJAX
- **Backend**: Node.js, Express 4
- **Database**: MongoDB (via Mongoose 7)
- **QR Generation**: qrcode

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/vehicles | Register a new vehicle |
| GET | /api/vehicles | Get all vehicles |
| GET | /api/vehicles/regno/:regNo | Find by registration number |
| GET | /api/vehicles/firstname/:name | Find by first name |
| GET | /api/vehicles/lastname/:name | Find by last name |
| GET | /api/vehicles/email/:email | Find by email |
| GET | /api/vehicles/station/:station | Find by fuel station |
| GET | /api/vehicles/fueltype/:type | Find by fuel type |
| GET | /api/vehicles/nic/:nic | Find by owner NIC |
| PUT | /api/vehicles/regno/:regNo | Update by registration number |
| PUT | /api/vehicles/firstname/:name | Update by first name |
| DELETE | /api/vehicles/regno/:regNo | Delete by registration number |
| GET | /api/health | Server + DB health check |

## jQuery Usage (5 Distinct Ways)
1. **DOM Manipulation & Event Handling** — `.on()`, `.addClass()`, `.removeClass()`, `.hide()`, `.show()`
2. **AJAX Calls** — `$.ajax()`, `$.get()` for all API communication
3. **Form Serialisation & Validation** — `$.each()`, `.val()`, `.prop()` for form handling
4. **Dynamic Table Filtering** — `.filter()` + `keyup` event for live table search
5. **Animation & UI Effects** — `.fadeIn()`, `.fadeOut()`, `.slideDown()` for transitions
