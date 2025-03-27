import express from "express";
import axios from "axios";
import { setupYouTubeLive } from "./streamToYT.js";
import "dotenv/config";
import { spawn } from "child_process";
const open = await import("open");
import ffmpegPath from "ffmpeg-static";
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { Server as SocketIO } from 'socket.io'

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const io = new SocketIO(server)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "..")));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const REDIRECT_URI = "http://localhost:3000/oauth-callback";

let token = null;
let ingestionInfo = null;

app.get("/auth", async (req, res) => {
  const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=https://www.googleapis.com/auth/youtube`;
  res.redirect(authUrl);
});

app.get("/oauth-callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send("no code found");

  try {
    const response = await axios.post("https://oauth2.googleapis.com/token", {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      code: code,
    });

    token = response.data.access_token;

    ingestionInfo = await setupYouTubeLive(token);
  } catch (error) {
    console.error("no token found:", error.response?.data);
    res.send("auth failed");
  }
});

const options = [
  "-re",
    "-i",
    "pipe:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-b:v",
    "2500k",
    "-maxrate",
    "3000k",
    "-g",
    "60",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-f",
    "flv",
    `${ingestionInfo.ingestionAddress}/${ingestionInfo.streamName}`,
];

const ffmpegProcess = spawn('ffmpeg', options);

ffmpegProcess.stdout.on('data', (data) => {
    console.log(`ffmpeg stdout: ${data}`);
});

ffmpegProcess.stderr.on('data', (data) => {
    console.error(`ffmpeg stderr: ${data}`);
});

ffmpegProcess.on('close', (code) => {
    console.log(`ffmpeg process exited with code ${code}`);
});

io.on("connection", socket => {
  console.log('Socket Connected', socket.id);
  socket.on('binarystream', stream => {
      console.log('Binary Stream Incommming...')
      ffmpegProcess.stdin.write(stream, (err) => {
          console.log('Err', err)
      })
  })
})

app.listen(PORT, async () => {
  await open.default(`http://localhost:${PORT}/auth`);
});
