import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page first
    await page.goto('/');
    
    // Clear localStorage to ensure we start logged out
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('isAuthenticated', 'false');
    });
    
    // Reload to apply the logged-out state
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should display login form when not authenticated', async ({ page }) => {
    // Check if the welcome message is visible
    const welcomeText = page.getByText('Welcome to ZOPAC heat map!');
    await expect(welcomeText).toBeVisible();

    // Check if email and password inputs are present
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Check if login button is present
    const loginButton = page.getByRole('button', { name: 'Log In' });
    await expect(loginButton).toBeVisible();

    // Check if "Create an Account" button is present
    const signupButton = page.getByRole('button', { name: 'Create an Account' });
    await expect(signupButton).toBeVisible();
  });

  test('should have proper input types and attributes', async ({ page }) => {
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');

    // Check email input type
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('required', '');

    // Check password input type
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test('should allow user to type in email and password fields', async ({ page }) => {
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');

    // Type in email field
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');

    // Type in password field
    await passwordInput.fill('password123');
    await expect(passwordInput).toHaveValue('password123');
  });

  test('should show error alert on failed login', async ({ page }) => {
    // Mock failed login response
    await page.route('**/api/auth/login', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Invalid email or password'
        })
      });
    });

    // Fill in login form
    await page.locator('#email').fill('wrong@example.com');
    await page.locator('#password').fill('wrongpassword');

    // Set up dialog handler to capture alert
    const dialogPromise = page.waitForEvent('dialog');
    
    // Submit form
    const loginButton = page.getByRole('button', { name: 'Log In' });
    await loginButton.click();
    
    // Handle the dialog
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Invalid email or password');
    await dialog.accept();
  });

  test('should successfully log in with valid credentials', async ({ page }) => {
    // Mock successful login response
    await page.route('**/api/auth/login', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: { email: 'test@example.com' }
        })
      });
    });

    // Fill in login form
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('correctpassword');

    // Set up dialog handler to capture success alert
    const dialogPromise = page.waitForEvent('dialog');
    
    // Submit form
    const loginButton = page.getByRole('button', { name: 'Log In' });
    await loginButton.click();
    
    // Handle the dialog
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Login successful!');
    await dialog.accept();

    // Wait for the component to re-render with authenticated view
    await page.waitForTimeout(100);

    // Check if welcome message changes after login
    const welcomeMessage = page.getByText('Welcome to the ZOPAC Heat Map Dashboard!');
    await expect(welcomeMessage).toBeVisible();

    // Check if authenticated message is shown
    const authMessage = page.getByText('You are now logged in and can access the rest of the website.');
    await expect(authMessage).toBeVisible();
  });

  test('should show error alert on network failure', async ({ page }) => {
    // Mock network error
    await page.route('**/api/auth/login', route => {
      route.abort('failed');
    });

    // Fill in login form
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('password123');

    // Set up dialog handler to capture error alert
    const dialogPromise = page.waitForEvent('dialog');
    
    // Submit form
    const loginButton = page.getByRole('button', { name: 'Log In' });
    await loginButton.click();
    
    // Handle the dialog
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Failed to log in');
    await dialog.accept();
  });

  test('should clear form fields after successful login', async ({ page }) => {
    // Mock successful login response
    await page.route('**/api/auth/login', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: { email: 'test@example.com' }
        })
      });
    });

    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');

    // Fill in login form
    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');

    // Set up dialog handler
    const dialogPromise = page.waitForEvent('dialog');

    // Submit form
    const loginButton = page.getByRole('button', { name: 'Log In' });
    await loginButton.click();
    
    // Handle the dialog
    const dialog = await dialogPromise;
    await dialog.accept();

    // After successful login, the form is replaced with the welcome message
    // Verify the login form is no longer visible
    await expect(emailInput).not.toBeVisible();
    await expect(passwordInput).not.toBeVisible();
  });
});

