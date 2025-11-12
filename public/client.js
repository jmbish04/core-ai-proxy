// Shared client-side JavaScript for core-ai-proxy

/**
 * Fetch system health status
 */
async function fetchHealth() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch health:', error);
    return { status: 'unhealthy', error: error.message };
  }
}

/**
 * Trigger health test run
 */
async function runTests() {
  try {
    const response = await fetch('/api/tests/run', { method: 'POST' });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to run tests:', error);
    return { error: error.message };
  }
}

/**
 * Get test results for a session
 */
async function getTestResults(sessionId) {
  try {
    const response = await fetch(`/api/tests/session/${sessionId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to get test results:', error);
    return [];
  }
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}

/**
 * Show notification
 */
function showNotification(message, duration = 3000) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(99, 102, 241, 0.9);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

console.log('core-ai-proxy client loaded');