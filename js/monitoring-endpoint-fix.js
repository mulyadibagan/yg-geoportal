(function () {
  'use strict';

  var OLD_ID = 'AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg';
  var NEW_ID = 'AKfycbxeGTDZXkR0DyLZmBHTq2M-52Iu4dTTGpH164S7sYHg8qPzvffobC6-r-TBLVHMT3HU-A';
  var originalAppendChild = Element.prototype.appendChild;

  Element.prototype.appendChild = function (node) {
    try {
      if (node && node.tagName === 'SCRIPT' && node.src && node.src.indexOf(OLD_ID) !== -1) {
        node.src = node.src.replace(OLD_ID, NEW_ID);
      }
    } catch (error) {
      console.warn('Endpoint monitoring tidak dapat diperbarui:', error);
    }
    return originalAppendChild.call(this, node);
  };
})();
