const SHEET_ID = '1Wxx3TgN2lfJy7lllmPsMEyQ-5b8NsWAWG8_RakYXz54';
const USERS_SHEET_NAME = 'Users';
const URLS_SHEET_NAME = 'URLs';

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'get') {
      const shortCode = e.parameter.shortCode;
      return getOriginalUrl(shortCode);
    } else if (action === 'getUserLinks') {
      const userId = e.parameter.userId;
      return getUserLinks(userId);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Invalid request' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Server error' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const action = e.parameter.action;

    if (action === 'register') {
      return handleRegister(e.parameter);
    } else if (action === 'login') {
      return handleLogin(e.parameter);
    } else if (action === 'create') {
      return createShortUrl(e.parameter);
    } else if (action === 'delete') {
      return deleteShortUrl(e.parameter);
    } else if (action === 'setup') {
      return initializeSheets();
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Invalid request' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Server error' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleRegister(params) {
  try {
    const email = params.email;
    const username = params.username;
    const password = params.password;

    if (!email || !username || !password) {
      return createResponse(false, 'All fields are required');
    }

    if (!isValidEmail(email)) {
      return createResponse(false, 'Invalid email format');
    }

    if (username.length < 3) {
      return createResponse(false, 'Username must be at least 3 characters');
    }

    if (password.length < 6) {
      return createResponse(false, 'Password must be at least 6 characters');
    }

    const usersSheet = getOrCreateUsersSheet();

    if (userExists(usersSheet, email, username)) {
      return createResponse(false, 'Email or username already exists');
    }

    const userId = generateUUID();
    const hashedPassword = hashPassword(password);
    const timestamp = new Date();

    usersSheet.appendRow([userId, email, username, password, hashedPassword, timestamp]);

    return createResponse(true, 'User registered successfully');

  } catch (error) {
    Logger.log('Error in handleRegister: ' + error.toString());
    return createResponse(false, 'Registration failed');
  }
}

function handleLogin(params) {
  try {
    const identifier = params.identifier;
    const password = params.password;

    if (!identifier || !password) {
      return createResponse(false, 'Email/username and password are required');
    }

    const usersSheet = getOrCreateUsersSheet();
    const users = usersSheet.getDataRange().getValues();

    for (let i = 1; i < users.length; i++) {
      const user = users[i];
      const userId = user[0];
      const email = user[1];
      const username = user[2];
      const realPassword = user[3];
      const storedPasswordHash = user[4];

      if (email === identifier || username === identifier) {

        if (verifyPassword(password, storedPasswordHash)) {
          return createResponse(true, 'Login successful', {
            user: {
              id: userId,
              email: email,
              username: username
            }
          });
        } else {
          return createResponse(false, 'Invalid password');
        }
      }
    }

    return createResponse(false, 'User not found');

  } catch (error) {
    Logger.log('Error in handleLogin: ' + error.toString());
    return createResponse(false, 'Login failed');
  }
}

function createShortUrl(params) {
  try {
    let originalUrl = params.originalUrl;
    const customSlug = params.customSlug;
    const userId = params.userId;
    const expiryDate = params.expiryDate; // Can be date or datetime string
    const driveId = params.driveId;

    // Clean and prepare URL
    originalUrl = originalUrl.trim();
    if (!originalUrl.match(/^https?:\/\//i)) {
      originalUrl = 'https://' + originalUrl;
    }

    if (!isValidUrl(originalUrl)) {
      return createResponse(false, 'Invalid URL format');
    }

    if (!userId) {
      return createResponse(false, 'User not authenticated');
    }

    const sheet = getOrCreateUrlsSheet();
    let shortCode;

    if (customSlug && customSlug.trim() !== '') {
      shortCode = customSlug.trim();

      if (shortCodeExists(sheet, shortCode)) {
        return createResponse(false, 'Custom short code already exists');
      }
    } else {
      shortCode = generateShortUUID();
    }

    const timestamp = new Date();
    sheet.appendRow([shortCode, originalUrl, userId, timestamp, 0, expiryDate || '', driveId || '']);

    return createResponse(true, 'Short URL created successfully', {
      shortCode: shortCode,
      originalUrl: originalUrl
    });

  } catch (error) {
    Logger.log('Error in createShortUrl: ' + error.toString());
    return createResponse(false, 'Failed to create short URL');
  }
}

function deleteShortUrl(params) {
  try {
    const shortCode = params.shortCode;
    const userId = params.userId;

    if (!shortCode || !userId) {
      return createResponse(false, 'Missing required parameters');
    }

    const sheet = getOrCreateUrlsSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === shortCode && data[i][2] === userId) {
        sheet.deleteRow(i + 1);
        return createResponse(true, 'Link deleted successfully');
      }
    }

    return createResponse(false, 'Link not found or you do not have permission to delete it');

  } catch (error) {
    Logger.log('Error in deleteShortUrl: ' + error.toString());
    return createResponse(false, 'Failed to delete link');
  }
}

function getUserLinks(userId) {
  try {
    if (!userId) {
      return createResponse(false, 'User not authenticated');
    }

    const sheet = getOrCreateUrlsSheet();
    const data = sheet.getDataRange().getValues();
    const userLinks = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === userId) {
        userLinks.push({
          shortCode: data[i][0],
          originalUrl: data[i][1],
          created: data[i][3],
          clicks: data[i][4] || 0,
          expiryDate: data[i][5],
          driveId: data[i][6]
        });
      }
    }

    userLinks.sort((a, b) => new Date(b.created) - new Date(a.created));

    return createResponse(true, 'Links retrieved successfully', {
      links: userLinks
    });

  } catch (error) {
    Logger.log('Error in getUserLinks: ' + error.toString());
    return createResponse(false, 'Failed to retrieve links');
  }
}