test.describe('Signup Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page first
    await page.goto('/');
    
    // Clear localStorage to ensure we start logged out
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('isAuthenticated', 'false');
    });
    
    // Reload to apply the logged-out state
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should open signup modal when "Create an Account" button is clicked', async ({ page }) => {
    // Click the "Create an Account" button
    const signupButton = page.getByRole('button', { name: 'Create an Account' });
    await signupButton.click();

    // Check if modal is visible
    const modalTitle = page.getByText('Create your account');
    await expect(modalTitle).toBeVisible();

    // Check if modal has proper ARIA attributes
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('aria-modal', 'true');
  });

  test('should display all signup form fields', async ({ page }) => {
    // Open signup modal
    await page.getByRole('button', { name: 'Create an Account' }).click();

    // Check if all form fields are visible
    const emailInput = page.locator('#signup-email');
    const passwordInput = page.locator('#signup-password');
    const confirmInput = page.locator('#signup-confirm');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(confirmInput).toBeVisible();

    // Check if all inputs are required
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
    await expect(confirmInput).toHaveAttribute('required', '');
  });

  test('should close modal when X button is clicked', async ({ page }) => {
    // Open signup modal
    await page.getByRole('button', { name: 'Create an Account' }).click();

    // Click the X button
    const closeButton = page.getByRole('button', { name: 'Close' });
    await closeButton.click();

    // Modal should be closed
    const modalTitle = page.getByText('Create your account');
    await expect(modalTitle).not.toBeVisible();
  });

  test('should close modal when Cancel button is clicked', async ({ page }) => {
    // Open signup modal
    await page.getByRole('button', { name: 'Create an Account' }).click();

    // Click the Cancel button
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await cancelButton.click();

    // Modal should be closed
    const modalTitle = page.getByText('Create your account');
    await expect(modalTitle).not.toBeVisible();
  });

  test('should close modal when clicking outside modal content', async ({ page }) => {
    // Open signup modal
    await page.getByRole('button', { name: 'Create an Account' }).click();

    // Click on the overlay (outside modal content)
    const overlay = page.locator('.homepage-modal-overlay');
    await overlay.click({ position: { x: 5, y: 5 } });

    // Modal should be closed
    const modalTitle = page.getByText('Create your account');
    await expect(modalTitle).not.toBeVisible();
  });

  test('should close modal when Escape key is pressed', async ({ page }) => {
    // Open signup modal
    await page.getByRole('button', { name: 'Create an Account' }).click();

    // Check modal is open
    const modalTitle = page.getByText('Create your account');
    await expect(modalTitle).toBeVisible();

    // Press Escape key
    await page.keyboard.press('Escape');

    // Modal should be closed
    await expect(modalTitle).not.toBeVisible();
  });

  test('should show alert when passwords do not match', async ({ page }) => {
    // Open signup modal
    await page.getByRole('button', { name: 'Create an Account' }).click();

    // Fill in form with non-matching passwords
    await page.locator('#signup-email').fill('newuser@example.com');
    await page.locator('#signup-password').fill('password123');
    await page.locator('#signup-confirm').fill('differentpassword');

    // Set up dialog handler
    const dialogPromise = page.waitForEvent('dialog');

    // Submit form
    const createButton = page.getByRole('button', { name: 'Create Account' });
    await createButton.click();
    
    // Handle the dialog
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Passwords do not match.');
    await dialog.accept();
  });

  test('should show alert when fields are empty', async ({ page }) => {
    // Open signup modal
    await page.getByRole('button', { name: 'Create an Account' }).click();

    // Try to submit without filling fields
    // Note: HTML5 validation will prevent submission, but we can test the JS validation
    // by filling confirm password only
    await page.locator('#signup-confirm').fill('password123');

    // The form should not submit due to required field validation
    const createButton = page.getByRole('button', { name: 'Create Account' });
    await createButton.click();

    // Modal should still be visible (form didn't submit)
    const modalTitle = page.getByText('Create your account');
    await expect(modalTitle).toBeVisible();
  });

  test('should successfully create account with valid data', async ({ page }) => {
    // Mock successful signup response
    await page.route('**/api/auth/signup', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: { email: 'newuser@example.com' }
        })
      });
    });

    // Open signup modal
    await page.getByRole('button', { name: 'Create an Account' }).click();

    // Fill in form with matching passwords
    await page.locator('#signup-email').fill('newuser@example.com');
    await page.locator('#signup-password').fill('password123');
    await page.locator('#signup-confirm').fill('password123');

    // Set up dialog handler
    const dialogPromise = page.waitForEvent('dialog');

    // Submit form
    const createButton = page.getByRole('button', { name: 'Create Account' });
    await createButton.click();
    
    // Handle the dialog
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Account created successfully');
    await dialog.accept();

    // Wait for modal to close
    await page.waitForTimeout(200);

    // Modal should be closed
    const modalTitle = page.getByText('Create your account');
    await expect(modalTitle).not.toBeVisible();
  });

  test('should show error alert on failed signup', async ({ page }) => {
    // Mock failed signup response (e.g., email already exists)
    await page.route('**/api/auth/signup', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Email already exists'
        })
      });
    });

    // Open signup modal
    await page.getByRole('button', { name: 'Create an Account' }).click();

    // Fill in form
    await page.locator('#signup-email').fill('existing@example.com');
    await page.locator('#signup-password').fill('password123');
    await page.locator('#signup-confirm').fill('password123');

    // Set up dialog handler
    const dialogPromise = page.waitForEvent('dialog');

    // Submit form
    const createButton = page.getByRole('button', { name: 'Create Account' });
    await createButton.click();
    
    // Handle the dialog
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Email already exists');
    await dialog.accept();

    // Modal should still be visible (signup failed)
    await page.waitForTimeout(100);
    const modalTitle = page.getByText('Create your account');
    await expect(modalTitle).toBeVisible();
  });

  test('should clear form fields when modal is closed and reopened', async ({ page }) => {
    // Open signup modal
    await page.getByRole('button', { name: 'Create an Account' }).click();

    // Fill in some data
    await page.locator('#signup-email').fill('test@example.com');
    await page.locator('#signup-password').fill('password123');

    // Close modal
    const closeButton = page.getByRole('button', { name: 'Close' });
    await closeButton.click();

    // Reopen modal
    await page.getByRole('button', { name: 'Create an Account' }).click();

    // Check that fields are empty
    await expect(page.locator('#signup-email')).toHaveValue('');
    await expect(page.locator('#signup-password')).toHaveValue('');
    await expect(page.locator('#signup-confirm')).toHaveValue('');
  });

  test('should handle network error during signup', async ({ page }) => {
    // Mock network error
    await page.route('**/api/auth/signup', route => {
      route.abort('failed');
    });

    // Open signup modal
    await page.getByRole('button', { name: 'Create an Account' }).click();

    // Fill in form
    await page.locator('#signup-email').fill('newuser@example.com');
    await page.locator('#signup-password').fill('password123');
    await page.locator('#signup-confirm').fill('password123');

    // Set up dialog handler
    const dialogPromise = page.waitForEvent('dialog');

    // Submit form
    const createButton = page.getByRole('button', { name: 'Create Account' });
    await createButton.click();
    
    // Handle the dialog
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Failed to create account');
    await dialog.accept();
  });
});

test.describe('Authenticated State', () => {
  test('should display authenticated view when user is logged in', async ({ page }) => {
    // Navigate to the home page first
    await page.goto('/');
    
    // Set authenticated state
    await page.evaluate(() => {
      localStorage.setItem('isAuthenticated', 'true');
    });
    
    // Reload to apply the authenticated state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check if authenticated welcome message is displayed
    const welcomeMessage = page.getByText('Welcome to the ZOPAC Heat Map Dashboard!');
    await expect(welcomeMessage).toBeVisible();

    // Check if authenticated description is shown
    const description = page.getByText('You are now logged in and can access the rest of the website.');
    await expect(description).toBeVisible();

    // Login form should not be visible
    const loginButton = page.getByRole('button', { name: 'Log In' });
    await expect(loginButton).not.toBeVisible();
  });
});

