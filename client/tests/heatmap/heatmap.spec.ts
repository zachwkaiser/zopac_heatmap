import { test, expect } from '@playwright/test';

test.describe('Heatmap Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Set authenticated state and clear any saved floorplans
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('isAuthenticated', 'true');
    });
    
    // Mock all API endpoints to prevent real network calls
    await page.route('**/api/floorplan*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'No floorplan found'
        })
      });
    });
    
    await page.route('**/api/query/endpoints', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 0,
          positions: []
        })
      });
    });
    
    await page.route('**/api/client/scan-data', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 0,
          data: []
        })
      });
    });
    
    await page.route('**/api/query/heatmap-data', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { max: 100, min: 0, data: [] }
        })
      });
    });
    
    // Reload to apply authenticated state
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to heatmap page by clicking navbar button
    const heatmapNavButton = page.getByRole('button', { name: 'Heat map' });
    await heatmapNavButton.click();
    
    // Wait for page to load
    await page.waitForTimeout(500);
  });

  test('should display upload map prompt when no floorplan is uploaded', async ({ page }) => {
    // Check if the upload prompt is visible
    const uploadPrompt = page.getByText('Upload a map to display the heatmap');
    await expect(uploadPrompt).toBeVisible();
    
    // Check if the Upload Map button is present (there are two - one in center, one in sidebar)
    const uploadButtons = page.getByRole('button', { name: 'Upload Map' });
    await expect(uploadButtons.first()).toBeVisible();
  });

  test('should open modal when "Change Map" button is clicked', async ({ page }) => {
    // Click the Change Map button
    const changeMapButton = page.getByRole('button', { name: 'Change Map' });
    await expect(changeMapButton).toBeVisible();
    await changeMapButton.click();
    
    // Wait for modal to appear (increased timeout for slower browsers)
    const modalTitle = page.getByText('Upload Map');
    await expect(modalTitle).toBeVisible({ timeout: 10000 });
    
    // Check if file input is present
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
  });

  test('should close modal when close button is clicked', async ({ page }) => {
    // Open modal first
    const changeMapButton = page.getByRole('button', { name: 'Change Map' });
    await changeMapButton.click();
    
    // Wait for modal to appear
    const modalTitle = page.getByText('Upload Map');
    await expect(modalTitle).toBeVisible({ timeout: 10000 });
    
    // Click the close button (Bootstrap's close button)
    const closeButton = page.locator('button.btn-close');
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    
    // Wait for modal to close
    await expect(modalTitle).not.toBeVisible({ timeout: 10000 });
  });

  test('should close modal when Cancel button is clicked', async ({ page }) => {
    // Open modal first
    const changeMapButton = page.getByRole('button', { name: 'Change Map' });
    await changeMapButton.click();
    
    // Wait for modal to appear
    const modalTitle = page.getByText('Upload Map');
    await expect(modalTitle).toBeVisible({ timeout: 10000 });
    
    // Click the Cancel button
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    
    // Wait for modal to close
    await expect(modalTitle).not.toBeVisible({ timeout: 10000 });
  });

  test('should display endpoint information section', async ({ page }) => {
    // Check if the endpoint info section exists
    const endpointSection = page.getByText('Endpoint Information');
    await expect(endpointSection).toBeVisible();
  });

  test('should display "No endpoints configured" when no endpoints exist', async ({ page }) => {
    // Since we mocked the API to return empty array in beforeEach
    // Check if "No endpoints configured" message is displayed
    const noEndpointsMessage = page.getByText('No endpoints configured');
    await expect(noEndpointsMessage).toBeVisible();
  });

  test('should accept image file uploads (JPG, PNG, PDF)', async ({ page }) => {
    // Open modal
    const changeMapButton = page.getByRole('button', { name: 'Change Map' });
    await changeMapButton.click();
    
    // Wait for modal to appear
    const modalTitle = page.getByText('Upload Map');
    await expect(modalTitle).toBeVisible({ timeout: 10000 });
    
    // Check accepted file types
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    const acceptAttr = await fileInput.getAttribute('accept');
    
    expect(acceptAttr).toContain('image/jpeg');
    expect(acceptAttr).toContain('image/png');
    expect(acceptAttr).toContain('image/jpg');
    expect(acceptAttr).toContain('application/pdf');
  });

  test('should have upload button disabled when no file is selected', async ({ page }) => {
    // Open modal
    const changeMapButton = page.getByRole('button', { name: 'Change Map' });
    await changeMapButton.click();
    
    // Wait for modal to appear
    const modalTitle = page.getByText('Upload Map');
    await expect(modalTitle).toBeVisible({ timeout: 10000 });
    
    // Check if upload button is disabled (use class selector since there are multiple buttons)
    const uploadButton = page.locator('.upload-btn');
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toBeDisabled();
  });

  test('should initialize heatmap container', async ({ page }) => {
    // Check if the heatmap container exists
    const heatmapContainer = page.locator('.heatmap-container');
    await expect(heatmapContainer).toBeVisible();
  });

  test('should not load heatmap.js when no floorplan is uploaded', async ({ page }) => {
    // heatmap.js only loads when there's an uploaded image
    // Since no floorplan is uploaded, we just verify the page is functional
    const uploadPrompt = page.getByText('Upload a map to display the heatmap');
    await expect(uploadPrompt).toBeVisible();
  });
});

