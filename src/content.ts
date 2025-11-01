// Content script that runs on app.projectionlab.com
console.log('Quicken ProjectionLab Sync: Content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);

  // Handle sync requests from popup
  if (message.type === 'SYNC_DATA') {
    // TODO: Implement sync logic here
    sendResponse({ status: 'success' });
  }

  return true;
});

