// This script runs in the actual page context (not isolated like content scripts)
// It has access to window.projectionlabPluginAPI

console.log('🟢 Injected script loaded in page context');
console.log('🟢 window.projectionlabPluginAPI exists:', !!(window as any).projectionlabPluginAPI);

window.addEventListener('message', async (event) => {
  console.log('🟢 Message received in page context:', event.data);
  
  if (event.source !== window) {
    console.log('🟢 Ignoring message - wrong source');
    return;
  }
  if (event.data.type !== 'PROJECTIONLAB_API_CALL') {
    console.log('🟢 Ignoring message - wrong type:', event.data.type);
    return;
  }
  
  console.log('🟢 Processing API call request:', event.data);
  
  try {
    // Check if the API exists
    if (!(window as any).projectionlabPluginAPI) {
      throw new Error('projectionlabPluginAPI not found on window');
    }
    
    const { callId, functionName, args } = event.data;

    // Call the API function
    if (functionName === 'exportData') {
      console.log('🟢 Calling window.projectionlabPluginAPI.exportData with args:', args);
      const result = await (window as any).projectionlabPluginAPI.exportData(...args);
      console.log('🟢 API call successful, result:', result);

      window.postMessage({
        type: 'PROJECTIONLAB_API_RESPONSE',
        callId: callId,
        result: result
      }, '*');
    } else if (functionName === 'updateAccount') {
      console.log('🟢 Calling window.projectionlabPluginAPI.updateAccount with args:', args);
      const result = await (window as any).projectionlabPluginAPI.updateAccount(...args);
      console.log('🟢 updateAccount successful, result:', result);

      window.postMessage({
        type: 'PROJECTIONLAB_API_RESPONSE',
        callId: callId,
        result: result
      }, '*');
    } else {
      throw new Error('Unknown function: ' + functionName);
    }
  } catch (error: any) {
    console.error('🟢 API call error:', error);
    window.postMessage({
      type: 'PROJECTIONLAB_API_RESPONSE',
      callId: event.data.callId,
      error: error.message
    }, '*');
  }
});

console.log('🟢 Message listener registered');