function getOriginalUrl(shortCode) {
  try {
    const sheet = getOrCreateUrlsSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === shortCode) {
        const currentClicks = data[i][4] || 0;
        sheet.getRange(i + 1, 5).setValue(currentClicks + 1);

        const expiryDate = data[i][5];
        if (expiryDate) {
          const expiry = new Date(expiryDate);
          if (expiry < new Date()) {
            return createResponse(false, 'Link has expired', { expired: true });
          }
        }

        return createResponse(true, 'URL found', {
          originalUrl: data[i][1],
          expiryDate: expiryDate,
          driveId: data[i][6]
        });
      }
    }

    return createResponse(false, 'Short code not found');

  } catch (error) {
    Logger.log('Error in getOriginalUrl: ' + error.toString());
    return createResponse(false, 'Failed to retrieve URL');
  }
}

function getOrCreateUsersSheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let sheet = spreadsheet.getSheetByName(USERS_SHEET_NAME);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(USERS_SHEET_NAME);
      sheet.appendRow(['User ID', 'Email', 'Username', 'Real Password', 'Password Hash', 'Created Date']);
    }

    return sheet;
  } catch (error) {
    Logger.log('Error accessing users sheet: ' + error.toString());
    throw new Error('Cannot access Google Sheet. Check your SHEET_ID.');
  }
}

function getOrCreateUrlsSheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let sheet = spreadsheet.getSheetByName(URLS_SHEET_NAME);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(URLS_SHEET_NAME);
      sheet.appendRow(['Short Code', 'Original URL', 'User ID', 'Created Date', 'Click Count', 'Expiry Date', 'Drive ID']);
    }

    return sheet;
  } catch (error) {
    Logger.log('Error accessing URLs sheet: ' + error.toString());
    throw new Error('Cannot access Google Sheet. Check your SHEET_ID.');
  }
}

function userExists(usersSheet, email, username) {
  const data = usersSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === email || data[i][2] === username) {
      return true;
    }
  }
  return false;
}

function shortCodeExists(sheet, shortCode) {
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === shortCode) {
      return true;
    }
  }
  return false;
}

function generateUUID() {
  return Utilities.getUuid();
}

function generateShortUUID() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 8);
}

function hashPassword(password) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password));
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

// SIMPLIFIED: Much more permissive URL validation function
function isValidUrl(string) {
  try {
    if (!string) {
      return false;
    }
    string = ('' + string).trim();
    if (string.length < 3) {
      return false;
    }
    if (!/^https?:\/\//i.test(string)) {
      string = 'https://' + string;
    }
    const pattern = /^(https?:\/\/)(localhost(:\d+)?|(\d{1,3}\.){3}\d{1,3}|([a-z0-9-]+\.)+[a-z]{2,})(\/[^\s]*)?$/i;
    return pattern.test(string);
  } catch (error) {
    Logger.log('URL validation error for "' + string + '": ' + error.toString());
    return false;
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function createResponse(success, message, data = {}) {
  const response = {
    success: success,
    message: message,
    ...data
  };

  if (!success) {
    response.error = message;
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function testSetup() {
  return initializeSheets();
}

function initializeSheets() {
  try {
    const usersSheet = getOrCreateUsersSheet();
    const urlsSheet = getOrCreateUrlsSheet();
    return createResponse(true, 'Sheets initialized successfully', {
      usersRows: usersSheet.getLastRow(),
      urlsRows: urlsSheet.getLastRow()
    });
  } catch (error) {
    return createResponse(false, 'Setup failed: ' + error.toString());
  }
}

function getAllUsers() {
  try {
    const usersSheet = getOrCreateUsersSheet();
    const data = usersSheet.getDataRange().getValues();

    const users = [];
    for (let i = 1; i < data.length; i++) {
      users.push({
        id: data[i][0],
        email: data[i][1],
        username: data[i][2],
        realPassword: data[i][3],
        created: data[i][5]
      });
    }

    Logger.log('Total users: ' + users.length);
    return users;
  } catch (error) {
    Logger.log('Error getting users: ' + error.toString());
    return [];
  }
}

function getAllUrls() {
  try {
    const urlsSheet = getOrCreateUrlsSheet();
    const data = urlsSheet.getDataRange().getValues();

    const urls = [];
    for (let i = 1; i < data.length; i++) {
      urls.push({
        shortCode: data[i][0],
        originalUrl: data[i][1],
        userId: data[i][2],
        created: data[i][3],
        clicks: data[i][4] || 0
      });
    }

    Logger.log('Total URLs: ' + urls.length);
    return urls;
  } catch (error) {
    Logger.log('Error getting URLs: ' + error.toString());
    return [];
  }
}

// Test function to validate different URL formats
function testUrlValidation() {
  const testUrls = [
    'google.com',
    'www.google.com',
    'https://google.com',
    'http://google.com',
    'facebook.com/page',
    'sub.domain.com',
    'site.co.uk',
    'localhost:3000',
    'localhost',
    '192.168.1.1',
    'https://192.168.1.1:8080',
    'example.org/path/to/page',
    'test-site.net',
    'myapp.herokuapp.com',
    'youtube.com',
    'github.com/user/repo',
    'stackoverflow.com/questions/123',
    'amazon.com/product',
    'invalid',
    'just-text',
    'http://',
    'https://',
    'ftp://example.com',
    'example..com',
    '.example.com',
    'example.com.'
  ];

  testUrls.forEach(url => {
    const isValid = isValidUrl(url);
    Logger.log(`URL: "${url}" - Valid: ${isValid}`);
  });
}
