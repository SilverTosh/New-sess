const express = require("express");
const { makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const fs = require("fs");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const activeSessions = {};

app.get("/pair", async (req, res) => {
    const number = req.query.number;
    if (!number) return res.status(400).json({ error: "Missing number" });

    const sessionFile = `./sessions/KINGVON-${number}.json`;
    const { state, saveState } = await useSingleFileAuthState(sessionFile);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ['KINGVON-XMD', 'Chrome', '1.0.0'],
    });

    let sent = false;
    sock.ev.on("connection.update", async ({ connection, pairingCode }) => {
        if (pairingCode && !sent) {
            sent = true;
            console.log("Pairing code for", number, ":", pairingCode);
            res.json({ pairingCode, note: "Scan this code with WhatsApp" });
        }

        if (connection === "open") {
            console.log("Linked:", number);
            await saveState();
            const sessionData = fs.readFileSync(sessionFile, "utf-8");
            const encoded = Buffer.from(sessionData).toString("base64");
            const finalSession = `KINGVON~${encoded}`;
            activeSessions[number] = finalSession;
        }
    });

    sock.ev.on("creds.update", saveState);
});

app.get("/session", (req, res) => {
    const number = req.query.number;
    const session = activeSessions[number];
    if (!session) {
        return res.status(404).json({ error: "Session not found or not linked yet" });
    }
    res.json({ session });
});

app.listen(PORT, () => {
    console.log(`Pairing server running on http://localhost:${PORT}`);
});
