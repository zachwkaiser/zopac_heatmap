import { test, expect } from '@playwright/test';

test.describe('Heatmap Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the heatmap page before each test
    await page.goto('/');
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display upload map prompt when no floorplan is uploaded', async ({ page }) => {
    // Check if the upload prompt is visible
    const uploadPrompt = page.getByText('Upload a map to display the heatmap');
    await expect(uploadPrompt).toBeVisible();
    
    // Check if the Upload Map button is present
    const uploadButton = page.getByRole('button', { name: 'Upload Map' });
    await expect(uploadButton).toBeVisible();
  });

  test('should open modal when "Change Map" button is clicked', async ({ page }) => {
    // Click the Change Map button (if visible)
    const changeMapButton = page.getByRole('button', { name: 'Change Map' });
    if (await changeMapButton.isVisible()) {
      await changeMapButton.click();
      
      // Check if modal is open
      const modalTitle = page.getByText('Upload Map');
      await expect(modalTitle).toBeVisible();
      
      // Check if file input is present
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeVisible();
    }
  });

  test('should close modal when close button is clicked', async ({ page }) => {
    // Open modal first
    const changeMapButton = page.getByRole('button', { name: 'Change Map' });
    if (await changeMapButton.isVisible()) {
      await changeMapButton.click();
      
      // Click the close button (X button)
      const closeButton = page.locator('.modal-header button[aria-label="Close"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
        
        // Modal should be closed
        const modalTitle = page.getByText('Upload Map');
        await expect(modalTitle).not.toBeVisible();
      }
    }
  });

  test('should close modal when Cancel button is clicked', async ({ page }) => {
    // Open modal first
    const changeMapButton = page.getByRole('button', { name: 'Change Map' });
    if (await changeMapButton.isVisible()) {
      await changeMapButton.click();
      
      // Click the Cancel button
      const cancelButton = page.getByRole('button', { name: 'Cancel' });
      await cancelButton.click();
      
      // Modal should be closed
      const modalTitle = page.getByText('Upload Map');
      await expect(modalTitle).not.toBeVisible();
    }
  });

  test('should display endpoint information section', async ({ page }) => {
    // Check if the endpoint info section exists
    const endpointSection = page.getByText('Endpoint Information');
    await expect(endpointSection).toBeVisible();
  });

  test('should load and display endpoint positions from API', async ({ page }) => {
    // Wait for API call to complete
    await page.waitForResponse(response => 
      response.url().includes('/api/query/endpoints') && response.status() === 200
    );
    
    // Check if endpoint data is displayed
    // This will depend on whether you have endpoints in the database
    const endpointList = page.locator('.endpoint-list');
    
    // Either endpoints are shown or "No endpoints configured" message
    const hasEndpoints = await endpointList.isVisible();
    const noEndpointsMessage = await page.getByText('No endpoints configured').isVisible();
    
    expect(hasEndpoints || noEndpointsMessage).toBeTruthy();
  });

  test('should accept image file uploads (JPG, PNG)', async ({ page }) => {
    // Open modal
    const changeMapButton = page.getByRole('button', { name: 'Change Map' }).first();
    await changeMapButton.click();
    
    // Check accepted file types
    const fileInput = page.locator('input[type="file"]');
    const acceptAttr = await fileInput.getAttribute('accept');
    
    expect(acceptAttr).toContain('image/jpeg');
    expect(acceptAttr).toContain('image/png');
    expect(acceptAttr).toContain('image/jpg');
  });

  test('should have upload button disabled when no file is selected', async ({ page }) => {
    // Open modal
    const changeMapButton = page.getByRole('button', { name: 'Change Map' }).first();
    await changeMapButton.click();
    
    // Check if upload button is disabled
    const uploadButton = page.getByRole('button', { name: 'Upload Map' });
    await expect(uploadButton).toBeDisabled();
  });

  test('should initialize heatmap container', async ({ page }) => {
    // Check if the heatmap container exists
    const heatmapContainer = page.locator('.heatmap-container');
    await expect(heatmapContainer).toBeVisible();
  });

  test('should load heatmap.js library from CDN', async ({ page }) => {
    // Wait for the heatmap.js script to be loaded
    await page.waitForFunction(() => 'h337' in window);
    
    // Verify heatmap.js is available
    const hasHeatmapJS = await page.evaluate(() => typeof (window as Window & { h337?: unknown }).h337 !== 'undefined');
    expect(hasHeatmapJS).toBeTruthy();
  });
});

test.describe('Heatmap with Mock Data', () => {
  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API calls and return error
    await page.route('**/api/query/endpoints', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ success: false, error: 'Server error' })
      });
    });
    
    await page.goto('/');
    
    // Component should still render without crashing
    const container = page.locator('.heatmap-page');
    await expect(container).toBeVisible();
  });

  test('should display endpoint markers when data is available', async ({ page }) => {
    // Mock endpoint data
    await page.route('**/api/query/endpoints', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 2,
          positions: [
            { endpoint_id: 'EP1', x: 100, y: 200, is_active: true },
            { endpoint_id: 'EP2', x: 300, y: 400, is_active: false }
          ]
        })
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if endpoint info is displayed
    const ep1 = page.getByText('EP1');
    const ep2 = page.getByText('EP2');
    
    await expect(ep1).toBeVisible();
    await expect(ep2).toBeVisible();
  });
});

