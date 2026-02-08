/**
 * Saves an image from a URL directly to your specific Google Drive folder.
 * Folder ID: 1xVX82FFBuH1rp4VwnM2jYdmrRhBu01uw
 */

const folderId = "1xVX82FFBuH1rp4VwnM2jYdmrRhBu01uw";
//removed folder not used just remove it
const removedFolderId = "";

function doGet(e) {
  return createResponse(true, 'Upload service is online');
}

function doOptions(e) {
  return createResponse(true, 'CORS Preflight Success');
}

function doPost(e) {
  var debugInfo = {
    hasParameters: !!e.parameters,
    parameterKeys: e.parameters ? Object.keys(e.parameters) : [],
    hasPostData: !!e.postData,
    postDataType: e.postData ? e.postData.type : null,
    hasContents: !!(e.postData && e.postData.contents),
    contentsType: e.postData && e.postData.contents ? typeof e.postData.contents : null
  };

  try {
    var params = e.parameter || {};
    var postData = {};
    var isMultipart = false;

    // Check for multipart in multiple ways
    if (e.postData) {
      if (e.postData.type && (e.postData.type.indexOf('multipart') !== -1 || e.postData.type.indexOf('form-data') !== -1)) {
        isMultipart = true;
      }
      // Also check if we have parameters with file data (indicates multipart was parsed)
      if (e.parameters && Object.keys(e.parameters).length > 0) {
        for (var key in e.parameters) {
          if (e.parameters.hasOwnProperty(key)) {
            var val = e.parameters[key];
            if (val && (val.getBytes || (Array.isArray(val) && val.length > 0 && val[0].getBytes))) {
              isMultipart = true;
              break;
            }
          }
        }
      }
    }

    if (e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (ex) {
        // Not JSON
        if (!isMultipart && typeof e.postData.contents !== 'string') {
          if (e.postData.contents.getBytes) {
            isMultipart = true;
          }
        }
      }
    }

    // Special handling for text-only base64 upload (CORS friendly)
    // If request body is a plain string and action is in URL
    var action = params.action || postData.action;

    // --- NEW ARCHIVE ACTION ---
    if (action === 'archiveFiles') {
      var driveIds = params.driveIds || postData.driveIds;
      if (typeof driveIds === 'string') {
        try { driveIds = JSON.parse(driveIds); } catch (e) { driveIds = driveIds.split(','); }
      }

      if (!Array.isArray(driveIds) || driveIds.length === 0) {
        return createResponse(false, 'No driveIds provided for archiving');
      }

      var archivedList = [];
      var errorList = [];
      var destFolder = DriveApp.getFolderById(removedFolderId);

      for (var i = 0; i < driveIds.length; i++) {
        var id = driveIds[i];
        try {
          var file = DriveApp.getFileById(id);
          // Move file: add to new folder and remove from old folders
          destFolder.addFile(file);
          var parents = file.getParents();
          while (parents.hasNext()) {
            var p = parents.next();
            if (p.getId() !== removedFolderId) {
              p.removeFile(file);
            }
          }
          archivedList.push(id);
        } catch (err) {
          errorList.push({ id: id, error: err.toString() });
        }
      }

      return createResponse(true, 'Archived ' + archivedList.length + ' files', {
        archivedCount: archivedList.length,
        errors: errorList
      });
    }

    // Check if this is a raw text body upload (simple request)
    // GAS parses application/x-www-form-urlencoded into e.parameter
    // But for raw text/plain, it stays in e.postData.contents
    var base64Content = params.content || postData.content || (e.postData ? e.postData.contents : null);

    if (action === 'upload' && base64Content && typeof base64Content === 'string') {
      // Strip data URL prefix if it accidentally leaked through
      if (base64Content.indexOf('base64,') !== -1) {
        base64Content = base64Content.split('base64,')[1];
      }

      var filename = params.filename || ("Image_" + new Date().getTime() + ".jpg");
      var contentType = params.contentType || "image/jpeg";

      try {
        const decodedData = Utilities.base64Decode(base64Content);
        const blob = Utilities.newBlob(decodedData, contentType, filename);

        const folder = DriveApp.getFolderById(folderId);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        return createResponse(true, 'Upload successful', {
          driveId: file.getId(),
          url: 'https://lh3.googleusercontent.com/u/0/d/' + file.getId(),
          downloadUrl: file.getDownloadUrl(),
          viewUrl: file.getUrl()
        });
      } catch (e) {
        return createResponse(false, 'Upload decoding failed: ' + e.toString());
      }
    }

    // Handle FormData upload (multipart/form-data)
    // Google Apps Script automatically parses multipart/form-data into e.parameters
    // Check e.parameters.myFile FIRST as it's the most reliable way
    if (e.parameters && e.parameters.myFile) {
      var fileBlob = null;
      if (Array.isArray(e.parameters.myFile) && e.parameters.myFile.length > 0) {
        fileBlob = e.parameters.myFile[0];
      } else if (e.parameters.myFile && !Array.isArray(e.parameters.myFile)) {
        fileBlob = e.parameters.myFile;
      }

      if (fileBlob) {
        const filename = params.filename || (fileBlob.getName ? fileBlob.getName() : null) || ("Image_" + new Date().getTime());
        const contentType = params.contentType || (fileBlob.getContentType ? fileBlob.getContentType() : null) || "image/jpeg";

        const folder = DriveApp.getFolderById(folderId);
        const file = folder.createFile(fileBlob);
        if (filename) file.setName(filename);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        return createResponse(true, 'Upload successful', {
          driveId: file.getId(),
          url: 'https://lh3.googleusercontent.com/u/0/d/' + file.getId(),
          downloadUrl: file.getDownloadUrl(),
          viewUrl: file.getUrl()
        });
      }
    }

    // Fallback: Handle multipart/form-data manually if e.parameters didn't work
    // Also try if we have postData.contents that looks like a blob (even if multipart not detected)
    if (isMultipart || (e.postData && e.postData.type && e.postData.type.indexOf('multipart') !== -1) ||
      (e.postData && e.postData.contents && e.postData.contents.getBytes && action === 'upload')) {
      var fileBlob = null;
      var filename = params.filename || ("Image_" + new Date().getTime() + ".jpg");
      var contentType = params.contentType || "image/jpeg";

      // Try to get blob from postData.contents
      if (e.postData && e.postData.contents) {
        // Check if it's already a blob (has getBytes method)
        if (e.postData.contents.getBytes) {
          // It's a blob - use it directly
          fileBlob = e.postData.contents;
          // Try to get content type from blob if available
          try {
            var blobType = fileBlob.getContentType();
            if (blobType && blobType !== 'application/octet-stream') {
              contentType = blobType;
            }
          } catch (ex) { }
        } else if (typeof e.postData.contents === 'string') {
          // It's a string - try to extract file from multipart string
          var contentTypeHeader = e.postData.type || 'multipart/form-data';
          fileBlob = parseMultipartFormData(e.postData.contents, contentTypeHeader);
        } else {
          // Try to use as blob directly
          try {
            if (e.postData.contents.getBlob) {
              fileBlob = e.postData.contents.getBlob();
            } else {
              fileBlob = e.postData.contents;
            }
          } catch (ex) {
            Logger.log('Error using postData.contents as blob: ' + ex.toString());
          }
        }
      }

      if (fileBlob) {
        const folder = DriveApp.getFolderById(folderId);
        const file = folder.createFile(fileBlob);
        if (filename) file.setName(filename);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        return createResponse(true, 'Upload successful', {
          driveId: file.getId(),
          url: 'https://lh3.googleusercontent.com/u/0/d/' + file.getId(),
          downloadUrl: file.getDownloadUrl(),
          viewUrl: file.getUrl()
        });
      } else {
        return createResponse(false, 'Failed to extract file from multipart data. postData type: ' + (e.postData ? e.postData.type : 'none') + ', has contents: ' + (e.postData && e.postData.contents ? 'yes' : 'no') + ', contents type: ' + (e.postData && e.postData.contents ? typeof e.postData.contents : 'none') + ', isMultipart: ' + isMultipart);
      }
    }

    // Handle Base64 upload (JSON) - only if we have base64 data AND NOT multipart
    var base64Data = params.content || postData.content;
    if (action === 'upload' && !isMultipart && base64Data) {
      var filename = params.filename || postData.filename || ("Image_" + new Date().getTime());
      var contentType = params.contentType || postData.contentType || "image/jpeg";

      const decodedData = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decodedData, contentType, filename);

      const folder = DriveApp.getFolderById(folderId);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return createResponse(true, 'Upload successful', {
        driveId: file.getId(),
        url: 'https://lh3.googleusercontent.com/u/0/d/' + file.getId(),
        downloadUrl: file.getDownloadUrl(),
        viewUrl: file.getUrl()
      });
    }

    // Last attempt: check all parameters for any blob/file
    if (e.parameters) {
      for (var key in e.parameters) {
        if (e.parameters.hasOwnProperty(key)) {
          var paramValue = e.parameters[key];
          if (paramValue && (paramValue.getBytes || (Array.isArray(paramValue) && paramValue.length > 0 && paramValue[0].getBytes))) {
            var fileBlob = Array.isArray(paramValue) ? paramValue[0] : paramValue;
            var filename = params.filename || (fileBlob.getName ? fileBlob.getName() : null) || ("Image_" + new Date().getTime());
            var contentType = params.contentType || (fileBlob.getContentType ? fileBlob.getContentType() : null) || "image/jpeg";

            const folder = DriveApp.getFolderById(folderId);
            const file = folder.createFile(fileBlob);
            if (filename) file.setName(filename);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

            return createResponse(true, 'Upload successful', {
              driveId: file.getId(),
              url: 'https://lh3.googleusercontent.com/u/0/d/' + file.getId(),
              downloadUrl: file.getDownloadUrl(),
              viewUrl: file.getUrl()
            });
          }
        }
      }
    }

    // Final fallback: if we have postData.contents as blob and action=upload, try using it directly
    // This handles cases where Google Apps Script received the file but didn't parse it into parameters
    if (action === 'upload' && e.postData && e.postData.contents && e.postData.contents.getBytes) {
      try {
        var fileBlob = e.postData.contents;
        var filename = params.filename || ("Image_" + new Date().getTime() + ".jpg");
        var contentType = params.contentType || "image/jpeg";

        // Try to get content type from blob
        try {
          var blobType = fileBlob.getContentType();
          if (blobType && blobType !== 'application/octet-stream') {
            contentType = blobType;
          }
        } catch (ex) { }

        const folder = DriveApp.getFolderById(folderId);
        const file = folder.createFile(fileBlob);
        if (filename) file.setName(filename);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        return createResponse(true, 'Upload successful', {
          driveId: file.getId(),
          url: 'https://lh3.googleusercontent.com/u/0/d/' + file.getId(),
          downloadUrl: file.getDownloadUrl(),
          viewUrl: file.getUrl()
        });
      } catch (ex) {
        Logger.log('Error using postData.contents directly: ' + ex.toString());
      }
    }

    return createResponse(false, 'Invalid action or missing file. Action: ' + (action || 'none') + ', isMultipart: ' + isMultipart + ', has parameters.myFile: ' + (e.parameters && e.parameters.myFile ? 'yes' : 'no') + ', Debug: ' + JSON.stringify(debugInfo));
  } catch (error) {
    return createResponse(false, 'Upload failed: ' + error.toString() + '. Stack: ' + (error.stack || 'no stack') + ', Debug: ' + JSON.stringify(debugInfo));
  }
}

