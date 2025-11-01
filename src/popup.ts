// Popup script
console.log('Popup script loaded');

// Store the parsed account balances
let accountBalances: Map<string, number> = new Map();

// Store the ProjectionLab account mapping (accountId -> name)
let projectionLabAccounts: Map<string, string> = new Map();

// Store the matched accounts (Quicken name -> PL accountId)
let matchedAccounts: Map<string, string> = new Map();

// Storage keys
const STORAGE_KEY_API_KEY = 'projectionlab_api_key';

/**
 * Save the API key to Chrome storage
 */
async function saveApiKey(apiKey: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_API_KEY]: apiKey });
  console.log('API key saved');
}

/**
 * Load the API key from Chrome storage
 */
async function loadApiKey(): Promise<string> {
  const result = await chrome.storage.local.get(STORAGE_KEY_API_KEY);
  return result[STORAGE_KEY_API_KEY] || '';
}

/**
 * Parse the tab-separated Quicken export file
 * Returns a Map of account names to their rounded integer balances
 */
function parseQuickenFile(fileContent: string): Map<string, number> {
  const balances = new Map<string, number>();
  const lines = fileContent.split('\n');

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    // Split by tab character
    const parts = line.split('\t');

    // Filter out empty parts and trim all parts
    const trimmedParts = parts.map(p => p.trim()).filter(p => p.length > 0);

    // We need at least 2 parts: account name and balance
    if (trimmedParts.length < 2) {
      continue;
    }

    const accountName = trimmedParts[0];
    const balanceStr = trimmedParts[1];

    // Skip lines that are headers or categories
    // Note: We keep "TOTAL" lines as they are actual accounts, but skip "OVERALL TOTAL"
    const skipPatterns = [
      'ProjectionLab',
      'Includes unrealized',
      'Balance'  // Skip the header line
    ];

    // Skip if it matches any skip pattern
    if (skipPatterns.some(pattern => accountName.includes(pattern))) {
      continue;
    }

    // Skip the "Account" header line specifically (but not lines containing "Account" as part of name)
    if (accountName === 'Account') {
      continue;
    }

    // Skip "OVERALL TOTAL" but keep other TOTAL lines
    if (accountName === 'OVERALL TOTAL') {
      continue;
    }

    // Skip category headers (lines that end with "Accounts" and have no balance or balance is just whitespace)
    if (accountName.endsWith('Accounts') && balanceStr === '') {
      continue;
    }

    // Try to parse the balance as a number
    // Remove commas and parse as float
    const balanceValue = parseFloat(balanceStr.replace(/,/g, ''));

    // Only add if we got a valid number
    if (!isNaN(balanceValue)) {
      // Round to nearest integer
      const roundedBalance = Math.round(balanceValue);
      balances.set(accountName, roundedBalance);
      console.log(`Parsed: ${accountName} = ${roundedBalance}`);
    }
  }

  return balances;
}

/**
 * Calculate special derived values and add them to the balances
 */
function calculateDerivedBalances(balances: Map<string, number>): void {
  // Calculate Cashflow Balance = TOTAL Bank Accounts + TOTAL Cash Accounts + TOTAL Credit Card Accounts
  const bankAccounts = balances.get('TOTAL Bank Accounts') || 0;
  const cashAccounts = balances.get('TOTAL Cash Accounts') || 0;
  const creditCardAccounts = balances.get('TOTAL Credit Card Accounts') || 0;

  const cashflowBalance = bankAccounts + cashAccounts + creditCardAccounts;

  console.log('Calculating Cashflow Balance:');
  console.log(`  TOTAL Bank Accounts: $${bankAccounts.toLocaleString()}`);
  console.log(`  TOTAL Cash Accounts: $${cashAccounts.toLocaleString()}`);
  console.log(`  TOTAL Credit Card Accounts: $${creditCardAccounts.toLocaleString()}`);
  console.log(`  = Cashflow Balance: $${cashflowBalance.toLocaleString()}`);

  balances.set('Cashflow Balance', cashflowBalance);

  // Calculate Emergency Fund = Medical Deductible + Savings
  const medicalDeductible = balances.get('Medical Deductible') || 0;
  const savings = balances.get('Savings') || 0;

  const emergencyFund = medicalDeductible + savings;

  console.log('Calculating Emergency Fund:');
  console.log(`  Medical Deductible: $${medicalDeductible.toLocaleString()}`);
  console.log(`  Savings: $${savings.toLocaleString()}`);
  console.log(`  = Emergency Fund: $${emergencyFund.toLocaleString()}`);

  balances.set('Emergency Fund', emergencyFund);
}

