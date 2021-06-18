// Nodejs encryption with CTR
const crypto = require('crypto');
const key = crypto
  .createHash('sha256')
  .update(String(process.env.HEADER_SECRET))
  .digest('base64')
  .substr(0, 32);
const iv = Buffer.from('b2df428b9929d3ace7c598bbf4e496b2').slice(0, 16);

function encrypt (text) {
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
}

function decrypt (text) {
  let encryptedText = Buffer.from(text, 'hex');
  let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

module.exports = {
  encrypt,
  decrypt
};
