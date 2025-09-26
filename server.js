const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const { status } = require("minecraft-server-util");

const app = express();
const http = require("http").createServer(app);
const io = new Server(http);

// Use Render-provided PORT or default to 3000 for local
const PORT = process.env.PORT || 3000;

const usersFile = path.join(__dirname, 'users.json');

// Helper to load users
function loadUsers() {
    if (!fs.existsSync(usersFile)) return {};
    return JSON.parse(fs.readFileSync(usersFile));
}

// Helper to save users
function saveUsers(users) {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// Socket.IO events
io.on('connection', (socket) => {
    socket.on('signup', (data) => {
        const { username, password } = data;
        const users = loadUsers();

        if (users[username]) {
            socket.emit('signupError', 'Username already exists');
            return;
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        users[username] = { password: hashedPassword };
        saveUsers(users);

        socket.emit('signupSuccess', 'User registered successfully');
    });

    socket.on('login', (data) => {
        const { username, password } = data;
        const users = loadUsers();

        if (!users[username]) {
            socket.emit('loginRes', { success: false, message: 'User not found' });
            return;
        }

        if (bcrypt.compareSync(password, users[username].password)) {
            socket.emit('loginRes', { success: true, message: 'Login successful' });
        } else {
            socket.emit('loginRes', { success: false, message: 'Incorrect password' });
        }
    });

    socket.on('checkServerStatus', async () => {
        const serverIP = 'play.deathevents.lol';
        const serverPort = 25565;

        try {
            const res = await status(serverIP, serverPort);
            socket.emit('serverStatus', {
                online: true,
                playersOnline: res.players.online,
                playersMax: res.players.max,
                version: res.version.name,
                motd: res.motd.clean
            });
        } catch (err) {
            socket.emit('serverStatus', { online: false });
        }
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/signup.html', (req, res) => res.sendFile(path.join(__dirname, 'signup.html')));
app.get('/serverstatus.html', (req, res) => res.sendFile(path.join(__dirname, 'serverstatus.html')));

// Start server
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