/**
 * Match Quicken account names to ProjectionLab account IDs
 * Returns a Map of Quicken account name -> ProjectionLab accountId
 */
function matchAccounts(
  quickenAccounts: Map<string, number>,
  plAccounts: Map<string, string>
): Map<string, string> {
  const matches = new Map<string, string>();

  // Create a reverse map of PL accounts (name -> accountId)
  const plNameToId = new Map<string, string>();
  for (const [accountId, name] of plAccounts.entries()) {
    plNameToId.set(name.toLowerCase().trim(), accountId);
  }

  console.log('Matching accounts...');
  console.log('Quicken accounts:', Array.from(quickenAccounts.keys()));
  console.log('PL accounts:', Array.from(plNameToId.keys()));

  // Try to match each Quicken account
  for (const [quickenName, balance] of quickenAccounts.entries()) {
    let normalizedQuickenName = quickenName.toLowerCase().trim();
    let matchType = 'exact';

    // Exception 1: Remove " - USD" suffix if present
    if (normalizedQuickenName.endsWith(' - usd')) {
      normalizedQuickenName = normalizedQuickenName.slice(0, -6).trim();
      matchType = 'USD suffix removed';
    }

    // Exception 2: Remove "TOTAL " prefix if present
    if (normalizedQuickenName.startsWith('total ')) {
      normalizedQuickenName = normalizedQuickenName.slice(6).trim();
      matchType = 'TOTAL prefix removed';
    }

    // Try exact match (case-insensitive)
    if (plNameToId.has(normalizedQuickenName)) {
      const accountId = plNameToId.get(normalizedQuickenName)!;
      matches.set(quickenName, accountId);
      console.log(`✅ Match (${matchType}): "${quickenName}" -> ${accountId}`);
      continue;
    }

    // Exception 3: Try removing "Fidelity" and matching
    const withoutFidelity = normalizedQuickenName.replace(/fidelity\s*/gi, '').trim();
    if (withoutFidelity !== normalizedQuickenName && plNameToId.has(withoutFidelity)) {
      const accountId = plNameToId.get(withoutFidelity)!;
      matches.set(quickenName, accountId);
      console.log(`✅ Match (Fidelity removed): "${quickenName}" -> "${withoutFidelity}" -> ${accountId}`);
      continue;
    }

    console.log(`❌ No match found for: "${quickenName}"`);
  }

  console.log(`Matched ${matches.size} out of ${quickenAccounts.size} accounts`);
  return matches;
}

/**
 * Display the loaded balances in the UI
 */
