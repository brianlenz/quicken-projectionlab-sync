// Content script that runs on app.projectionlab.com
console.log('🚀 Quicken ProjectionLab Sync: Content script loaded');
console.log('🚀 Content script is running on:', window.location.href);

/**
 * Call a function in the page context (not the isolated content script context)
 * This is necessary because content scripts can't access page JavaScript variables
 */
function callPageFunction(functionName: string, ...args: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    // Generate a unique ID for this call
    const callId = `call_${Date.now()}_${Math.random()}`;

    console.log('🔵 Setting up API call with ID:', callId);

    let timeoutId: number | null = null;

    // Listen for the response
    const listener = (event: MessageEvent) => {
      console.log('🔵 Content script received message:', event.data);

      if (event.source !== window) {
        console.log('🔵 Ignoring - wrong source');
        return;
      }
      if (event.data.type !== 'PROJECTIONLAB_API_RESPONSE') {
        console.log('🔵 Ignoring - wrong type:', event.data.type);
        return;
      }
      if (event.data.callId !== callId) {
        console.log('🔵 Ignoring - wrong callId:', event.data.callId, 'expected:', callId);
        return;
      }

      console.log('🔵 Received response for our call!');

      // Clean up
      window.removeEventListener('message', listener);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data.result);
      }
    };

    window.addEventListener('message', listener);

    // Send the request to the page context
    const message = {
      type: 'PROJECTIONLAB_API_CALL',
      callId: callId,
      functionName: functionName,
      args: args
    };

    console.log('🔵 Posting message to page context:', message);
    window.postMessage(message, '*');

    // Timeout after 10 seconds
    timeoutId = window.setTimeout(() => {
      console.log('🔵 API call timeout for callId:', callId);
      window.removeEventListener('message', listener);
      reject(new Error('API call timeout'));
    }, 10000);
  });
}

// Inject a script into the page context to handle API calls
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = function() {
  console.log('🚀 Injected script loaded successfully');
  script.remove();
};
script.onerror = function() {
  console.error('🚀 Failed to load injected script');
};
(document.head || document.documentElement).appendChild(script);
console.log('🚀 Injecting script into page context');

/**
 * Load ProjectionLab account data and extract account ID to name mapping
 */
async function loadProjectionLabAccounts(apiKey: string): Promise<Map<string, string>> {
  const accountMap = new Map<string, string>();

  try {
    console.log('🔵 Calling ProjectionLab API via page context...');

    // Call the API in the page context (not the isolated content script context)
    const data = await callPageFunction('exportData', { key: apiKey });
    console.log('ProjectionLab API response:', data);

    // Extract the first plan
    if (!data.plans || data.plans.length === 0) {
      throw new Error('No plans found in ProjectionLab data');
    }

    const firstPlan = data.plans[0];
    console.log('First plan:', firstPlan);

    // Extract accounts from events
    if (!firstPlan.accounts || !firstPlan.accounts.events) {
      throw new Error('No account events found in plan');
    }

    const events = firstPlan.accounts.events;
    console.log(`Found ${events.length} account events`);

    // Build the map of accountId -> name
    for (const event of events) {
      if (event.accountId && event.name) {
        accountMap.set(event.accountId, event.name);
        console.log(`Account: ${event.accountId} -> ${event.name}`);
      }
    }

    console.log(`Loaded ${accountMap.size} accounts from ProjectionLab`);

  } catch (error) {
    console.error('Error loading ProjectionLab accounts:', error);
    throw error;
  }

  return accountMap;
}

/**
 * Update account balances in ProjectionLab
 */
async function updateAccountBalances(
  apiKey: string,
  updates: Array<{ accountId: string; balance: number }>
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  console.log(`🔵 Updating ${updates.length} account balances...`);

  for (const update of updates) {
    try {
      console.log(`🔵 Updating account ${update.accountId} with balance $${update.balance}`);

      await callPageFunction('updateAccount', update.accountId, { balance: update.balance }, { key: apiKey });

      console.log(`✅ Successfully updated ${update.accountId}`);
      results.success++;
    } catch (error: any) {
      console.error(`❌ Failed to update ${update.accountId}:`, error);
      results.failed++;
      results.errors.push(`${update.accountId}: ${error.message}`);
    }
  }

  console.log(`🔵 Update complete: ${results.success} succeeded, ${results.failed} failed`);
  return results;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔵 Content script received message:', message);

  // Handle sync requests from popup
  if (message.type === 'SYNC_DATA') {
    (async () => {
      console.log('🔵 Processing SYNC_DATA request...');
      const { apiKey, balances } = message;

      console.log('🔵 API Key length:', apiKey?.length);
      console.log('🔵 Balances count:', balances?.length);

      if (!apiKey) {
        console.error('No API key provided');
        sendResponse({ status: 'error', error: 'API key is required' });
        return;
      }

      try {
        // Load ProjectionLab accounts
        const accountMap = await loadProjectionLabAccounts(apiKey);

        console.log('ProjectionLab accounts loaded successfully');
        console.log('Account Map:', Array.from(accountMap.entries()));

        sendResponse({
          status: 'success',
          accountCount: accountMap.size,
          accounts: Array.from(accountMap.entries())
        });
      } catch (error: any) {
        console.error('Error in sync:', error);
        sendResponse({
          status: 'error',
          error: error.message
        });
      }
    })();

    // Return true to indicate we'll send response asynchronously
    return true;
  }

  // Handle update requests from popup
  if (message.type === 'UPDATE_BALANCES') {
    (async () => {
      console.log('🔵 Processing UPDATE_BALANCES request...');
      const { apiKey, updates } = message;

      console.log('🔵 API Key length:', apiKey?.length);
      console.log('🔵 Updates count:', updates?.length);

      if (!apiKey) {
        console.error('No API key provided');
        sendResponse({ status: 'error', error: 'API key is required' });
        return;
      }

      if (!updates || updates.length === 0) {
        console.error('No updates provided');
        sendResponse({ status: 'error', error: 'No updates to process' });
        return;
      }

      try {
        // Update account balances
        const results = await updateAccountBalances(apiKey, updates);

        console.log('Update results:', results);

        sendResponse({
          status: 'success',
          ...results
        });
      } catch (error: any) {
        console.error('Error in update:', error);
        sendResponse({
          status: 'error',
          error: error.message
        });
      }
    })();

    // Return true to indicate we'll send response asynchronously
    return true;
  }

  return true;
});

