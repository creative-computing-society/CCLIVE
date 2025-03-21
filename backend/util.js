export async function waitForMs(waitTime) {
  return new Promise((resolve) => {
    setTimeout(resolve, waitTime);
  });
}
