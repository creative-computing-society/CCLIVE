import axios from "axios";
import { waitForMs } from "./util";

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
  return res.data.id;
}
async function createLiveStream(token) {
  const streamPayload = {
    snippet: {
      title: "Streammmmm!",
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
  const response = await axios.get(
    `${baseUrl}Streams?part=status&id=${streamId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data.items[0].status.streamStatus;
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
  return response.data.items[0].status.lifeCycleStatus;
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
async function transitionBroadcastToTesting(token, streamId, broadcastId) {
  try {
    const streamStatus = await checkStreamStatus(token, streamId);
    if (streamStatus === "active") {
      const response = await axios.post(
        `${baseUrl}Broadcasts/transition?broadcastStatus=testing&id=${broadcastId}&part=id,snippet,status`,
        null,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } else {
      return null;
    }
  } catch (error) {
    console.error(
      "error transitioning broadcast to testing :",
      error.response?.data || error
    );
    throw error;
  }
}

export async function setupYouTubeLive(token) {
  try {
    const broadcastId = await createLiveBroadcast(token);
    const { streamId, ingestionInfo } = await createLiveStream(token);
    await bindBroadcastAndStream(token, broadcastId, streamId);

    const broadcastStatus = await getBroadcastStatus(token, broadcastId);

    if (broadcastStatus == "ready") {
      await waitForMs(80000);
      await transitionBroadcastToTesting(token, streamId, broadcastId);
    }

    if (broadcastStatus == "ready") {
      await waitForMs(10000);
      await transitionBroadcastToLive(token, streamId, broadcastId);
    }

    return ingestionInfo;
  } catch (error) {
    console.error(
      "Error setting up YouTube Live:",
      error.response?.data || error
    );
    throw error;
  }
}
