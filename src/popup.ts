// Popup script
console.log('Popup script loaded');

document.addEventListener('DOMContentLoaded', async () => {
  const statusElement = document.getElementById('status');
  const syncButton = document.getElementById('sync-button');
  
  if (statusElement) {
    statusElement.textContent = 'Ready';
  }
  
  if (syncButton) {
    syncButton.addEventListener('click', async () => {
      console.log('Sync button clicked');
      
      if (statusElement) {
        statusElement.textContent = 'Syncing...';
      }
      
      try {
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.id) {
          // Send message to content script
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });
          console.log('Page info:', response);
          
          if (statusElement) {
            statusElement.textContent = `Current page: ${response.title}`;
          }
        }
      } catch (error) {
        console.error('Error:', error);
        if (statusElement) {
          statusElement.textContent = 'Error occurred';
        }
      }
    });
  }
  

});