function parseMultipartFormData(body, contentType) {
  try {
    // Extract boundary from Content-Type header
    var boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) return null;

    var boundary = '--' + boundaryMatch[1].trim();
    var parts = body.split(boundary);

    // Find the part with the file (contains Content-Disposition: form-data; name="myFile")
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part.indexOf('name="myFile"') !== -1 || part.indexOf("name='myFile'") !== -1) {
        // Extract the file content (after the headers and blank line)
        var headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) headerEnd = part.indexOf('\n\n');
        if (headerEnd === -1) continue;

        var fileContent = part.substring(headerEnd).replace(/^[\r\n]+/, '').replace(/[\r\n]+$/, '');

        // Extract content type if available
        var contentTypeMatch = part.match(/Content-Type:\s*([^\r\n]+)/i);
        var fileContentType = contentTypeMatch ? contentTypeMatch[1].trim() : 'image/jpeg';

        // Try to convert to blob - file content might be binary or base64
        try {
          // First try as base64 (if it's encoded)
          var bytes = Utilities.base64Decode(fileContent);
          return Utilities.newBlob(bytes, fileContentType);
        } catch (e) {
          // If base64 decode fails, try as raw binary string
          try {
            var bytes = [];
            for (var j = 0; j < fileContent.length; j++) {
              bytes.push(fileContent.charCodeAt(j) & 0xFF);
            }
            return Utilities.newBlob(bytes, fileContentType);
          } catch (e2) {
            Logger.log('Error creating blob from multipart: ' + e2.toString());
          }
        }
      }
    }
  } catch (e) {
    Logger.log('Error parsing multipart: ' + e.toString());
  }
  return null;
}

function createResponse(success, message, data) {
  var dataObj = data || {};
  var result = {
    success: success,
    message: message
  };
  for (var key in dataObj) {
    if (dataObj.hasOwnProperty(key)) {
      result[key] = dataObj[key];
    }
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}


function downloadImageToDrive() {
  const imageUrl = "https://picsum.photos/800/600";
  try {
    const response = UrlFetchApp.fetch(imageUrl);
    const blob = response.getBlob();
    const folder = DriveApp.getFolderById(folderId);
    const fileName = "Image_" + new Date().toISOString() + ".jpg";
    const file = folder.createFile(blob).setName(fileName);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    console.log("Error: " + e.toString());
  }
}

function batchDownloadFromList(urlArray) {
  const folder = DriveApp.getFolderById(folderId);
  urlArray.forEach((url, index) => {
    const blob = UrlFetchApp.fetch(url).getBlob();
    folder.createFile(blob).setName("Batch_Image_" + index);
  });
}
