import express from "express";
import axios from "axios";
import { createBandS, setupYouTubeLive } from "./streamToYT.js";
import "dotenv/config";
import { spawn } from "child_process";
const open = await import("open");
import ffmpegPath from "ffmpeg-static";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});
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

    res.send("Auth success");
  } catch (error) {
    console.error("no token found:", error.response?.data);
    res.send("auth failed");
  }
});

io.on("connection", async (socket) => {
  console.log("Client connected!");

  // get ingestion info

  ingestionInfo = await createBandS(token);
  console.log(ingestionInfo.streamName);
  console.log(ingestionInfo.ingestionAddress);

  // FFmpeg setup

  // const ffmpeg = spawn(ffmpegPath, [
  //   "-f",
  //   "webm",
  //   "-i",
  //   "-",
  //   "-c:v",
  //   "libx264",
  //   "-preset",
  //   "veryfast",
  //   "-b:v",
  //   "2500k",
  //   "-maxrate",
  //   "3000k",
  //   "-g",
  //   "60",
  //   "-c:a",
  //   "aac",
  //   "-b:a",
  //   "128k",
  //   "-f",
  //   "flv",
  //   `${ingestionInfo.ingestionAddress}/${ingestionInfo.streamName}`,
  // ]);

  socket.on("stream", (data) => {
    ffmpeg.stdin.write(data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected!");
    ffmpeg.kill("SIGINT");
  });
  // complete transition to live
  await setupYouTubeLive(token);
});

server.listen(3000, async () => {
  console.log("Server listening on http://localhost:3000");
  await open.default(`http://localhost:${PORT}/auth`);
});
