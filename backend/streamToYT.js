import axios from "axios";
import { waitForMs } from "./util.js";

const baseUrl = "https://www.googleapis.com/youtube/v3/live";

async function createLiveBroadcast(token) {
  const broadcastPayload = {
    snippet: {
      title: "broadcastttt",
      scheduledStartTime: new Date().toISOString(),
    },
    status: {
      privacyStatus: "public",
    },
  };

  const res = await axios.post(
    `${baseUrl}Broadcasts?part=snippet,status,contentDetails`,
    broadcastPayload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  console.log("created broadcast");
  return res.data.id;
}
async function createLiveStream(token) {
  const streamPayload = {
    snippet: {
      title: "Stream",
    },
    cdn: {
      ingestionType: "rtmp",
      resolution: "720p",
      frameRate: "30fps",
    },
  };

  const streamRes = await axios.post(
    `${baseUrl}Streams?part=snippet,cdn`,
    streamPayload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  console.log("created livestream");
  return {
    streamId: streamRes.data.id,
    ingestionInfo: streamRes.data.cdn.ingestionInfo,
  };
}

async function bindBroadcastAndStream(token, broadcastId, streamId) {
  const bindRes = await axios.post(
    `${baseUrl}Broadcasts/bind?part=id,snippet,contentDetails,status&streamId=${streamId}&id=${broadcastId}`,
    null,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return bindRes.data;
}

async function checkStreamStatus(token, streamId) {
  return new Promise((resolve, reject) => {
    const intervalId = setInterval(async () => {
      try {
        const response = await axios.get(
          `${baseUrl}Streams?part=status&id=${streamId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const streamStatus = response.data.items[0]?.status?.streamStatus;
        console.log(`Current stream status: ${streamStatus}`);

        if (streamStatus === "active") {
          console.log("Stream is active");
          clearInterval(intervalId);
          resolve("active");
        }
      } catch (error) {
        console.error("Error fetching stream status:", error.message);
        reject(error);
      }
    }, 15000);
  });
}

async function transitionBroadcastToLive(token, streamId, broadcastId) {
  try {
    const streamStatus = await checkStreamStatus(token, streamId);
    if (streamStatus === "active") {
      const response = await axios.post(
        `${baseUrl}Broadcasts/transition?broadcastStatus=live&id=${broadcastId}&part=id,snippet,status`,
        null,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("transitioned to live");
      return response.data;
    } else {
      return null;
    }
  } catch (error) {
    console.error(
      "error transitioning to live:",
      error.response?.data || error
    );
    throw error;
  }
}
async function getBroadcastStatus(token, broadcastId) {
  const response = await axios.get(
    `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=status&id=${broadcastId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  console.log("got broadcast status");
  return response.data.items[0].status.lifeCycleStatus;
}

let broadcastId, streamIds, ingestionInfos;

export async function createBandS(token) {
  try {
    broadcastId = await createLiveBroadcast(token);
    console.log(`broadcastId: `, broadcastId);

    console.log(`token: ${token}`);

    const { streamId, ingestionInfo } = await createLiveStream(token);
    streamIds = streamId;
    ingestionInfos = ingestionInfo;
    console.log(`streamId: `, streamId);

    console.log(`ingestion info :`, ingestionInfo);

    await bindBroadcastAndStream(token, broadcastId, streamId);
    return ingestionInfo;
  } catch (error) {
    console.error(
      "Error setting up YouTube Live:",
      error.response?.data || error
    );
    throw error;
  }
}

export async function setupYouTubeLive(token) {
  try {
    console.log("Checking stream status....");
    await checkStreamStatus(token, streamIds);

    console.log("stream active");

    const broadcastStatus = await getBroadcastStatus(token, broadcastId);
    console.log("broadcastStatus: ", broadcastStatus);

    await waitForMs(10000);
    await transitionBroadcastToLive(token, streamIds, broadcastId);
  } catch (error) {
    console.error(
      "Error setting up YouTube Live:",
      error.response?.data || error
    );
    throw error;
  }
}