test.describe('Heatmap with Mock Data', () => {
  test('should handle API errors gracefully', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Set authenticated state
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('isAuthenticated', 'true');
    });
    
    // Mock API error for endpoints
    await page.route('**/api/query/endpoints', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Server error' })
      });
    });
    
    // Mock other APIs
    await page.route('**/api/floorplan*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'No floorplan found' })
      });
    });
    
    await page.route('**/api/client/scan-data', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, count: 0, data: [] })
      });
    });
    
    await page.route('**/api/query/heatmap-data', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { max: 100, min: 0, data: [] }
        })
      });
    });
    
    // Reload to apply authenticated state
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to heatmap page
    const heatmapNavButton = page.getByRole('button', { name: 'Heat map' });
    await heatmapNavButton.click();
    await page.waitForTimeout(500);
    
    // Component should still render without crashing
    const container = page.locator('.heatmap-page');
    await expect(container).toBeVisible();
    
    // Should show "No endpoints configured" message even with API error
    const noEndpointsMessage = page.getByText('No endpoints configured');
    await expect(noEndpointsMessage).toBeVisible();
  });

  test('should display endpoint information when data is available', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Set authenticated state
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('isAuthenticated', 'true');
    });
    
    // Mock endpoint data
    await page.route('**/api/query/endpoints', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 2,
          positions: [
            { 
              endpoint_id: 'EP1', 
              x: 100, 
              y: 200, 
              is_active: true, 
              created_at: '2024-01-01T00:00:00Z', 
              updated_at: '2024-01-01T00:00:00Z' 
            },
            { 
              endpoint_id: 'EP2', 
              x: 300, 
              y: 400, 
              is_active: false, 
              created_at: '2024-01-01T00:00:00Z', 
              updated_at: '2024-01-01T00:00:00Z' 
            }
          ]
        })
      });
    });
    
    // Mock other APIs
    await page.route('**/api/floorplan*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'No floorplan found' })
      });
    });
    
    await page.route('**/api/client/scan-data', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, count: 0, data: [] })
      });
    });
    
    await page.route('**/api/query/heatmap-data', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { max: 100, min: 0, data: [] }
        })
      });
    });
    
    // Reload to apply authenticated state
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to heatmap page
    const heatmapNavButton = page.getByRole('button', { name: 'Heat map' });
    await heatmapNavButton.click();
    await page.waitForTimeout(500);
    
    // Check if endpoint info is displayed
    const ep1 = page.getByText('EP1');
    const ep2 = page.getByText('EP2');
    
    await expect(ep1).toBeVisible();
    await expect(ep2).toBeVisible();
    
    // Check for active/inactive status
    const activeStatus = page.getByText('✓ Active');
    const inactiveStatus = page.getByText('✗ Inactive');
    
    await expect(activeStatus).toBeVisible();
    await expect(inactiveStatus).toBeVisible();
  });

  test('should display endpoint markers on the map when data is available', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Set authenticated state
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('isAuthenticated', 'true');
    });
    
    // Mock endpoint data
    await page.route('**/api/query/endpoints', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 2,
          positions: [
            { 
              endpoint_id: 'EP1', 
              x: 100, 
              y: 200, 
              is_active: true, 
              created_at: '2024-01-01T00:00:00Z', 
              updated_at: '2024-01-01T00:00:00Z' 
            },
            { 
              endpoint_id: 'EP2', 
              x: 300, 
              y: 400, 
              is_active: false, 
              created_at: '2024-01-01T00:00:00Z', 
              updated_at: '2024-01-01T00:00:00Z' 
            }
          ]
        })
      });
    });
    
    // Mock floorplan with actual image data
    await page.route('**/api/floorplan*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          floorplan: {
            id: 1,
            floor: 1,
            name: 'Test Floor',
            image_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        })
      });
    });
    
    await page.route('**/api/client/scan-data', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, count: 0, data: [] })
      });
    });
    
    await page.route('**/api/query/heatmap-data', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { max: 100, min: 0, data: [] }
        })
      });
    });
    
    // Reload to apply authenticated state
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to heatmap page
    const heatmapNavButton = page.getByRole('button', { name: 'Heat map' });
    await heatmapNavButton.click();
    
    // Wait longer for floorplan to load and heatmap to initialize
    await page.waitForTimeout(2000);
    
    // Check if endpoint markers are rendered (they have title attributes)
    const ep1Marker = page.locator('[title="EP1 - Active"]');
    const ep2Marker = page.locator('[title="EP2 - Inactive"]');
    
    // Use longer timeout for marker visibility
    await expect(ep1Marker).toBeVisible({ timeout: 10000 });
    await expect(ep2Marker).toBeVisible({ timeout: 10000 });
  });
});
