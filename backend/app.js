import express from "express";
import axios from "axios";
import { setupYouTubeLive } from "./streamToYT.js";
import { WebSocketServer } from "ws";
import "dotenv/config";
import { spawn } from "child_process";
const open = await import("open");
import ffmpegPath from "ffmpeg-static";

const app = express();
const PORT = 3000;

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

const wss = new WebSocketServer({ port: 3001 });
wss.on("connection", async (ws) => {
  console.log("connectedddd ");

  const ffmpeg = spawn(ffmpegPath, [
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
  ]);
  ws.on("message", (data) => {
    ffmpeg.stdin.write(data);
  });

  ws.on("close", () => {
    ffmpeg.kill("SIGINT");
  });
});

app.listen(PORT, async () => {
  // await open.default(`http://localhost:${PORT}/auth`);
});