function displayBalances(balances: Map<string, number>) {
  const balancesContainer = document.getElementById('balances-container');
  const balancesList = document.getElementById('balances-list');

  if (!balancesContainer || !balancesList) {
    return;
  }

  // Clear existing content
  balancesList.innerHTML = '';

  // Only show matched accounts
  const matchedBalances = new Map<string, number>();
  for (const [accountName, balance] of balances.entries()) {
    if (matchedAccounts.has(accountName)) {
      matchedBalances.set(accountName, balance);
    }
  }

  if (matchedBalances.size === 0) {
    balancesList.innerHTML = '<div style="color: #999; font-style: italic;">No matched accounts</div>';
    balancesContainer.classList.add('visible');
    return;
  }

  // Sort by account name for easier viewing
  const sortedEntries = Array.from(matchedBalances.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  // Create balance items (only for matched accounts)
  for (const [accountName, balance] of sortedEntries) {
    const balanceItem = document.createElement('div');
    balanceItem.className = 'balance-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'balance-name';

    // Get the ProjectionLab account name from the accountId
    const matchedAccountId = matchedAccounts.get(accountName);
    const plAccountName = matchedAccountId ? projectionLabAccounts.get(matchedAccountId) : accountName;
    nameSpan.textContent = plAccountName || accountName;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'balance-value';
    // Format with commas and dollar sign
    valueSpan.textContent = `$${balance.toLocaleString()}`;

    balanceItem.appendChild(nameSpan);
    balanceItem.appendChild(valueSpan);
    balancesList.appendChild(balanceItem);
  }

  // Show the container
  balancesContainer.classList.add('visible');
}

document.addEventListener('DOMContentLoaded', async () => {
  const statusElement = document.getElementById('status');
  const syncButton = document.getElementById('sync-button');
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;

  if (statusElement) {
    statusElement.textContent = 'Ready';
  }

  // Load saved API key
  if (apiKeyInput) {
    const savedApiKey = await loadApiKey();
    if (savedApiKey) {
      apiKeyInput.value = savedApiKey;
    }

    // Save API key when it changes
    apiKeyInput.addEventListener('input', async () => {
      await saveApiKey(apiKeyInput.value);
    });
  }

  // Handle file selection
  if (fileInput) {
    fileInput.addEventListener('change', async (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) {
        return;
      }

      if (statusElement) {
        statusElement.textContent = 'Loading file...';
      }

      try {
        // Read the file content
        const fileContent = await file.text();

        // Parse the file
        accountBalances = parseQuickenFile(fileContent);

        console.log(`Loaded ${accountBalances.size} account balances`);

        // Calculate derived balances (like Cashflow Balance)
        calculateDerivedBalances(accountBalances);

        console.log(`Total accounts after derived calculations: ${accountBalances.size}`);

        // Don't display yet - wait for sync
        if (statusElement) {
          statusElement.textContent = `File loaded with ${accountBalances.size} accounts. Click "Sync Data" to match.`;
        }
      } catch (error) {
        console.error('Error reading file:', error);
        if (statusElement) {
          statusElement.textContent = 'Error reading file';
        }
      }
    });
  }

  if (syncButton) {
    syncButton.addEventListener('click', async () => {
      console.log('Sync button clicked');

      // Check if balances are loaded
      if (accountBalances.size === 0) {
        if (statusElement) {
          statusElement.textContent = 'Please load a file first';
        }
        return;
      }

      // Check if API key is provided
      const apiKey = apiKeyInput?.value.trim();
      if (!apiKey) {
        if (statusElement) {
          statusElement.textContent = 'Please enter API key';
        }
        return;
      }

      if (statusElement) {
        statusElement.textContent = 'Loading ProjectionLab accounts...';
      }

      try {
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        console.log('Current tab:', tab);

        if (!tab.id) {
          throw new Error('No active tab found');
        }

        // Check if we're on ProjectionLab
        if (!tab.url?.includes('app.projectionlab.com')) {
          throw new Error('Please navigate to app.projectionlab.com first');
        }

        console.log('Sending SYNC_DATA message to content script...');

        // Convert Map to array for sending
        const balancesArray = Array.from(accountBalances.entries());

        // Send message to content script
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'SYNC_DATA',
          apiKey: apiKey,
          balances: balancesArray
        });

        console.log('Sync response:', response);

        if (response.status === 'success') {
          // Store the ProjectionLab accounts
          projectionLabAccounts = new Map(response.accounts);

          // Match the accounts
          matchedAccounts = matchAccounts(accountBalances, projectionLabAccounts);

          // Update the display to show matches
          displayBalances(accountBalances);

          if (statusElement) {
            statusElement.textContent = `Matched ${matchedAccounts.size} accounts. Updating balances...`;
          }

          // Prepare updates for matched accounts
          const updates = [];
          for (const [quickenName, accountId] of matchedAccounts.entries()) {
            const balance = accountBalances.get(quickenName);
            if (balance !== undefined) {
              updates.push({ accountId, balance });
            }
          }

          console.log('Sending UPDATE_BALANCES message with', updates.length, 'updates');

          // Send update request
          const updateResponse = await chrome.tabs.sendMessage(tab.id, {
            type: 'UPDATE_BALANCES',
            apiKey: apiKey,
            updates: updates
          });

          console.log('Update response:', updateResponse);

          if (updateResponse.status === 'success') {
            if (statusElement) {
              statusElement.textContent = `✅ Updated ${updateResponse.success} accounts successfully!`;
              if (updateResponse.failed > 0) {
                statusElement.textContent += ` (${updateResponse.failed} failed)`;
              }
            }
          } else {
            throw new Error(updateResponse.error || 'Update failed');
          }
        } else {
          throw new Error(response.error || 'Unknown error');
        }
      } catch (error) {
        console.error('Error:', error);
        if (statusElement) {
          statusElement.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
    });
  }


});

